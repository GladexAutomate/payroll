import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, Image as ImageIcon, Sparkles, X, Loader2 } from 'lucide-react';

export default function BranchBrandingModal({ branch, branding, onClose, onSaved }) {
  const [logoUrl, setLogoUrl] = useState(branding?.logo_url || '');
  const [colors, setColors] = useState({
    primary_color: branding?.primary_color || '#0f172a',
    secondary_color: branding?.secondary_color || '#1e3a8a',
    accent_color: branding?.accent_color || '#2563eb',
    text_on_primary: branding?.text_on_primary || '#ffffff',
  });
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please drop an image file (PNG, JPG, SVG).', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setLogoUrl(file_url);
    setUploading(false);
    // Auto-generate branding right after upload
    await generateBranding(file_url);
  };

  const generateBranding = async (url) => {
    const target = url || logoUrl;
    if (!target) return;
    setGenerating(true);
    const res = await base44.functions.invoke('generateBrandingFromLogo', { logo_url: target });
    setGenerating(false);
    if (res.data?.success) {
      setColors(res.data.branding);
      toast({ title: 'Branding generated', description: 'AI created a brand palette from the logo.' });
    } else {
      toast({ title: 'AI branding failed', description: res.data?.error || 'Could not analyze logo.', variant: 'destructive' });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const save = async () => {
    setSaving(true);
    const data = {
      branch_id: branch.id,
      branch_name: branch.name,
      company_name: branch.company_name || '',
      logo_url: logoUrl,
      ...colors,
    };
    if (branding?.id) await base44.entities.BranchBranding.update(branding.id, data);
    else await base44.entities.BranchBranding.create(data);
    setSaving(false);
    toast({ title: 'Branding saved', description: `${branch.name} payslips will use this branding.` });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">Branch Branding — {branch.name}</h3>
            <p className="text-sm text-muted-foreground">Drop a logo and AI generates payslip branding automatically.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50'}`}
        >
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          {uploading ? (
            <><Loader2 className="w-6 h-6 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Uploading logo...</p></>
          ) : logoUrl ? (
            <img src={logoUrl} alt="logo" className="max-h-24 object-contain" />
          ) : (
            <><UploadCloud className="w-7 h-7 text-muted-foreground" /><p className="text-sm font-medium">Drag & drop logo here</p><p className="text-xs text-muted-foreground">or click to browse</p></>
          )}
        </div>

        {logoUrl && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => generateBranding()} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {generating ? 'Analyzing logo...' : 'Regenerate AI Branding'}
          </Button>
        )}

        {/* Color editors */}
        <div className="grid grid-cols-2 gap-3">
          {[
            ['primary_color', 'Header Primary'],
            ['secondary_color', 'Header Gradient'],
            ['accent_color', 'Accent'],
            ['text_on_primary', 'Header Text'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={colors[key]} onChange={(e) => setColors(c => ({ ...c, [key]: e.target.value }))} className="h-9 w-10 rounded border border-input bg-transparent cursor-pointer" />
                <input value={colors[key]} onChange={(e) => setColors(c => ({ ...c, [key]: e.target.value }))} className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs font-mono uppercase" />
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="rounded-lg overflow-hidden border border-border">
          <div className="flex items-center justify-between p-3" style={{ background: `linear-gradient(to right, ${colors.primary_color}, ${colors.secondary_color})`, color: colors.text_on_primary }}>
            <div className="flex items-center gap-2">
              {logoUrl ? <img src={logoUrl} alt="" className="h-7 w-7 object-contain rounded bg-white/90 p-0.5" /> : <ImageIcon className="w-6 h-6 opacity-70" />}
              <div>
                <p className="text-xs font-bold uppercase">{branch.company_name || 'Company'}</p>
                <p className="text-[10px] opacity-80">Payslip preview</p>
              </div>
            </div>
            <span className="h-2.5 w-8 rounded-full" style={{ background: colors.accent_color }} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || uploading}>{saving ? 'Saving...' : 'Save Branding'}</Button>
        </div>
      </div>
    </div>
  );
}