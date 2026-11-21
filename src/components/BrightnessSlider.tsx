import type { CSSProperties } from 'react';

interface Props {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
}

export function BrightnessSlider({ value, disabled, onChange, onChangeEnd }: Props) {
  const displayValue = Math.max(10, Math.min(100, value));
  const finishChange = (input: HTMLInputElement) => onChangeEnd?.(Number(input.value));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" htmlFor="brightness">Brightness</label>
        <span className="text-xs text-slate-400">{displayValue}%</span>
      </div>
      <input
        id="brightness"
        type="range"
        min={10}
        max={100}
        value={displayValue}
        disabled={disabled}
        style={{ '--range-progress': `${((displayValue - 10) / 90) * 100}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => finishChange(e.currentTarget)}
        onKeyUp={(e) => finishChange(e.currentTarget)}
        onBlur={(e) => finishChange(e.currentTarget)}
        className="range-control range-control--brightness w-full"
        aria-label="Brightness"
        aria-valuetext={`${displayValue}%`}
      />
    </div>
  );
}
