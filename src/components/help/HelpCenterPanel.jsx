import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, BookOpen, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { helpGuideGroups } from '@/lib/helpGuideContent';

export default function HelpCenterPanel({ open, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return helpGuideGroups;
    return helpGuideGroups
      .map((group) => ({
        ...group,
        pages: group.pages.filter((p) => {
          const haystack = [p.title, p.summary, ...(p.details || [])].join(' ').toLowerCase();
          return haystack.includes(q) || group.group.toLowerCase().includes(q);
        }),
      }))
      .filter((group) => group.pages.length > 0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-navy text-white">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <div>
              <h2 className="font-semibold leading-tight">Help Center</h2>
              <p className="text-xs text-white/70">Guide to every page in PaySync PH</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              autoFocus
              placeholder="Search the guide..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              No guide entries match "{query}".
            </p>
          )}

          {filtered.map((group) => (
            <div key={group.group} className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-2">
                {group.group}
              </p>
              <div className="space-y-2">
                {group.pages.map((page) => (
                  <div key={page.path} className="rounded-xl border border-border p-3.5 hover:border-primary/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{page.title}</h3>
                      <Link
                        to={page.path}
                        onClick={onClose}
                        className="text-xs text-primary flex items-center gap-1 shrink-0 hover:underline"
                      >
                        Open <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{page.summary}</p>
                    <ul className="mt-2 space-y-1">
                      {(page.details || []).map((d, i) => (
                        <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}