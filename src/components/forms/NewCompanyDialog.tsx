import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import type { CompanySize } from '@shared/types';
import { createCompany } from '@/lib/actions';
import { useDb } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { Dialog } from '../ui/overlays';
import { Button } from '../ui/Button';
import { Field, Segmented } from '../ui/primitives';

const schema = z.object({
  name: z.string().trim().min(2, 'Company name is required.'),
  industry: z.string().trim().min(2, 'Industry is required.'),
  description: z.string().trim().min(10, 'Add a one-sentence description.'),
  website: z.string().trim().optional().refine((v) => !v || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v.replace(/^https?:\/\//, '')), 'Enter a domain like example.com'),
});

export function NewCompanyDialog() {
  const { newCompany, setNewCompany } = useUI();
  const db = useDb();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', industry: '', description: '', website: '', hq: '', size: 'mid-size' as CompanySize });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dup = f.name.trim().length > 2 ? Object.values(db.companies).find((c) => c.name.toLowerCase().includes(f.name.trim().toLowerCase()) || f.name.trim().toLowerCase().includes(c.name.toLowerCase())) : undefined;
  const submit = async () => {
    const r = schema.safeParse(f);
    if (!r.success) { setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    const id = await createCompany({ ...f, website: f.website || undefined, hq: f.hq || undefined });
    if (id) { setNewCompany(false); setF({ name: '', industry: '', description: '', website: '', hq: '', size: 'mid-size' }); navigate(`/companies/${id}`); }
  };
  return (
    <Dialog open={newCompany} onOpenChange={setNewCompany} title="Add a company" description="Manually entered records are attributed to you and marked as staff-entered."
      footer={<><Button variant="ghost" onClick={() => setNewCompany(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Add company</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" required error={errors.name} className="col-span-2" hint={dup ? <span className="text-warn">Possible duplicate: {dup.name}</span> : undefined}>
          <input autoFocus className="input" value={f.name} aria-invalid={!!errors.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Industry" required error={errors.industry}><input className="input" value={f.industry} aria-invalid={!!errors.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} placeholder="e.g. Energy storage" /></Field>
        <Field label="Website" error={errors.website}><input className="input" value={f.website} aria-invalid={!!errors.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="example.com" /></Field>
        <Field label="Headquarters"><input className="input" value={f.hq} onChange={(e) => setF({ ...f, hq: e.target.value })} placeholder="City, State" /></Field>
        <Field label="Size"><Segmented value={f.size} onChange={(v) => setF({ ...f, size: v })} options={[{ value: 'startup', label: 'Startup' }, { value: 'mid-size', label: 'Mid-size' }, { value: 'enterprise', label: 'Enterprise' }]} /></Field>
        <Field label="Description" required error={errors.description} className="col-span-2">
          <textarea className="input" rows={3} value={f.description} aria-invalid={!!errors.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What the company does and why it might engage with the university." />
        </Field>
      </div>
    </Dialog>
  );
}
