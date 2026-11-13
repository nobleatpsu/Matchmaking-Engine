/**
 * Manual data entry. Every save:
 *  - is validated by the server against shared/schemas.ts
 *  - marks changed fields with provenance `src-manual`, so later automated
 *    syncs raise a conflict instead of silently overwriting what a person typed
 */
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Company, Faculty, IPRecord, Project, Provenance, Publication, SourceRef } from '@shared/types';
import { useDb, useStore } from '@/lib/store';
import { nowIso, uid } from '@/lib/format';
import { Dialog } from '../ui/overlays';
import { Button } from '../ui/Button';
import { Checkbox, Field, Segmented, Select } from '../ui/primitives';
import { FacultyPicker, TopicChips, TopicPicker } from './Pickers';

const manualSource = (who: string): SourceRef => ({ sourceId: 'src-manual', label: `Entered by ${who}`, retrievedAt: nowIso() });

/** Provenance for fields that differ between before and after. */
function manualProvenance(before: Record<string, unknown> | undefined, after: Record<string, unknown>): Provenance {
  const prov: Provenance = { ...((before?.provenance as Provenance) ?? {}) };
  for (const [k, v] of Object.entries(after)) {
    if (['id', 'provenance', 'sources', 'source', 'saved'].includes(k)) continue;
    if (JSON.stringify(before?.[k]) !== JSON.stringify(v)) prov[k] = { sourceId: 'src-manual', at: nowIso() };
  }
  return prov;
}

function useSave() {
  const commit = useStore((s) => s.commit);
  const me = useStore((s) => s.db!.users[s.userId]);
  return { commit, who: me?.name ?? 'staff' };
}

const errorsOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? {} : Object.fromEntries(r.error!.issues.map((i) => [String(i.path[0]), i.message]));

/* ------------------------------------------------------------------ */

const facultyForm = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  departmentId: z.string().min(1, 'Choose a department.'),
  email: z.string().trim().refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Enter a valid email or leave blank.'),
  labSize: z.string().refine((v) => !v || (/^\d+$/.test(v) && Number(v) < 1000), 'Whole number.'),
});

