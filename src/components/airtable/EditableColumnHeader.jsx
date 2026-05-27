import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';

/**
 * Header cell with click-to-rename support.
 */
export default function EditableColumnHeader({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setValue(name); }, [name]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setSaving(true);
    try {
      await onRename(name, trimmed);
      setEditing(false);
    } catch {
      setValue(name);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setValue(name);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          className="text-xs uppercase font-medium bg-card border border-primary rounded px-1 py-0.5 outline-none min-w-[100px]"
          disabled={saving}
        />
        <button onClick={handleSave} disabled={saving} className="p-0.5 rounded hover:bg-primary/10 text-primary">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </button>
        <button onClick={handleCancel} disabled={saving} className="p-0.5 rounded hover:bg-muted">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span>{name}</span>
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-opacity"
        title="Rename column"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}