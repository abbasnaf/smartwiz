import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import type { DeviceSnapshot } from '../../shared/types';
import { PowerToggle } from './PowerToggle';

const statusColor: Record<DeviceSnapshot['status'], string> = {
  connected: 'text-emerald-400',
  connecting: 'text-amber-300',
  disconnected: 'text-slate-400',
  error: 'text-rose-400',
};

interface Props {
  snapshot: DeviceSnapshot;
  onSelect: () => void;
}

export function DeviceListItem({ snapshot, onSelect }: Props) {
  const [brightness, setBrightness] = useState(snapshot.state?.dimming ?? 100);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const displayBrightness = Math.max(10, Math.min(100, brightness));
  const disabled = snapshot.status === 'disconnected' || (snapshot.status === 'error' && !snapshot.state);

  useEffect(() => {
    if (typeof snapshot.state?.dimming === 'number') setBrightness(snapshot.state.dimming);
  }, [snapshot.state?.dimming, snapshot.config.id]);

  const sendBrightness = useDebouncedCallback(async (id: string, value: number) => {
    try {
      await window.wiz.setBrightness(id, value);
      setLocalError(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }, 250);

  const onPower = async (on: boolean) => {
    setBusy(true);
    try {
      await window.wiz.setPower(snapshot.config.id, on);
      setLocalError(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const changeBrightness = (value: number) => {
    setBrightness(value);
    if (!disabled) sendBrightness(snapshot.config.id, value);
  };

  return (
    <article className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-2.5 space-y-2">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onSelect}
            className="block max-w-full truncate text-left text-sm font-semibold hover:text-indigo-200"
            aria-label={`Configure ${snapshot.config.name}`}
          >
            {snapshot.config.name}
          </button>
          <div className={`mt-1 flex items-center gap-1.5 text-[11px] ${statusColor[snapshot.status]}`}>
            <span>{snapshot.status}</span>
            {snapshot.state && <span className="text-slate-400">· {snapshot.state.state ? 'On' : 'Off'}</span>}
          </div>
        </div>
        <PowerToggle
          on={Boolean(snapshot.state?.state)}
          disabled={busy || disabled}
          pending={busy || snapshot.pendingCommand}
          onChange={onPower}
          compact
          ariaLabel={`Toggle ${snapshot.config.name} power`}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-[11px] text-slate-400">Brightness</span>
        <input
          type="range"
          min={10}
          max={100}
          value={displayBrightness}
          disabled={disabled}
          onChange={(event) => changeBrightness(Number(event.target.value))}
          onPointerUp={sendBrightness.flush}
          onKeyUp={sendBrightness.flush}
          onBlur={sendBrightness.flush}
          style={{ '--range-progress': `${((displayBrightness - 10) / 90) * 100}%` } as CSSProperties}
          className="range-control range-control--brightness min-w-0 flex-1"
          aria-label={`Brightness for ${snapshot.config.name}`}
          aria-valuetext={`${displayBrightness}%`}
        />
        <span className="w-9 text-right text-xs tabular-nums text-slate-400">{displayBrightness}%</span>
      </div>

      {(localError || snapshot.error) && (
        <div className="text-[11px] text-rose-300">{localError || snapshot.error}</div>
      )}
    </article>
  );
}