export function FacultyDialog({ open, onClose, faculty }: { open: boolean; onClose: (id?: string) => void; faculty?: Faculty }) {
  const db = useDb();
  const { commit, who } = useSave();
  const blank = { name: '', title: '', departmentId: '', email: '', emailVerified: false, profileUrl: '', orcid: '', summary: '', expertise: [] as string[], keywords: '', labName: '', labSize: '', availability: 'unknown' as Faculty['availability'], research: false, talent: false, engagement: false, verifiedNow: true };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    const iv = (p: string) => !!faculty?.interests.find((i) => i.pathway === p && i.verified);
    setF(faculty ? {
      name: faculty.name, title: faculty.title, departmentId: faculty.departmentId, email: faculty.email ?? '', emailVerified: faculty.emailVerified, profileUrl: faculty.profileUrl ?? '',
      orcid: faculty.externalIds?.orcid ?? '', summary: faculty.summary, expertise: faculty.expertise, keywords: faculty.keywords.join(', '), labName: faculty.labName ?? '',
      labSize: faculty.labSize?.toString() ?? '', availability: faculty.availability, research: iv('research'), talent: iv('talent'), engagement: iv('engagement'), verifiedNow: true,
    } : blank);
  }, [open, faculty]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const r = facultyForm.safeParse(f);
    if (!r.success) { setErrors(errorsOf(r)); return; }
    const interests = (['research', 'talent', 'engagement'] as const).map((p) => {
      const existing = faculty?.interests.find((i) => i.pathway === p);
      if (f[p]) return { pathway: p, note: existing?.note || 'Confirmed by staff.', verified: true };
      return existing && !existing.verified ? existing : null;
    }).filter((x): x is NonNullable<typeof x> => !!x);
    const next: Faculty = {
      ...(faculty ?? { id: uid('f'), sources: [], coverageNotes: [] }),
      name: f.name.trim(), title: f.title.trim() || 'Faculty', departmentId: f.departmentId, email: f.email.trim() || undefined, emailVerified: f.emailVerified,
      profileUrl: f.profileUrl.trim() || undefined, summary: f.summary.trim(), expertise: f.expertise, keywords: f.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      labName: f.labName.trim() || undefined, labSize: f.labSize ? Number(f.labSize) : undefined, availability: f.availability, interests,
      externalIds: { ...(faculty?.externalIds ?? {}), ...(f.orcid.trim() ? { orcid: f.orcid.trim() } : {}) },
      lastVerified: f.verifiedNow ? nowIso() : faculty?.lastVerified,
    } as Faculty;
    next.provenance = manualProvenance(faculty as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>);
    next.sources = [...(faculty?.sources ?? []).filter((s) => s.sourceId !== 'src-manual'), manualSource(who)];
    if (f.verifiedNow) next.coverageNotes = (next.coverageNotes ?? []).filter((n) => !/not yet verified/i.test(n));
    if (await commit([{ op: 'put', collection: 'faculty', record: next as never }], { success: faculty ? 'Profile updated' : 'Researcher added' })) onClose(next.id);
  };

  const depts = Object.values(db.departments).sort((a, b) => a.college.localeCompare(b.college) || a.name.localeCompare(b.name));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} size="lg" title={faculty ? `Edit ${faculty.name}` : 'Add a researcher'} description="Fields you change here are marked as staff-entered and protected from automatic overwrites."
      footer={<><Button variant="ghost" onClick={() => onClose()}>Cancel</Button><Button variant="primary" onClick={save}>{faculty ? 'Save changes' : 'Add researcher'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" required error={errors.name}><input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Title"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Associate Professor" /></Field>
        <Field label="Department" required error={errors.departmentId} className="col-span-2">
          <Select value={f.departmentId} onChange={(v) => set('departmentId', v)} placeholder="Choose a department…" options={depts.map((d) => ({ value: d.id, label: `${d.name} — ${d.college}` }))} />
        </Field>
        <Field label="Email" error={errors.email}><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="ORCID" hint="Lets data providers (e.g. OpenAlex) find publications."><input className="input" value={f.orcid} onChange={(e) => set('orcid', e.target.value)} placeholder="0000-0000-0000-0000" /></Field>
        <div className="col-span-2"><Checkbox checked={f.emailVerified} onChange={(v) => set('emailVerified', v)} label="Contact details verified" description="Only tick after confirming with the department or the researcher." /></div>
        <Field label="Profile URL" className="col-span-2"><input className="input" value={f.profileUrl} onChange={(e) => set('profileUrl', e.target.value)} /></Field>
        <Field label="Research summary" className="col-span-2"><textarea className="input" rows={3} value={f.summary} onChange={(e) => set('summary', e.target.value)} /></Field>
        <Field label="Areas of expertise" className="col-span-2" hint="Taxonomy concepts the matcher uses directly.">
          <div className="flex flex-wrap items-center gap-1"><TopicChips ids={f.expertise} onRemove={(t) => set('expertise', f.expertise.filter((x) => x !== t))} /><TopicPicker size="sm" value={f.expertise} onChange={(v) => set('expertise', v)} /></div>
        </Field>
        <Field label="Keywords" className="col-span-2" hint="Comma separated, as the researcher describes their work."><input className="input" value={f.keywords} onChange={(e) => set('keywords', e.target.value)} /></Field>
        <Field label="Lab / group name"><input className="input" value={f.labName} onChange={(e) => set('labName', e.target.value)} /></Field>
        <Field label="Group size" error={errors.labSize}><input className="input" inputMode="numeric" value={f.labSize} onChange={(e) => set('labSize', e.target.value)} /></Field>
        <Field label="Availability" className="col-span-2"><Segmented value={f.availability} onChange={(v) => set('availability', v)} options={[{ value: 'unknown', label: 'Unknown' }, { value: 'open', label: 'Open' }, { value: 'limited', label: 'Limited' }, { value: 'unavailable', label: 'Unavailable' }]} /></Field>
        <div className="col-span-2 space-y-2 rounded-md bg-canvas p-3 ring-1 ring-line/70">
          <div className="text-xs font-semibold text-ink-2">Confirmed collaboration interests</div>
          <Checkbox checked={f.research} onChange={(v) => set('research', v)} label="Sponsored research" />
          <Checkbox checked={f.talent} onChange={(v) => set('talent', v)} label="Recruiting / student pipeline" />
          <Checkbox checked={f.engagement} onChange={(v) => set('engagement', v)} label="Events and engagement" />
        </div>
        <div className="col-span-2"><Checkbox checked={f.verifiedNow} onChange={(v) => set('verifiedNow', v)} label="Mark profile as verified today" /></div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

type ResearchKind = 'project' | 'publication' | 'ip';

export function ResearchDialog({ kind, open, onClose, facultyId, record }: { kind: ResearchKind; open: boolean; onClose: () => void; facultyId?: string; record?: Project | Publication | IPRecord }) {
  const { commit, who } = useSave();
  const [f, setF] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    setErr('');
    setF(record ? { ...record } : { facultyIds: facultyId ? [facultyId] : [], topics: [], status: kind === 'project' ? 'active' : 'unknown', licensing: 'unknown', year: new Date().getFullYear() });
  }, [open, record, facultyId, kind]);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const s = (k: string) => (f[k] as string | undefined) ?? '';
  const dateIn = (k: string) => (s(k) ? s(k).slice(0, 10) : '');
  const dateOut = (v: string) => (v ? new Date(v + 'T12:00:00').toISOString() : undefined);

  const save = async () => {
    if (!s('title').trim()) return setErr('Title is required.');
    if (!(f.facultyIds as string[])?.length) return setErr('Link at least one researcher.');
    if (kind === 'publication' && !(Number(f.year) > 1900)) return setErr('Enter a valid year.');
    const src = manualSource(who);
    const base = { ...f, id: (f.id as string) ?? uid(kind === 'project' ? 'p' : kind === 'publication' ? 'pub' : 'ip'), title: s('title').trim(), source: (record as { source?: SourceRef })?.source ?? src };
    const rec = kind === 'project'
      ? { description: '', ...base }
      : kind === 'publication'
        ? { venue: '', ...base, year: Number(f.year) }
        : { summary: '', applications: [], linkedInterestIds: [], verified: false, ...base };
    (rec as Record<string, unknown>).provenance = manualProvenance(record as unknown as Record<string, unknown>, rec);
    const coll = kind === 'project' ? 'projects' : kind === 'publication' ? 'publications' : 'ip';
    if (await commit([{ op: 'put', collection: coll, record: rec as never }], { success: record ? 'Saved' : 'Added' })) onClose();
  };

  const title = { project: 'project', publication: 'publication', ip: 'IP record' }[kind];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} size="lg" title={record ? `Edit ${title}` : `Add a ${title}`}
      footer={<>{err && <span className="mr-auto text-sm text-bad">{err}</span>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title" required className="col-span-2"><input className="input" autoFocus value={s('title')} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Researchers" required className="col-span-2"><FacultyPicker value={(f.facultyIds as string[]) ?? []} onChange={(v) => set('facultyIds', v)} /></Field>
        {kind === 'project' && <>
          <Field label="Description" className="col-span-2"><textarea className="input" rows={3} value={s('description')} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Status"><Segmented value={(f.status as string) ?? 'active'} onChange={(v) => set('status', v)} options={[{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'unknown', label: 'Unknown' }]} /></Field>
          <Field label="Sponsor"><input className="input" value={s('sponsor')} onChange={(e) => set('sponsor', e.target.value || undefined)} placeholder="Only if known" /></Field>
          <Field label="Start"><input type="date" className="input" value={dateIn('start')} onChange={(e) => set('start', dateOut(e.target.value))} /></Field>
          <Field label="End"><input type="date" className="input" value={dateIn('end')} onChange={(e) => set('end', dateOut(e.target.value))} /></Field>
        </>}
        {kind === 'publication' && <>
          <Field label="Venue"><input className="input" value={s('venue')} onChange={(e) => set('venue', e.target.value)} /></Field>
          <Field label="Year" required><input className="input" inputMode="numeric" value={String(f.year ?? '')} onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="DOI" className="col-span-2"><input className="input" value={s('doi')} onChange={(e) => set('doi', e.target.value || undefined)} /></Field>
        </>}
        {kind === 'ip' && <>
          <Field label="Summary" className="col-span-2"><textarea className="input" rows={3} value={s('summary')} onChange={(e) => set('summary', e.target.value)} /></Field>
          <Field label="Status"><Select value={(f.status as string) ?? 'unknown'} onChange={(v) => set('status', v)} options={['disclosure', 'provisional', 'patent-pending', 'issued', 'unknown'].map((x) => ({ value: x, label: x.replace('-', ' ') }))} /></Field>
          <Field label="Licensing"><Select value={(f.licensing as string) ?? 'unknown'} onChange={(v) => set('licensing', v)} options={['available', 'optioned', 'licensed', 'unknown'].map((x) => ({ value: x, label: x }))} /></Field>
          <Field label="Reference / docket"><input className="input" value={s('reference')} onChange={(e) => set('reference', e.target.value || undefined)} /></Field>
          <div className="flex items-end pb-1"><Checkbox checked={!!f.verified} onChange={(v) => set('verified', v)} label="Confirmed with OTT" /></div>
        </>}
        <Field label="Topics" className="col-span-2" hint="Leave empty to derive from the title and description.">
          <div className="flex flex-wrap items-center gap-1"><TopicChips ids={(f.topics as string[]) ?? []} onRemove={(t) => set('topics', ((f.topics as string[]) ?? []).filter((x) => x !== t))} /><TopicPicker size="sm" value={(f.topics as string[]) ?? []} onChange={(v) => set('topics', v)} /></div>
        </Field>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function CompanyEditDialog({ open, onClose, company }: { open: boolean; onClose: () => void; company: Company }) {
  const { commit } = useSave();
  const [f, setF] = useState(company);
  const [obj, setObj] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setF(company); setObj(company.objectives.join('\n')); setErr(''); } }, [open, company]);
  const save = async () => {
    if (!f.name.trim()) return setErr('Name is required.');
    const next = { ...f, name: f.name.trim(), objectives: obj.split('\n').map((x) => x.trim()).filter(Boolean) };
    next.provenance = manualProvenance(company as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>);
    if (await commit([{ op: 'put', collection: 'companies', record: next as never }], { success: 'Company updated' })) onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} size="lg" title={`Edit ${company.name}`}
      footer={<>{err && <span className="mr-auto text-sm text-bad">{err}</span>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" required><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Industry"><input className="input" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></Field>
        <Field label="Website"><input className="input" value={f.website ?? ''} onChange={(e) => setF({ ...f, website: e.target.value || undefined })} /></Field>
        <Field label="Headquarters"><input className="input" value={f.hq ?? ''} onChange={(e) => setF({ ...f, hq: e.target.value || undefined })} /></Field>
        <Field label="Size" className="col-span-2"><Segmented value={f.size} onChange={(v) => setF({ ...f, size: v })} options={[{ value: 'startup', label: 'Startup' }, { value: 'mid-size', label: 'Mid-size' }, { value: 'enterprise', label: 'Enterprise' }]} /></Field>
        <Field label="Description" className="col-span-2"><textarea className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Engagement objectives" className="col-span-2" hint="One per line."><textarea className="input" rows={4} value={obj} onChange={(e) => setObj(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
