import { Power } from 'lucide-react';

interface Props {
  on: boolean;
  disabled?: boolean;
  pending?: boolean;
  onChange: (on: boolean) => void;
  compact?: boolean;
  ariaLabel?: string;
}

export function PowerToggle({ on, disabled, pending, onChange, compact = false, ariaLabel = 'Toggle bulb power' }: Props) {
  return (
    <div className={compact ? 'shrink-0' : 'flex items-center justify-between gap-4'}>
      {!compact && (
        <div>
          <div className="text-sm font-medium">Power</div>
          <div className="text-xs text-slate-400">{pending ? 'Sending command...' : on ? 'Bulb is on' : 'Bulb is off'}</div>
        </div>
      )}
      <button
        role="switch"
        aria-checked={on}
        aria-label={ariaLabel}
        title={pending ? 'Sending command...' : undefined}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative ${compact ? 'w-12 h-7' : 'w-16 h-9'} rounded-full transition border ${on ? 'bg-indigo-500/90 border-indigo-300/40' : 'bg-white/10 border-white/10'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`absolute top-0.5 left-0.5 ${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-white shadow flex items-center justify-center transition-transform ${on ? compact ? 'translate-x-5 text-indigo-600' : 'translate-x-7 text-indigo-600' : 'translate-x-0 text-slate-500'}`}>
          <Power size={compact ? 13 : 16} />
        </span>
      </button>
    </div>
  );
}
