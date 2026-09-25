interface Option<T extends string> {
  value: T;
  label: string;
}

/** Accessible segmented control (a group of toggle buttons). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'px-3 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm';
  return (
    <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full bg-ink-2 p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`shrink-0 rounded-full font-medium transition-colors ${pad} ${value === o.value ? 'bg-fg text-ink' : 'text-muted hover:text-fg'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const MEDIA_FILTERS: { value: 'all' | 'video' | 'image'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'image', label: 'Photos' },
];
