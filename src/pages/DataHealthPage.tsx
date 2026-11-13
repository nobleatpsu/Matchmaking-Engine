import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleDashed, CloudOff, FileUp, Hand, KeyRound, PlugZap, Upload } from 'lucide-react';
import { freshness } from '@shared/rules';
import type { Company, DataIssue, DataSource, Faculty, Op } from '@shared/types';
import { collegesOf } from '@/lib/colleges';
import { cn } from '@/lib/cn';
import { useDb, useIsDemo, useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { IngestReport } from '@shared/ingest';
import { fmtDate, nowIso, relTime, uid } from '@/lib/format';
import { markVerified, resolveIssue } from '@/lib/actions';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, Meter, Segmented, Select, Tabs, type Tone } from '@/components/ui/primitives';
import { ask } from '@/components/ui/overlays';
import { InfoNote } from '@/components/domain';

type Tab = 'sources' | 'issues' | 'coverage' | 'import' | 'duplicates';

export const SOURCE_STATUS: Record<DataSource['status'], { label: string; tone: Tone; icon: React.ReactNode }> = {
  demo: { label: 'Demo snapshot', tone: 'accent', icon: <CircleDashed className="h-3 w-3" /> },
  manual: { label: 'Working (manual)', tone: 'good', icon: <Hand className="h-3 w-3" /> },
  'awaiting-access': { label: 'Awaiting access', tone: 'warn', icon: <KeyRound className="h-3 w-3" /> },
  'not-connected': { label: 'Not connected', tone: 'neutral', icon: <CloudOff className="h-3 w-3" /> },
  connected: { label: 'Connected', tone: 'good', icon: <CheckCircle2 className="h-3 w-3" /> },
  error: { label: 'Error', tone: 'bad', icon: <CloudOff className="h-3 w-3" /> },
};

export function DataHealthPage() {
  const db = useDb();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'sources';
  const issues = Object.values(db.issues);
  const open = issues.filter((i) => i.status === 'open');
  const dups = useMemo(() => findDuplicates(db.companies, db.faculty), [db.companies, db.faculty]);

  return (
    <Page wide>
      <PageHeader
        title="Data Health"
        description="Where the platform’s information comes from, how current it is, and what needs a person to check. Honest uncertainty beats a confident wrong answer."
        meta={<><Badge tone="warn">{open.length} open issues</Badge><Badge tone="outline">{Object.values(db.faculty).filter((f) => freshness(f.lastVerified) === 'stale').length} stale faculty records</Badge></>}
      />
      <Tabs className="mb-6" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} tabs={[
        { value: 'sources', label: 'Sources', count: Object.keys(db.sources).length }, { value: 'issues', label: 'Issues', count: open.length },
        { value: 'coverage', label: 'Coverage' }, { value: 'duplicates', label: 'Duplicates', count: dups.length }, { value: 'import', label: 'CSV import' },
      ]} />

      {tab === 'sources' && <Sources />}
      {tab === 'issues' && <Issues issues={issues} />}
      {tab === 'coverage' && <Coverage />}
      {tab === 'duplicates' && <Duplicates dups={dups} />}
      {tab === 'import' && <Import />}
    </Page>
  );
}

const READINESS: { id: string; label: string; hint: string; statuses: DataSource['status'][] }[] = [
  { id: 'ready', label: 'Connected and working', hint: 'Live feeds or manual processes that produce real records', statuses: ['connected', 'manual'] },
  { id: 'demo', label: 'Demo snapshots', hint: 'Fictional stand-ins until an approved source exists', statuses: ['demo'] },
  { id: 'blocked', label: 'Not ready', hint: 'Waiting on institutional access, credentials or a decision', statuses: ['awaiting-access', 'not-connected', 'error'] },
];

