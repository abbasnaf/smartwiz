import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { useAppStore } from '../store/device-store';
import { DeviceHeader } from '../components/DeviceHeader';
import { DeviceListItem } from '../components/DeviceListItem';
import { PowerToggle } from '../components/PowerToggle';
import { ColorPicker } from '../components/ColorPicker';
import { PresetColors } from '../components/PresetColors';
import { ColorTemperature } from '../components/ColorTemperature';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';

export function QuickControls() {
  const snapshots = useAppStore((s) => s.snapshots);
  const loading = useAppStore((s) => s.loading);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [temp, setTemp] = useState(4000);
  const [rgb, setRgb] = useState({ r: 255, g: 255, b: 255 });
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const snapshot = snapshots.find((item) => item.config.id === selectedDeviceId);

  useEffect(() => {
    if (!snapshot?.state) return;
    if (typeof snapshot.state.temp === 'number') setTemp(snapshot.state.temp);
    if (typeof snapshot.state.r === 'number' && typeof snapshot.state.g === 'number' && typeof snapshot.state.b === 'number') {
      setRgb({ r: snapshot.state.r, g: snapshot.state.g, b: snapshot.state.b });
    }
  }, [snapshot?.state?.temp, snapshot?.state?.r, snapshot?.state?.g, snapshot?.state?.b, snapshot?.config.id]);

  const disabled = !snapshot || snapshot.status === 'disconnected' || (snapshot.status === 'error' && !snapshot.state);

  const sendRgb = useDebouncedCallback(async (id: string, r: number, g: number, b: number) => {
    try { await window.wiz.setRgb(id, r, g, b); setLocalError(null); }
    catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
  }, 250);

  const sendTemp = useDebouncedCallback(async (id: string, value: number) => {
    try { await window.wiz.setTemp(id, value); setLocalError(null); }
    catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
  }, 250);

  const onPower = async (on: boolean) => {
    if (!snapshot) return;
    setBusy(true);
    try { await window.wiz.setPower(snapshot.config.id, on); setLocalError(null); }
    catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const onRgb = (r: number, g: number, b: number) => {
    setRgb({ r, g, b });
    if (snapshot) sendRgb(snapshot.config.id, r, g, b);
  };
  const onTemp = (value: number) => {
    setTemp(value);
    if (snapshot) sendTemp(snapshot.config.id, value);
  };

  const lastUpdated = snapshot?.lastUpdatedAt ? new Date(snapshot.lastUpdatedAt).toLocaleTimeString() : null;

  return (
    <div className="popup-shell">
      <div className="popup-card flex flex-col">
        {snapshot ? (
          <>
            <DeviceHeader
              snapshot={snapshot}
              onOpenSettings={() => window.wiz.openSettings()}
              onBack={() => { setSelectedDeviceId(null); setLocalError(null); }}
            />
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain px-4 py-4 space-y-5">
              <PowerToggle on={Boolean(snapshot.state?.state)} disabled={busy || disabled} pending={busy || snapshot.pendingCommand} onChange={onPower} />
              <ColorPicker r={rgb.r} g={rgb.g} b={rgb.b} disabled={disabled} onChange={onRgb} />
              <PresetColors disabled={disabled} onSelect={onRgb} />
              <ColorTemperature value={temp} disabled={disabled} onChange={onTemp} onChangeEnd={sendTemp.flush} />
              {(localError || snapshot.error) && (
                <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-xl p-2 flex gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{localError || snapshot.error}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>{lastUpdated ? `Updated ${lastUpdated}` : 'Not yet updated'}</span>
                <button
                  onClick={() => window.wiz.refreshDevice(snapshot.config.id)}
                  className="inline-flex items-center gap-1 hover:text-slate-300"
                  aria-label="Refresh device state"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
              <div>
                <h1 className="text-lg font-semibold">Devices</h1>
                <div className="mt-0.5 text-xs text-slate-400">
                  {snapshots.filter((item) => item.status === 'connected').length} of {snapshots.length} connected
                </div>
              </div>
              <button
                onClick={() => window.wiz.openSettings()}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
                title="Settings"
                aria-label="Open settings"
              >
                <Settings size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain px-4 py-4 space-y-3">
              {loading ? (
                <div className="text-sm text-slate-400">Loading devices…</div>
              ) : snapshots.length ? (
                snapshots.map((device) => (
                  <DeviceListItem
                    key={device.config.id}
                    snapshot={device}
                    onSelect={() => {
                      setTemp(device.state?.temp ?? 4000);
                      setRgb({
                        r: device.state?.r ?? 255,
                        g: device.state?.g ?? 255,
                        b: device.state?.b ?? 255,
                      });
                      setLocalError(null);
                      setSelectedDeviceId(device.config.id);
                    }}
                  />
                ))
              ) : (
                <div className="text-sm text-slate-300 space-y-3">
                  <p>No WiZ bulbs configured yet.</p>
                  <button onClick={() => window.wiz.openSettings()} className="px-3 py-2 rounded-xl bg-indigo-500/90 hover:bg-indigo-500 text-white text-sm">Open Settings</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
