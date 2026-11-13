import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { OPPORTUNITY_TYPES } from '@shared/rules';
import type { OpportunityType, Priority } from '@shared/types';
import { createOpportunity } from '@/lib/actions';
import { useDb, useStore } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { Dialog } from '../ui/overlays';
import { Button } from '../ui/Button';
import { Checkbox, Field, Segmented, Select } from '../ui/primitives';
import { FacultyPicker } from './Pickers';
import { InfoNote } from '../domain';
import { ShieldCheck } from 'lucide-react';

const schema = z.object({
  title: z.string().trim().min(4, 'Give the opportunity a descriptive title (4+ characters).'),
  companyId: z.string().min(1, 'Choose a company.'),
  type: z.string().min(1),
  description: z.string().trim().min(10, 'Describe the opportunity in a sentence or two.'),
  amount: z.string().optional(),
  basis: z.string().optional(),
}).refine((v) => !v.amount || (!isNaN(Number(v.amount)) && Number(v.amount) > 0), { path: ['amount'], message: 'Enter a positive number.' })
  .refine((v) => !v.amount || (v.basis?.trim().length ?? 0) >= 5, { path: ['basis'], message: 'Explain where this estimate comes from.' });

export function NewOpportunityDialog() {
  const { newOpp, closeNewOpp } = useUI();
  const db = useDb();
  const userId = useStore((s) => s.userId);
  const navigate = useNavigate();
  const [f, setF] = useState({ title: '', companyId: '', interestId: '', type: 'sponsored-research' as OpportunityType, priority: 'medium' as Priority, ownerId: userId, description: '', facultyIds: [] as string[], nextAction: '', followUp: '', amount: '', basis: '', review: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!newOpp) return;
    setErrors({});
    setF({
      title: newOpp.title ?? '', companyId: newOpp.companyId ?? '', interestId: newOpp.interestId ?? '', type: newOpp.type ?? 'sponsored-research',
      priority: newOpp.priority ?? 'medium', ownerId: newOpp.ownerId ?? userId, description: newOpp.description ?? '', facultyIds: newOpp.facultyIds ?? [],
      nextAction: newOpp.nextAction ?? '', followUp: '', amount: '', basis: '', review: !!newOpp.requestReviewFor?.length,
    });
  }, [newOpp, userId]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const interests = Object.values(db.interests).filter((i) => i.companyId === f.companyId);

  const submit = async () => {
    const r = schema.safeParse(f);
    if (!r.success) { setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    setSaving(true);
    const id = await createOpportunity({
      title: f.title.trim(), companyId: f.companyId, interestId: f.interestId || undefined, type: f.type, priority: f.priority, ownerId: f.ownerId,
      description: f.description.trim(), facultyIds: f.facultyIds, nextAction: f.nextAction || undefined,
      followUp: f.followUp ? new Date(f.followUp + 'T12:00:00').toISOString() : undefined,
      estimatedValue: f.amount ? { amount: Number(f.amount), basis: f.basis.trim() } : undefined,
      matchSearchId: newOpp?.matchSearchId,
    }, { requestReviewFor: f.review ? f.facultyIds.filter((x) => newOpp?.requestReviewFor?.includes(x) ?? true) : [], reviewContext: newOpp?.reviewContext });
    setSaving(false);
    if (id) {
      const cb = newOpp?.onCreated;
      closeNewOpp();
      if (cb) cb(id); else navigate(`/opportunities/${id}`);
    }
  };

  return (
    <Dialog
      open={!!newOpp}
      onOpenChange={(o) => !o && closeNewOpp()}
      title="New opportunity"
      description="A specific engagement possibility between a company and the university."
      size="lg"
      footer={<><Button variant="ghost" onClick={closeNewOpp}>Cancel</Button><Button variant="primary" loading={saving} onClick={submit}>{f.review && f.facultyIds.length ? 'Create & send to review' : 'Create opportunity'}</Button></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title" required error={errors.title} className="col-span-2">
          <input className="input" autoFocus value={f.title} aria-invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Solid-state cells for long-duration storage" />
        </Field>
        <Field label="Company" required error={errors.companyId}>
          <Select value={f.companyId} onChange={(v) => { set('companyId', v); set('interestId', ''); }} placeholder="Choose a company…" options={Object.values(db.companies).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Related company interest" hint={f.companyId && !interests.length ? 'This company has no recorded interests yet.' : undefined}>
          <Select value={f.interestId} onChange={(v) => set('interestId', v)} placeholder="None" options={interests.map((i) => ({ value: i.id, label: i.title }))} />
        </Field>
        <Field label="Type" required className="col-span-2" hint={OPPORTUNITY_TYPES.find((t) => t.id === f.type)?.description}>
          <Select value={f.type} onChange={(v) => set('type', v)} options={OPPORTUNITY_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
        </Field>
        <Field label="Description" required error={errors.description} className="col-span-2">
          <textarea className="input" rows={3} value={f.description} aria-invalid={!!errors.description} onChange={(e) => set('description', e.target.value)} placeholder="What does the company want, and why now?" />
        </Field>
        <Field label="Researchers" className="col-span-2">
          <FacultyPicker value={f.facultyIds} onChange={(v) => set('facultyIds', v)} />
        </Field>
        <Field label="Priority"><Segmented value={f.priority} onChange={(v) => set('priority', v)} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} /></Field>
        <Field label="Relationship owner">
          <Select value={f.ownerId} onChange={(v) => set('ownerId', v)} options={Object.values(db.users).filter((u) => u.team !== 'Project Team').map((u) => ({ value: u.id, label: u.name }))} />
        </Field>
        <Field label="Next action"><input className="input" value={f.nextAction} onChange={(e) => set('nextAction', e.target.value)} placeholder="e.g. Discovery call with R&D lead" /></Field>
        <Field label="Follow-up date"><input type="date" className="input" value={f.followUp} onChange={(e) => set('followUp', e.target.value)} /></Field>
        <Field label="Estimated value (optional)" error={errors.amount} hint="Only when justified by a real figure.">
          <input className="input" inputMode="numeric" value={f.amount} aria-invalid={!!errors.amount} onChange={(e) => set('amount', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="USD" />
        </Field>
        <Field label="Basis for estimate" error={errors.basis}>
          <input className="input" value={f.basis} disabled={!f.amount} aria-invalid={!!errors.basis} onChange={(e) => set('basis', e.target.value)} placeholder="e.g. Budget stated by company on 10/12 call" />
        </Field>
        {f.facultyIds.length > 0 && (
          <div className="col-span-2 space-y-2">
            <Checkbox checked={f.review} onChange={(v) => set('review', v)} label="Send these researchers to the review queue now" description="Creates one review item per researcher and moves the opportunity to Internal review." />
            <InfoNote icon={<ShieldCheck />} tone="accent">Nothing is sent to faculty or the company. A reviewer must approve before an introduction can even be drafted.</InfoNote>
          </div>
        )}
      </div>
    </Dialog>
  );
}