/** Status shape carries meaning without color: solid = working, hatched = demo, dashed = not ready. */
export function SourceGlyph({ status }: { status: DataSource['status'] }) {
  const base = 'inline-block h-3 w-3 shrink-0 align-middle';
  if (status === 'connected') return <span className={cn(base, 'rounded-full bg-good')} aria-hidden />;
  if (status === 'manual') return <span className={cn(base, 'rounded-[2px] bg-good')} aria-hidden />;
  if (status === 'demo') return <span className={cn(base, 'demo-hatch rounded-[2px] ring-1 ring-inset ring-demo')} aria-hidden />;
  if (status === 'error') return <span className={cn(base, 'rounded-full bg-bad')} aria-hidden />;
  return <span className={cn(base, 'rounded-full border-[1.5px] border-dashed', status === 'awaiting-access' ? 'border-warn' : 'border-ink-4')} aria-hidden />;
}

function Sources() {
  const db = useDb();
  const meta = useStore((s) => s.meta);
  const all = Object.values(db.sources);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-3">
        {READINESS.map((g, i) => {
          const n = all.filter((x) => g.statuses.includes(x.status)).length;
          return (
            <div key={g.id} className={cn('px-4 py-3', i > 0 && 'border-line max-sm:border-t sm:border-l')}>
              <div className="flex items-center gap-2 text-[12px] font-medium text-ink-3"><SourceGlyph status={g.statuses[0]} />{g.label}</div>
              <div className="figure mt-0.5 text-[24px]">{n}</div>
              <div className="text-[12px] text-ink-3">{g.hint}</div>
            </div>
          );
        })}
      </div>

      {READINESS.map((g) => {
        const rows = all.filter((x) => g.statuses.includes(x.status));
        if (!rows.length) return null;
        const blocked = g.id === 'blocked';
        return (
          <section key={g.id} aria-labelledby={`src-${g.id}`}>
            <div className="mb-2 flex items-baseline gap-2"><h2 id={`src-${g.id}`} className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{g.label}</h2><span className="meta">{rows.length}</span></div>
            <div className="panel overflow-x-auto scroll-thin">
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <caption className="sr-only">{g.label}</caption>
                <thead className="border-b border-line bg-canvas text-left text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
                  <tr><th className="w-[29%] px-4 py-2 font-medium">Source</th><th className="w-[16%] px-3 py-2 font-medium">Status</th><th className="w-[9%] px-3 py-2 text-right font-medium">Records</th><th className="w-[11%] px-3 py-2 font-medium">Last sync</th><th className="w-[10%] px-3 py-2 font-medium">Cadence</th><th className="px-4 py-2 font-medium">Access & ownership</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((x) => {
                    const st = SOURCE_STATUS[x.status];
                    const count = countFor(db, x.id);
                    return (
                      <tr key={x.id} className={cn('align-top', blocked && 'bg-[repeating-linear-gradient(-45deg,transparent_0_10px,rgb(var(--subtle)/0.6)_10px_11px)]')}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink">{x.name}</div>
                          <div className="mt-0.5 text-xs text-ink-3">{x.recordTypes.join(' · ')}</div>
                          <div className="mt-1 text-xs text-ink-2">{x.description}</div>
                        </td>
                        <td className="px-3 py-3"><span className="flex items-center gap-2 whitespace-nowrap text-[13px] font-medium text-ink"><SourceGlyph status={x.status} />{st.label}</span>{blocked && <span className="mt-1 block text-[11.5px] text-warn">Not connected — no live data flows</span>}</td>
                        <td className="px-3 py-3 text-right"><span className="figure text-[14px]">{count}</span>{blocked && count > 0 && <span className="block text-[11px] text-ink-3">from the demo dataset</span>}</td>
                        <td className="px-3 py-3 text-[13px] text-ink-2">{x.lastSync ? <span title={fmtDate(x.lastSync)}>{relTime(x.lastSync)}</span> : <span className="text-ink-3">{blocked ? 'Never — no access' : '—'}</span>}{x.lastResult && <span className="meta block">+{x.lastResult.created} · ~{x.lastResult.updated} · {x.lastResult.conflicts} conflicts</span>}</td>
                        <td className="px-3 py-3 text-[13px] text-ink-2">{x.cadence ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-ink-2"><div>{x.accessNote}</div><div className="mt-1 text-ink-3">Owner: {x.owner}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section>
        <div className="mb-2 flex items-baseline gap-2"><h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Matching providers</h2><span className="meta">{meta?.providers.length ?? 0}</span></div>
        <ul className="panel divide-y divide-line text-sm">{meta?.providers.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"><SourceGlyph status="connected" /><span className="font-medium">{p.name}</span><span className="mono">{p.id} v{p.version}</span>{p.default && <Badge tone="outline">Default</Badge>}<span className="basis-full text-xs text-ink-3 sm:basis-auto">{p.description}</span></li>)}</ul>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-3"><PlugZap className="mt-px h-3.5 w-3.5" />Sources are fed by the ingestion API, CSV import, or a data provider in <code className="mono">server/data-providers/</code>. External matchers register through <code className="mono">MATCHERS_HTTP</code>.</p>
      </section>
    </div>
  );
}

function countFor(db: ReturnType<typeof useDb>, sourceId: string) {
  const hit = (s: { sourceId: string }) => s.sourceId === sourceId;
  return Object.values(db.faculty).filter((f) => f.sources.some(hit)).length + Object.values(db.projects).filter((p) => hit(p.source)).length
    + Object.values(db.publications).filter((p) => hit(p.source)).length + Object.values(db.ip).filter((p) => hit(p.source)).length
    + Object.values(db.companies).filter((c) => c.sources.some(hit)).length + Object.values(db.signals).filter((s) => hit(s.source)).length;
}

function Issues({ issues }: { issues: DataIssue[] }) {
  const db = useDb();
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const [kind, setKind] = useState<DataIssue['kind'] | ''>('');
  const rows = issues.filter((i) => (filter === 'open' ? i.status === 'open' : i.status !== 'open') && (!kind || i.kind === kind)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const name = (i: DataIssue) => i.entity === 'faculty' ? db.faculty[i.entityId]?.name : i.entity === 'company' ? db.companies[i.entityId]?.name : i.entity === 'ip' ? db.ip[i.entityId]?.title : i.entity === 'publication' ? db.publications[i.entityId]?.title : db.projects[i.entityId]?.title;
  const href = (i: DataIssue) => i.entity === 'faculty' ? `/faculty/${i.entityId}?tab=data` : i.entity === 'company' ? `/companies/${i.entityId}` : i.entity === 'ip' ? `/ip?item=${i.entityId}` : '#';

  const act = async (i: DataIssue) => {
    if (i.kind === 'conflict' && i.values) {
      const v = await ask({ title: 'Resolve conflict', body: 'Pick the value confirmed by an authoritative source.', confirmLabel: 'Resolve', input: { label: 'Correct value', required: true, options: [...i.values.map((x) => ({ value: x.value, label: `${x.value} (${db.sources[x.sourceId]?.name})` })), { value: '__none', label: 'Neither — needs follow-up' }] } });
      if (!v) return;
      if (v === '__none') return resolveIssue(i.id, 'Needs follow-up with department', 'open');
      const src = i.values.find((x) => x.value === v)!;
      return resolveIssue(i.id, `Confirmed: ${v}`, 'resolved', { value: v, sourceId: src.sourceId });
    }
    if ((i.kind === 'stale' || i.kind === 'unverified-contact') && i.entity === 'faculty') {
      const c = await ask({ title: `Verify ${name(i)}`, body: 'Confirm you checked an authoritative source today.', confirmLabel: 'Mark verified', input: { label: 'What was verified?', required: true, options: [{ value: 'profile', label: 'Profile (title, department, projects)' }, { value: 'both', label: 'Profile and contact details' }] } });
      if (c) return markVerified(i.entityId, { email: c === 'both' || i.kind === 'unverified-contact' });
      return;
    }
    const note = await ask({ title: 'Resolve issue', confirmLabel: 'Resolve', input: { label: 'Resolution', required: true, multiline: true } });
    if (note) resolveIssue(i.id, note);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved & ignored' }]} />
        <Select className="w-auto" value={kind} onChange={setKind} placeholder="All kinds" options={(['stale', 'missing', 'conflict', 'duplicate', 'unverified-contact'] as const).map((k) => ({ value: k, label: k.replace('-', ' ').replace(/^./, (c) => c.toUpperCase()) }))} aria-label="Kind" />
      </div>
      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-xs text-ink-3"><tr><th className="px-4 py-2.5 font-medium">Issue</th><th className="px-3 py-2.5 font-medium">Record</th><th className="px-3 py-2.5 font-medium">Detail</th><th className="px-3 py-2.5 font-medium">Raised</th><th className="px-4 py-2.5" /></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={5}><EmptyState icon={<CheckCircle2 />} title="Nothing here" /></td></tr>}
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3"><Badge tone={i.kind === 'conflict' ? 'bad' : i.kind === 'duplicate' ? 'neutral' : 'warn'} className="capitalize">{i.kind.replace('-', ' ')}</Badge>{i.field && <div className="mt-1 text-xs text-ink-4">field: {i.field}</div>}</td>
                <td className="px-3 py-3"><Link to={href(i)} className="font-medium text-ink hover:text-accent">{name(i)}</Link><div className="text-xs capitalize text-ink-3">{i.entity}</div></td>
                <td className="px-3 py-3 text-ink-2 max-w-[380px]">{i.detail}{i.values && <div className="mt-1 space-y-0.5 text-xs text-ink-3">{i.values.map((v) => <div key={v.sourceId}>“{v.value}” — {db.sources[v.sourceId]?.name}</div>)}</div>}{i.resolution && <div className="mt-1 text-xs text-good">{i.resolution} · {db.users[i.resolvedBy ?? '']?.name}</div>}</td>
                <td className="px-3 py-3 text-ink-3">{relTime(i.createdAt)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {i.status === 'open' && <div className="flex justify-end gap-1.5"><Button size="sm" onClick={() => act(i)}>{i.kind === 'conflict' ? 'Resolve' : i.kind === 'stale' || i.kind === 'unverified-contact' ? 'Verify' : 'Resolve'}</Button><Button size="sm" variant="ghost" onClick={() => resolveIssue(i.id, 'Ignored', 'ignored')}>Ignore</Button></div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Coverage() {
  const db = useDb();
  const fac = Object.values(db.faculty);
  const rows = collegesOf(db).map((c) => {
    const fs = fac.filter((f) => db.departments[f.departmentId]?.college === c);
    const pct = (n: number) => (fs.length ? Math.round((n / fs.length) * 100) : 0);
    return {
      college: c, n: fs.length,
      fresh: pct(fs.filter((f) => freshness(f.lastVerified) === 'fresh').length),
      contact: pct(fs.filter((f) => f.emailVerified).length),
      sources: pct(fs.filter((f) => f.sources.length >= 2).length),
      projects: fs.length ? (fs.reduce((a, f) => a + Object.values(db.projects).filter((p) => p.facultyIds.includes(f.id)).length, 0) / fs.length).toFixed(1) : '—',
    };
  }).filter((r) => r.n);
  return (
    <div className="space-y-4">
      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-xs text-ink-3"><tr><th className="px-4 py-2.5 font-medium">College</th><th className="px-3 py-2.5 font-medium">Researchers</th><th className="px-3 py-2.5 font-medium">Verified ≤ 6 mo</th><th className="px-3 py-2.5 font-medium">Contact verified</th><th className="px-3 py-2.5 font-medium">≥ 2 sources</th><th className="px-3 py-2.5 font-medium">Projects / person</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.college}>
                <td className="px-4 py-3 font-medium text-ink">{r.college}</td>
                <td className="px-3 py-3 tabular">{r.n}</td>
                {[r.fresh, r.contact, r.sources].map((v, i) => <td key={i} className="px-3 py-3"><div className="flex items-center gap-2"><Meter value={v} tone={v >= 75 ? 'good' : v >= 50 ? 'warn' : 'bad'} className="w-24" /><span className="tabular text-xs text-ink-2">{v}%</span></div></td>)}
                <td className="px-3 py-3 tabular text-ink-2">{r.projects}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InfoNote>“Projects per person” reflects what sources list. Several researchers show one project while their publication record suggests more — treat low numbers as a coverage gap, not as low activity.</InfoNote>
    </div>
  );
}

/* --------------------------- Duplicates --------------------------- */

const norm = (s: string) => s.toLowerCase().replace(/\b(inc|llc|ltd|corp|corporation|company|co|the|dr|prof)\b\.?/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
function sim(a: string, b: string) { const x = new Set(norm(a)); const y = new Set(norm(b)); const inter = [...x].filter((t) => y.has(t)).length; return inter / Math.max(1, new Set([...x, ...y]).size); }
function findDuplicates(companies: Record<string, Company>, faculty: Record<string, Faculty>) {
  const out: { a: string; b: string; kind: 'company' | 'faculty'; score: number }[] = [];
  const cs = Object.values(companies);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const s = sim(cs[i].name, cs[j].name); if (s >= 0.5) out.push({ a: cs[i].id, b: cs[j].id, kind: 'company', score: s }); }
  const fs = Object.values(faculty);
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) { const s = sim(fs[i].name, fs[j].name); if (s >= 0.66) out.push({ a: fs[i].id, b: fs[j].id, kind: 'faculty', score: s }); }
  return out;
}

function Duplicates({ dups }: { dups: ReturnType<typeof findDuplicates> }) {
  const db = useDb();
  const commit = useStore((s) => s.commit);
  const resolved = Object.values(db.issues).filter((i) => i.kind === 'duplicate');
  const label = (k: 'company' | 'faculty', id: string) => k === 'company' ? db.companies[id]?.name : db.faculty[id]?.name;
  const merge = async (d: (typeof dups)[number]) => {
    if (d.kind !== 'company') return;
    const ok = await ask({ title: 'Merge companies?', body: <>Keep <b>{label('company', d.a)}</b> and move opportunities, needs and relationships from <b>{label('company', d.b)}</b> into it. The duplicate record is removed.</>, confirmLabel: 'Merge', tone: 'danger' });
    if (ok === null) return;
    const ops: Op[] = [];
    for (const o of Object.values(db.opportunities)) if (o.companyId === d.b) ops.push({ op: 'put', collection: 'opportunities', record: { ...o, companyId: d.a } as never });
    for (const i of Object.values(db.interests)) if (i.companyId === d.b) ops.push({ op: 'put', collection: 'interests', record: { ...i, companyId: d.a } as never });
    for (const r of Object.values(db.relationships)) if (r.companyId === d.b) ops.push({ op: 'put', collection: 'relationships', record: { ...r, companyId: d.a } as never });
    ops.push({ op: 'delete', collection: 'companies', id: d.b });
    ops.push({ op: 'put', collection: 'issues', record: { id: uid('di'), kind: 'duplicate', entity: 'company', entityId: d.a, duplicateOfId: d.b, detail: `“${label('company', d.b)}” merged into ${label('company', d.a)}.`, status: 'resolved', resolution: 'Merged', resolvedBy: useStore.getState().userId, resolvedAt: nowIso(), createdAt: nowIso() } as never });
    commit(ops, { success: 'Merged' });
  };
  return (
    <div className="space-y-5">
      <section className="panel">
        <div className="panel-head"><span className="panel-title">Likely duplicates</span><span className="text-xs text-ink-3">Name-token similarity · always confirmed by a person</span></div>
        {dups.length === 0 ? <EmptyState icon={<CheckCircle2 />} title="No likely duplicates">Import a CSV to see duplicate detection at work.</EmptyState> : (
          <ul className="divide-y divide-line">{dups.map((d) => (
            <li key={d.a + d.b} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <Badge tone="outline" className="capitalize">{d.kind}</Badge>
              <span className="font-medium">{label(d.kind, d.a)}</span><span className="text-ink-4">≈</span><span className="font-medium">{label(d.kind, d.b)}</span>
              <span className="text-xs text-ink-3">{Math.round(d.score * 100)}% name overlap</span>
              {d.kind === 'company' && <Button size="sm" className="ml-auto" onClick={() => merge(d)}>Merge…</Button>}
            </li>
          ))}</ul>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><span className="panel-title">Resolved</span></div>
        <ul className="divide-y divide-line">{resolved.map((i) => <li key={i.id} className="px-5 py-3 text-sm text-ink-2">{i.detail} <span className="text-xs text-ink-3">· {db.users[i.resolvedBy ?? '']?.name} · {fmtDate(i.resolvedAt)}</span></li>)}</ul>
      </section>
    </div>
  );
}

/* --------------------------- CSV import --------------------------- */
// Parsing happens in the browser; matching, merging, provenance and conflict
// detection happen on the server through the same sync engine the ingestion
// API uses. Preview = dry run; Import = the same call for real.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

type ImportEntity = 'companies' | 'faculty' | 'projects' | 'publications' | 'ip';
type FieldDef = [key: string, label: string, required: boolean, aliases: string[]];

const FIELDS: Record<ImportEntity, FieldDef[]> = {
  companies: [['name', 'Name', true, ['company', 'organization', 'name']], ['industry', 'Industry', false, ['industry', 'sector']], ['website', 'Website', false, ['website', 'url', 'domain']], ['description', 'Description', false, ['description', 'about']], ['hq', 'Headquarters', false, ['headquarter', 'hq', 'location', 'city']]],
  faculty: [['name', 'Name', true, ['name', 'faculty']], ['title', 'Title', false, ['title', 'rank', 'position']], ['department', 'Department', true, ['department', 'dept']], ['college', 'College', false, ['college']], ['email', 'Email', false, ['email']], ['orcid', 'ORCID', false, ['orcid']], ['keywords', 'Keywords (; separated)', false, ['keyword', 'expertise', 'interest']], ['summary', 'Research summary', false, ['summary', 'bio', 'research']], ['profileUrl', 'Profile URL', false, ['profile', 'url']]],
  projects: [['title', 'Title', true, ['title', 'project']], ['facultyEmail', 'Faculty email', false, ['email']], ['facultyName', 'Faculty name', false, ['faculty', 'pi', 'investigator']], ['description', 'Description', false, ['description', 'abstract']], ['sponsor', 'Sponsor', false, ['sponsor', 'funder', 'agency']], ['start', 'Start date', false, ['start']], ['end', 'End date', false, ['end']], ['topics', 'Topics (; separated)', false, ['topic', 'keyword']]],
  publications: [['title', 'Title', true, ['title']], ['year', 'Year', true, ['year']], ['venue', 'Venue', false, ['venue', 'journal', 'conference']], ['doi', 'DOI', false, ['doi']], ['facultyEmail', 'Faculty email', false, ['email']], ['facultyName', 'Faculty name', false, ['author', 'faculty']]],
  ip: [['title', 'Title', true, ['title', 'technology']], ['reference', 'Reference / docket', false, ['reference', 'docket', 'patent']], ['status', 'Status', false, ['status']], ['licensing', 'Licensing', false, ['licens']], ['summary', 'Summary', false, ['summary', 'abstract', 'description']], ['facultyEmail', 'Inventor email', false, ['email']], ['facultyName', 'Inventor name', false, ['inventor', 'faculty']]],
};

const ENTITY_LABEL: Record<ImportEntity, string> = { companies: 'Companies', faculty: 'Faculty', projects: 'Projects', publications: 'Publications', ip: 'IP' };
const split = (v: string) => v.split(/;|\|/).map((x) => x.trim()).filter(Boolean);

function toRecord(entity: ImportEntity, get: (k: string) => string): Record<string, unknown> {
  const facultyRef = () => [get('facultyEmail') ? { email: get('facultyEmail') } : { name: get('facultyName') }].filter((r) => Object.values(r).some(Boolean));
  const opt = (v: string) => v || undefined;
  switch (entity) {
    case 'companies': return { name: get('name'), industry: opt(get('industry')), website: opt(get('website')), description: opt(get('description')), hq: opt(get('hq')) };
    case 'faculty': return { name: get('name'), title: opt(get('title')), department: opt(get('department')), college: opt(get('college')), email: opt(get('email')), keywords: get('keywords') ? split(get('keywords')) : undefined, summary: opt(get('summary')), profileUrl: opt(get('profileUrl')), externalIds: get('orcid') ? { orcid: get('orcid') } : undefined };
    case 'projects': return { title: get('title'), description: opt(get('description')), sponsor: opt(get('sponsor')), start: get('start') ? new Date(get('start')).toISOString() : undefined, end: get('end') ? new Date(get('end')).toISOString() : undefined, topics: get('topics') ? split(get('topics')) : undefined, faculty: facultyRef() };
    case 'publications': return { title: get('title'), year: Number(get('year')), venue: opt(get('venue')), doi: opt(get('doi')), faculty: facultyRef() };
    case 'ip': return { title: get('title'), reference: opt(get('reference')), status: opt(get('status').toLowerCase().replace(/\s+/g, '-')), licensing: opt(get('licensing').toLowerCase()), summary: opt(get('summary')), faculty: facultyRef() };
  }
}

function Import() {
  const db = useDb();
  const load = useStore((s) => s.load);
  const isDemo = useIsDemo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState<ImportEntity>('companies');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<IngestReport | null>(null);
  const [busy, setBusy] = useState(false);
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const autoMap = (hdr: string[], ent: ImportEntity) => {
    const m: Record<string, string> = {};
    for (const [k, , , aliases] of FIELDS[ent]) {
      const idx = hdr.findIndex((h) => aliases.some((a) => h.toLowerCase().includes(a)));
      if (idx >= 0 && !Object.values(m).includes(String(idx))) m[k] = String(idx);
    }
    if (!m[FIELDS[ent][0][0]]) m[FIELDS[ent][0][0]] = '0';
    return m;
  };

  const loadFile = async (f: File) => {
    setError(''); setPreview(null);
    if (f.size > 5_000_000) { setError('File is larger than 5 MB — split it, or use the ingestion API.'); return; }
    const parsed = parseCsv(await f.text());
    if (parsed.length < 2) { setError('The file needs a header row and at least one data row.'); return; }
    setFileName(f.name); setRows(parsed); setMap(autoMap(parsed[0], entity));
  };

  const records = () => body.map((r) => toRecord(entity, (k) => (map[k] !== undefined && map[k] !== '' ? (r[Number(map[k])] ?? '').trim() : '')));
  const batch = (dryRun: boolean) => ({ entity, source: { sourceId: 'src-import', label: `CSV: ${fileName}` }, records: records(), options: { dryRun, emitSignals: false } });
  const runPreview = async () => { setBusy(true); try { setPreview(await api.ingest(batch(true))); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  const runImport = async () => {
    setBusy(true);
    try {
      const r = await api.ingest(batch(false));
      toast.success(`Imported: ${r.created} created, ${r.updated} updated, ${r.conflicts} conflicts, ${r.errors} errors`);
      setRows([]); setFileName(''); setPreview(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const STATUS_TONE = { created: 'good', updated: 'accent', unchanged: 'neutral', conflict: 'warn', error: 'bad' } as const;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <section className="panel p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented value={entity} onChange={(v) => { setEntity(v); setPreview(null); if (rows.length) setMap(autoMap(rows[0], v)); }} options={(Object.keys(ENTITY_LABEL) as ImportEntity[]).map((e) => ({ value: e, label: ENTITY_LABEL[e] }))} />
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); e.target.value = ''; }} />
            <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Choose CSV…</Button>
            {fileName && <span className="text-sm text-ink-2">{fileName} · {body.length} rows</span>}
          </div>
          {error && <p className="text-sm text-bad" role="alert">{error}</p>}
          {!rows.length && (
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-strong bg-canvas px-6 py-12 text-center">
              <FileUp className="h-8 w-8 text-ink-4" />
              <p className="mt-2 text-sm font-medium text-ink">Drop a CSV here</p>
              <p className="mt-1 max-w-md text-xs text-ink-3">Columns are matched automatically and can be adjusted. Existing records are matched (by email, external id, DOI or name) and updated; disagreements with other sources become conflicts to review. Imported faculty are marked <b>unverified</b>.</p>
            </div>
          )}
          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FIELDS[entity].map(([k, label, req]) => (
                  <label key={k} className="text-sm"><span className="text-ink-2">{label}{req && <span className="text-bad"> *</span>}</span>
                    <Select className="mt-1" value={map[k] ?? ''} onChange={(v) => { setMap({ ...map, [k]: v }); setPreview(null); }} placeholder="— skip —" options={header.map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}` }))} />
                  </label>
                ))}
              </div>
              {(entity === 'projects' || entity === 'publications' || entity === 'ip') && <p className="text-xs text-ink-3">Research records are linked to existing faculty by email (preferred) or exact name. Import faculty first.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={runPreview} loading={busy && !preview}>Preview (dry run)</Button>
                <Button variant="primary" disabled={!preview || preview.created + preview.updated === 0} loading={busy && !!preview} onClick={runImport}>Import {preview ? preview.created + preview.updated : ''} records</Button>
                {preview && <span className="text-xs text-ink-3">{preview.created} new · {preview.updated} updates · {preview.unchanged} unchanged · {preview.conflicts} conflicts · {preview.errors} errors</span>}
              </div>
              {preview && (
                <div className="overflow-x-auto scroll-thin rounded-md ring-1 ring-line max-h-[360px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-canvas text-left text-xs text-ink-3"><tr><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Record</th><th className="px-3 py-2 font-medium">Result</th><th className="px-3 py-2 font-medium">Detail</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {preview.results.map((r) => (
                        <tr key={r.index}>
                          <td className="px-3 py-1.5 tabular text-ink-4">{r.index + 2}</td>
                          <td className="px-3 py-1.5">{r.name ?? '—'}</td>
                          <td className="px-3 py-1.5"><Badge tone={STATUS_TONE[r.status]} className="capitalize">{r.status}</Badge></td>
                          <td className="px-3 py-1.5 text-xs text-ink-3">{r.message ?? r.conflicts?.map((c) => `${c.field}: “${c.existing}” vs “${c.incoming}”`).join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <aside className="space-y-4">
        <section className="panel p-5 text-sm text-ink-2 space-y-2">
          <div className="panel-title">Bigger or automated loads</div>
          <p>Scripts and scrapers should use the ingestion API (<code>POST /api/w/{'{workspace}'}/ingest</code> with an API key) or <code>npm run ingest -- --file=batch.json</code>. Same engine, same rules. See <code>docs/data-ingestion.md</code>.</p>
        </section>
        <section className="panel p-5 text-sm text-ink-2 space-y-2">
          <div className="panel-title">The OSVPR industry leads list</div>
          <p>The client spreadsheet holds roughly 1,450 company names across two sheets, with no other fields. Export a sheet to CSV and import it as <b>Companies</b>; each becomes a prospect for staff to enrich.</p>
          {isDemo && <p className="text-xs text-ink-3">Import it into the live workspace — the demo uses fictional companies.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Import & sync history</span></div>
          <ul className="divide-y divide-line">
            {Object.values(db.imports).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15).map((b) => <li key={b.id} className="px-4 py-2.5 text-sm"><div className="text-ink">{b.fileName}</div><div className="text-xs text-ink-3">{b.entity} · {b.created} created · {b.duplicates} matched existing · {b.skipped} errors · {db.users[b.by]?.name ?? b.by} · {relTime(b.at)}</div></li>)}
            {!Object.keys(db.imports).length && <li className="px-4 py-4 text-sm text-ink-3">No imports yet.</li>}
          </ul>
        </section>
      </aside>
    </div>
  );
}
