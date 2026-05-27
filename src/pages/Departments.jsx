import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [depts, emps] = await Promise.all([
      base44.entities.Department.list(),
      base44.entities.Employee.filter({ status: 'active' })
    ]);
    setDepartments(depts);
    setEmployees(emps);
    setLoading(false);
  };

  const empCount = departments.reduce((m, d) => ({
    ...m,
    [d.id]: employees.filter(e => e.department_id === d.id).length
  }), {});

  const handleSave = async (data) => {
    if (editing) await base44.entities.Department.update(editing.id, data);
    else await base44.entities.Department.create(data);
    setShowForm(false); setEditing(null); loadData();
  };

  const handleDelete = async (id) => {
    await base44.entities.Department.delete(id);
    loadData();
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Department
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />)
        ) : departments.map(dept => (
          <div key={dept.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{dept.name}</p>
                  {dept.code && <p className="text-xs text-muted-foreground">{dept.code}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(dept); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(dept.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {dept.description && <p className="text-xs text-muted-foreground mt-3">{dept.description}</p>}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{empCount[dept.id] || 0} employees</span>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <DeptForm dept={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function DeptForm({ dept, onSave, onClose }) {
  const [form, setForm] = useState({ name: dept?.name || '', code: dept?.code || '', description: dept?.description || '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">{dept ? 'Edit' : 'Add'} Department</h3>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="p-5 space-y-3">
          <div><Label>Name*</Label><Input value={form.name} onChange={e => set('name', e.target.value)} required className="mt-1" /></div>
          <div><Label>Code</Label><Input value={form.code} onChange={e => set('code', e.target.value)} className="mt-1" placeholder="e.g. IT, HR, FIN" /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={e => set('description', e.target.value)} className="mt-1" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}