export function ColorTemperature({ value, disabled, onChange, onChangeEnd }: { value: number; disabled?: boolean; onChange: (v: number) => void; onChangeEnd?: (v: number) => void }) {
  const displayValue = Math.max(2200, Math.min(6500, value));
  const finishChange = (input: HTMLInputElement) => onChangeEnd?.(Number(input.value));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" htmlFor="temp">Color Temperature</label>
        <span className="text-xs text-slate-400">{displayValue}K</span>
      </div>
      <input
        id="temp"
        type="range"
        min={2200}
        max={6500}
        step={50}
        value={displayValue}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => finishChange(e.currentTarget)}
        onKeyUp={(e) => finishChange(e.currentTarget)}
        onBlur={(e) => finishChange(e.currentTarget)}
        className="range-control range-control--temperature w-full"
        aria-label="Color temperature in Kelvin"
        aria-valuetext={`${displayValue} Kelvin`}
      />
      <div className="flex justify-between text-[11px] text-slate-500"><span>Warm</span><span>Cool</span></div>
    </div>
  );
}
