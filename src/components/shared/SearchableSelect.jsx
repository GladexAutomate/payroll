import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

/**
 * Reusable dropdown. When there are 10+ options a search box is shown automatically.
 * options: [{ value, label }]
 *
 * APP RULE: Use this for any dropdown that may hold 10+ records so it stays searchable.
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  required = false,
  className = '',
  searchThreshold = 10,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  const showSearch = options.length >= searchThreshold;
  const selected = options.find(o => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => (o.label || '').toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (open && showSearch) setTimeout(() => searchRef.current?.focus(), 0);
    if (!open) setQuery('');
  }, [open, showSearch]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm bg-card text-left"
      >
        <span className={selected ? '' : 'text-muted-foreground'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {required && <input tabIndex={-1} aria-hidden className="sr-only" value={value || ''} onChange={() => {}} required />}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {showSearch && (
            <div className="p-2 border-b border-border sticky top-0 bg-card">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full border border-border rounded-md pl-8 pr-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
            ) : filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-accent ${String(o.value) === String(value) ? 'bg-accent/60 font-medium' : ''}`}
              >
                <span>{o.label}</span>
                {String(o.value) === String(value) && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}