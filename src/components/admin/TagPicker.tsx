import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import type { TagRef } from '../../types';
import { getOrCreateTag, searchTags } from '../../services/tagService';
import { friendlyError } from '../../lib/errors';
import { slugify } from '../../utils/format';

interface Props {
  value: TagRef[];
  onChange: (tags: TagRef[]) => void;
  disabled?: boolean;
}

export function TagPicker({ value, onChange, disabled }: Props) {
  const id = useId();
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState<TagRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      searchTags(term, 8).then((r) => live && setOptions(r)).catch(() => live && setOptions([]));
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [term]);

  const selectedIds = new Set(value.map((t) => t.id));
  const add = (tag: TagRef) => {
    if (!selectedIds.has(tag.id)) onChange([...value, tag]);
    setTerm('');
  };
  const remove = (tagId: string) => onChange(value.filter((t) => t.id !== tagId));

  const exact = options.find((o) => o.slug === slugify(term));
  const canCreate = term.trim().length > 0 && slugify(term).length > 0 && !exact;

  const create = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    setError(null);
    try {
      add(await getOrCreateTag(term));
    } catch (e) {
      setError(friendlyError(e, 'Could not create that tag.'));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exact) add(exact); else void create();
    } else if (e.key === 'Backspace' && !term && value.length) {
      remove(value[value.length - 1].id);
    }
  };

  const available = options.filter((o) => !selectedIds.has(o.id));

  return (
    <div>
      <label htmlFor={id} className="label">Tags</label>
      <div className="input flex flex-wrap items-center gap-1.5 py-2">
        {value.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-mint/25 px-2.5 py-0.5 text-xs font-medium">
            #{t.name}
            <button type="button" onClick={() => remove(t.id)} disabled={disabled} aria-label={`Remove ${t.name}`} className="rounded-full hover:text-flame-soft">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
          maxLength={40}
          placeholder={value.length ? 'Add another' : 'Search or create tags'}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted/70"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {available.map((o) => (
          <button type="button" key={o.id} onClick={() => add(o)} disabled={disabled} className="tag-chip">#{o.name}</button>
        ))}
        {canCreate && (
          <button type="button" onClick={create} disabled={disabled || busy} className="tag-chip bg-flame/20 text-flame-soft">
            <Plus className="mr-0.5 h-3 w-3" /> Create “{term.trim()}”
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-[#ff8fb6]">{error}</p>}
    </div>
  );
}
