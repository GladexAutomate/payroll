import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink } from 'lucide-react';

// One approved-schedule link entry with copy-to-clipboard and open actions.
export default function ScheduleLinkRow({ label, scope, value }) {
  const [copied, setCopied] = useState(false);
  const path = `/schedule/${encodeURIComponent(scope)}/${encodeURIComponent(value)}`;
  const fullUrl = `${window.location.origin}${path}`;

  const copy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/40">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{fullUrl}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link to={path}><ExternalLink className="w-4 h-4 mr-1" /> Open</Link>
        </Button>
      </div>
    </div>
  );
}