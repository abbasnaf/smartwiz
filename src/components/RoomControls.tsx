import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import type { DeviceSnapshot } from '../../shared/types';

interface Props {
  room: string;
  devices: DeviceSnapshot[];
  disabled?: boolean;
  onResult: (message: string | null) => void;
}

export function RoomControls({ room, devices, disabled, onResult }: Props) {
  const connectedDevices = devices.filter((device) => device.status === 'connected');
  const offlineCount = devices.length - connectedDevices.length;
  const brightnessValues = connectedDevices
    .map((device) => device.state?.dimming)
    .filter((value): value is number => typeof value === 'number');
  const averageBrightness = brightnessValues.length
    ? Math.round(brightnessValues.reduce((sum, value) => sum + value, 0) / brightnessValues.length)
    : 100;
  const [brightness, setBrightness] = useState(averageBrightness);
  const [busy, setBusy] = useState(false);

  useEffect(() => setBrightness(averageBrightness), [averageBrightness]);

  const reportResult = (action: string, failures: string[]) => {
    const skipped = offlineCount ? ` ${offlineCount} offline ${offlineCount === 1 ? 'device was' : 'devices were'} skipped.` : '';
    onResult(failures.length
      ? `${action} failed for: ${failures.join(', ')}.${skipped}`
      : `${action} for ${connectedDevices.length} connected ${connectedDevices.length === 1 ? 'device' : 'devices'}.${skipped}`);
  };

  const sendBrightness = useDebouncedCallback(async (value: number) => {
    const results = await Promise.allSettled(connectedDevices.map((device) => window.wiz.setBrightness(device.config.id, value)));
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [connectedDevices[index].config.name] : []);
    reportResult('Brightness updated', failures);
  }, 250);

  const changePower = async (on: boolean) => {
    setBusy(true);
    onResult(null);
    try {
      const results = await Promise.allSettled(connectedDevices.map((device) => window.wiz.setPower(device.config.id, on)));
      const failures = results.flatMap((result, index) => result.status === 'rejected' ? [connectedDevices[index].config.name] : []);
      reportResult(`Power turned ${on ? 'on' : 'off'}`, failures);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Room controls</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void changePower(true)}
            disabled={disabled || busy || connectedDevices.length === 0}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50"
          >
            Turn all on
          </button>
          <button
            type="button"
            onClick={() => void changePower(false)}
            disabled={disabled || busy || connectedDevices.length === 0}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50"
          >
            Turn all off
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={`room-brightness-${room}`} className="w-16 shrink-0 text-xs text-slate-400">Brightness</label>
        <input
          id={`room-brightness-${room}`}
          type="range"
          min={10}
          max={100}
          value={brightness}
          disabled={disabled || connectedDevices.length === 0}
          onChange={(event) => {
            const value = Number(event.target.value);
            setBrightness(value);
            sendBrightness(value);
          }}
          onPointerUp={sendBrightness.flush}
          onKeyUp={sendBrightness.flush}
          onBlur={sendBrightness.flush}
          style={{ '--range-progress': `${((brightness - 10) / 90) * 100}%` } as CSSProperties}
          className="range-control range-control--brightness min-w-0 flex-1"
          aria-label={`Set brightness for ${room}`}
          aria-valuetext={`${brightness}%`}
        />
        <span className="w-9 text-right text-xs tabular-nums text-slate-400">{brightness}%</span>
      </div>
      <p className="text-[11px] text-slate-500">
        {connectedDevices.length} connected{offlineCount > 0 ? ` · ${offlineCount} offline devices will be skipped` : ''}
      </p>
    </div>
  );
}
