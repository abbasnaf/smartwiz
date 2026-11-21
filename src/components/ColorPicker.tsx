function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export function ColorPicker({ r, g, b, disabled, onChange }: { r: number; g: number; b: number; disabled?: boolean; onChange: (r: number, g: number, b: number) => void }) {
  const hex = rgbToHex(r, g, b);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" htmlFor="color-picker">Color</label>
        <span className="text-xs text-slate-400">{hex.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id="color-picker"
          type="color"
          value={hex}
          disabled={disabled}
          onChange={(e) => {
            const rgb = hexToRgb(e.target.value);
            if (rgb) onChange(rgb.r, rgb.g, rgb.b);
          }}
          className="w-12 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer disabled:opacity-40"
          aria-label="RGB color picker"
        />
        <div className="flex-1 text-xs text-slate-400">Pick any RGB color for the bulb.</div>
      </div>
    </div>
  );
}
