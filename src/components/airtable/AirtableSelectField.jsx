import { useState, useMemo, useRef, useEffect } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';

/**
 * Airtable-style dropdown for singleSelect / multipleSelects fields.
 * - Shows existing choices from Airtable schema
 * - Lets the user type to filter, and add a new option (sent via typecast=true)
 *
 * Props:
 *   value: string | string[]
 *   onChange: (newValue) => void
 *   choices: [{name, color}]
 *   multi: boolean
 */
export default function AirtableSelectField({ value, onChange, choices = [], multi = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  // Normalize value to array internally
  const selected = useMemo(() => {
    if (multi) return Array.isArray(value) ? value : (value ? [value] : []);
    return value ? [value] : [];
  }, [value, multi]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allChoiceNames = useMemo(() => choices.map(c => c.name), [choices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices;
    return choices.filter(c => c.name.toLowerCase().includes(q));
  }, [choices, query]);

  const queryMatchesExisting = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return allChoiceNames.some(n => n.toLowerCase() === q);
  }, [query, allChoiceNames]);

  const toggle = (name) => {
    if (multi) {
      const next = selected.includes(name)
        ? selected.filter(n => n !== name)
        : [...selected, name];
      onChange(next);
    } else {
      onChange(name);
      setOpen(false);
      setQuery('');
    }
  };

  const addNew = () => {
    const name = query.trim();
    if (!name) return;
    if (multi) {
      if (!selected.includes(name)) onChange([...selected, name]);
    } else {
      onChange(name);
      setOpen(false);
    }
    setQuery('');
  };

  const removeOne = (name, e) => {
    e.stopPropagation();
    if (multi) onChange(selected.filter(n => n !== name));
    else onChange('');
  };

  return (
    <div ref={ref} className="relative mt-1">
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        className="min-h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm cursor-pointer flex flex-wrap items-center gap-1 hover:bg-muted/30"
      >
        {selected.length === 0 && (
          <span className="text-muted-foreground text-xs px-1">Select...</span>
        )}
        {selected.map(name => (
          <span
            key={name}
            className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full"
          >
            {name}
            <button
              type="button"
              onClick={(e) => removeOne(name, e)}
              className="hover:bg-primary/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 bg-popover border border-border rounded-md shadow-lg overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Find or create option..."
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!queryMatchesExisting && query.trim()) addNew();
                  else if (filtered.length === 1) toggle(filtered[0].name);
                }
              }}
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(c => {
              const isSel = selected.includes(c.name);
              return (
                <div
                  key={c.name}
                  onClick={() => toggle(c.name)}
                  className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-muted cursor-pointer"
                >
                  <span className="truncate">{c.name}</span>
                  {isSel && <Check className="w-4 h-4 text-primary" />}
                </div>
              );
            })}
            {filtered.length === 0 && !query.trim() && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No options</div>
            )}
            {query.trim() && !queryMatchesExisting && (
              <div
                onClick={addNew}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted cursor-pointer border-t border-border text-primary"
              >
                <Plus className="w-4 h-4" />
                Create "{query.trim()}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}