import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, LoaderCircle, Pencil, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import type { DeviceSnapshot } from '../../shared/types';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { PowerToggle } from './PowerToggle';

interface Props {
  snapshot: DeviceSnapshot;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  confirmingRemoval: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
}

export function SettingsDeviceCard({
  snapshot,
  busy,
  canMoveUp,
  canMoveDown,
  confirmingRemoval,
  onRefresh,
  onEdit,
  onMoveUp,
  onMoveDown,
  onConfirmRemove,
  onCancelRemove,
  onRemove,
}: Props) {
  const [brightness, setBrightness] = useState(snapshot.state?.dimming ?? 100);
  const [powerBusy, setPowerBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const displayBrightness = Math.max(10, Math.min(100, brightness));
  const controlsDisabled = snapshot.status === 'disconnected' || (snapshot.status === 'error' && !snapshot.state);

  useEffect(() => {
    if (typeof snapshot.state?.dimming === 'number') setBrightness(snapshot.state.dimming);
  }, [snapshot.config.id, snapshot.state?.dimming]);

  const sendBrightness = useDebouncedCallback(async (value: number) => {
    try {
      await window.wiz.setBrightness(snapshot.config.id, value);
      setCommandError(null);
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error));
    }
  }, 250);

  const togglePower = async (on: boolean) => {
    setPowerBusy(true);
    try {
      await window.wiz.setPower(snapshot.config.id, on);
      setCommandError(null);
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error));
    } finally {
      setPowerBusy(false);
    }
  };

  const StatusIcon = snapshot.status === 'connected'
    ? Wifi
    : snapshot.status === 'connecting'
      ? LoaderCircle
      : snapshot.status === 'error'
        ? AlertCircle
        : WifiOff;
  const lastSeen = snapshot.lastUpdatedAt ?? snapshot.config.lastSeenAt;

  return (
    <article className="space-y-3 rounded-xl border border-white/[0.08] bg-slate-900/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusIcon
              size={15}
              className={`${snapshot.status === 'connected' ? 'text-emerald-400' : snapshot.status === 'connecting' ? 'animate-spin text-amber-300' : snapshot.status === 'error' ? 'text-rose-400' : 'text-slate-500'}`}
              aria-hidden="true"
            />
            <h5 className="truncate font-medium">{snapshot.config.name}</h5>
            <span className={`text-xs ${snapshot.status === 'connected' ? 'text-emerald-300' : snapshot.status === 'connecting' ? 'text-amber-300' : 'text-slate-400'}`}>
              {snapshot.status}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>IP {snapshot.config.ip}</span>
            {snapshot.config.mac && <span>MAC {snapshot.config.mac}</span>}
            {lastSeen && <span>Last seen {new Date(lastSeen).toLocaleString()}</span>}
            {typeof snapshot.state?.rssi === 'number' && <span>Signal {snapshot.state.rssi} dBm</span>}
          </div>
          {snapshot.error && <p role="status" className="mt-1 text-xs text-rose-300">{snapshot.error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-slate-400">{snapshot.state?.state ? 'On' : 'Off'}</span>
          <PowerToggle
            on={Boolean(snapshot.state?.state)}
            disabled={busy || powerBusy || controlsDisabled}
            pending={powerBusy || snapshot.pendingCommand}
            onChange={togglePower}
            compact
            ariaLabel={`Toggle ${snapshot.config.name} power`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor={`settings-brightness-${snapshot.config.id}`} className="w-16 shrink-0 text-xs text-slate-400">Brightness</label>
        <input
          id={`settings-brightness-${snapshot.config.id}`}
          type="range"
          min={10}
          max={100}
          value={displayBrightness}
          disabled={controlsDisabled}
          onChange={(event) => {
            const value = Number(event.target.value);
            setBrightness(value);
            sendBrightness(value);
          }}
          onPointerUp={sendBrightness.flush}
          onKeyUp={sendBrightness.flush}
          onBlur={sendBrightness.flush}
          style={{ '--range-progress': `${((displayBrightness - 10) / 90) * 100}%` } as CSSProperties}
          className="range-control range-control--brightness min-w-0 flex-1"
          aria-label={`Set brightness for ${snapshot.config.name}`}
          aria-valuetext={`${displayBrightness}%`}
        />
        <span className="w-9 text-right text-xs tabular-nums text-slate-400">{displayBrightness}%</span>
      </div>

      {commandError && <p role="alert" className="text-xs text-rose-300">{commandError}</p>}

      <div className="flex flex-wrap items-center justify-end gap-1 border-t border-white/10 pt-2">
        <button type="button" onClick={onRefresh} disabled={busy} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-40" title="Refresh device" aria-label={`Refresh ${snapshot.config.name}`}>
          <RefreshCw size={15} />
        </button>
        <button type="button" onClick={onEdit} disabled={busy} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-40" title="Edit device" aria-label={`Edit ${snapshot.config.name}`}>
          <Pencil size={15} />
        </button>
        <button type="button" onClick={onMoveUp} disabled={busy || !canMoveUp} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-40" title="Move up" aria-label={`Move ${snapshot.config.name} up`}>
          <ArrowUp size={15} />
        </button>
        <button type="button" onClick={onMoveDown} disabled={busy || !canMoveDown} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-40" title="Move down" aria-label={`Move ${snapshot.config.name} down`}>
          <ArrowDown size={15} />
        </button>
        <button
          type="button"
          onClick={onConfirmRemove}
          disabled={busy}
          className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/15 disabled:opacity-40"
          title="Remove device"
          aria-label={`Remove ${snapshot.config.name}`}
          aria-expanded={confirmingRemoval}
          aria-controls={`remove-confirm-${snapshot.config.id}`}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {confirmingRemoval && (
        <div id={`remove-confirm-${snapshot.config.id}`} role="group" aria-label={`Confirm removal of ${snapshot.config.name}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-400/20 bg-rose-500/10 p-2">
          <p className="text-xs text-rose-100">Remove {snapshot.config.name} from this app?</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancelRemove} className="rounded-lg px-2 py-1 text-xs hover:bg-white/10">Cancel</button>
            <button type="button" onClick={onRemove} disabled={busy} className="rounded-lg bg-rose-500/80 px-2 py-1 text-xs font-medium hover:bg-rose-500 disabled:opacity-50">
              {busy ? 'Removing…' : 'Remove device'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
