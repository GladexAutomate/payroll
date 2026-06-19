import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, UserPlus } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Identity',
    fields: [
      { key: 'First Name', label: 'First Name', required: true },
      { key: 'Middle Name', label: 'Middle Name' },
      { key: 'Last Name', label: 'Last Name', required: true },
      { key: 'Gender', label: 'Gender' },
      { key: 'Birthday', label: 'Birthday', type: 'date' },
      { key: 'Citizen Status', label: 'Civil Status' },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { key: 'Email', label: 'Email', type: 'email' },
      { key: 'Mobile Number', label: 'Mobile Number', type: 'tel' },
      { key: 'Address', label: 'Address', full: true },
      { key: 'Emergency Contact Name', label: 'Emergency Contact Name' },
      { key: 'Emergency Contact Number', label: 'Emergency Contact Number', type: 'tel' },
      { key: 'Emergency Contact Relationship', label: 'Emergency Contact Relationship' },
    ],
  },
  {
    title: 'Government IDs',
    fields: [
      { key: 'SSS Number', label: 'SSS Number' },
      { key: 'PhilHealth Number', label: 'PhilHealth Number' },
      { key: 'Pag-IBIG Number', label: 'Pag-IBIG Number' },
      { key: 'TIN', label: 'TIN' },
    ],
  },
];

export default function Onboard() {
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const setField = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('airtableEmployees', { action: 'publicOnboard', fields: values });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-xl border border-border max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-semibold">Thank you!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your information has been submitted. HR will be in touch soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Employee Form</h1>
            <p className="text-sm text-muted-foreground">Please fill out your basic details below.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {SECTIONS.map(section => (
            <div key={section.title} className="bg-card rounded-2xl shadow-sm border border-border p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.fields.map(f => (
                  <div key={f.key} className={f.full ? 'md:col-span-2' : ''}>
                    <Label className="text-xs font-medium">
                      {f.label}{f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <Input
                      type={f.type || 'text'}
                      value={values[f.key] || ''}
                      onChange={e => setField(f.key, e.target.value)}
                      required={f.required}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full h-11 text-base">
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit'}
          </Button>
        </form>
      </div>
    </div>
  );
}