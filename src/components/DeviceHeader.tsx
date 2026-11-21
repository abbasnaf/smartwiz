import { ArrowLeft, Settings, Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { DeviceSnapshot } from '../../shared/types';

const statusLabel: Record<DeviceSnapshot['status'], string> = {
  connected: 'Connected',
  connecting: 'Connecting',
  disconnected: 'Disconnected',
  error: 'Error',
};

const statusColor: Record<DeviceSnapshot['status'], string> = {
  connected: 'text-emerald-400',
  connecting: 'text-amber-300',
  disconnected: 'text-slate-400',
  error: 'text-rose-400',
};

export function DeviceHeader({ snapshot, onOpenSettings, onBack }: { snapshot?: DeviceSnapshot; onOpenSettings: () => void; onBack?: () => void }) {
  const status = snapshot?.status ?? 'disconnected';
  const Icon = status === 'connected' ? Wifi : status === 'connecting' ? Loader2 : status === 'error' ? AlertCircle : WifiOff;
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-white/10">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
            aria-label="Back to devices"
            title="Back to devices"
          >
            <ArrowLeft size={17} />
          </button>
        )}
        <div className="min-w-0">
          <div className="text-sm text-slate-400">WiZ Controller</div>
          <div className="text-lg font-semibold truncate">{snapshot?.config.name ?? 'No device configured'}</div>
          <div className={`flex items-center gap-1.5 text-xs mt-1 ${statusColor[status]}`}>
            <Icon size={14} className={status === 'connecting' ? 'animate-spin' : ''} />
            <span>{statusLabel[status]}</span>
            {snapshot?.state?.state !== undefined && status !== 'disconnected' && (
              <span className="text-slate-400">• {snapshot.state.state ? 'On' : 'Off'}</span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onOpenSettings}
        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
        title="Settings"
        aria-label="Open settings"
      >
        <Settings size={18} />
      </button>
    </div>
  );
}
