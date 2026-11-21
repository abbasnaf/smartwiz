const PRESETS: Array<{ name: string; r: number; g: number; b: number; border?: string }> = [
  { name: 'Red', r: 255, g: 0, b: 0 },
  { name: 'Green', r: 0, g: 255, b: 0 },
  { name: 'Blue', r: 0, g: 0, b: 255 },
  { name: 'Purple', r: 128, g: 0, b: 255 },
  { name: 'Pink', r: 255, g: 105, b: 180 },
  { name: 'Orange', r: 255, g: 140, b: 0 },
  { name: 'Cyan', r: 0, g: 255, b: 255 },
  { name: 'Warm White', r: 255, g: 244, b: 229, border: 'rgba(255,255,255,0.25)' },
  { name: 'Cool White', r: 230, g: 243, b: 255, border: 'rgba(255,255,255,0.25)' },
];

export function PresetColors({ disabled, onSelect }: { disabled?: boolean; onSelect: (r: number, g: number, b: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Presets</div>
      <div className="grid grid-cols-9 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            title={p.name}
            aria-label={p.name}
            disabled={disabled}
            onClick={() => onSelect(p.r, p.g, p.b)}
            className="w-7 h-7 rounded-full border border-white/10 hover:scale-110 transition disabled:opacity-40 disabled:hover:scale-100"
            style={{ backgroundColor: `rgb(${p.r},${p.g},${p.b})`, borderColor: p.border }}
          />
        ))}
      </div>
    </div>
  );
}
