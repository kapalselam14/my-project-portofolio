// Small reusable controls: toggle switch + status chip.

// Small on/off switch.
export function Toggle({
  checked,
  onChange,
  size = 'sm',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
}) {
  // Stop row-level click handlers from treating a switch toggle as a row selection.
  const w = size === 'md' ? 'w-11 h-6' : 'w-8 h-4';
  const t = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  const on = size === 'md' ? 'translate-x-6' : 'translate-x-4';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex ${w} shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 ${checked ? 'bg-brand-500' : 'bg-ink-300'}`}
    >
      <span
        className={`inline-block ${t} transform rounded-full bg-white shadow transition-transform ${checked ? on : 'translate-x-1'}`}
      />
    </button>
  );
}

// Surface chip.
export function SurfaceChip({
  label,
  active,
  tooltip,
}: {
  label: string;
  active: boolean;
  tooltip: string;
}) {
  // Show whether this surface is enabled and explain its meaning on hover.
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-400'}`}
    >
      {label}
    </span>
  );
}
