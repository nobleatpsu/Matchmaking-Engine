import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flag, FlaskConical, Search, ShieldAlert } from 'lucide-react';
import { conceptLabel } from '@shared/taxonomy';
import type { IPRecord, IPStatus, LicensingStatus } from '@shared/types';
import { useDb, useIsDemo } from '@/lib/store';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import { flagIP, linkIPToInterest } from '@/lib/actions';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, Checkbox, EmptyState, Select, type Tone } from '@/components/ui/primitives';
import { Drawer, ask } from '@/components/ui/overlays';
import { PATHWAY_META, SourceLine, StageBadge } from '@/components/domain';
import { TopicChips } from '@/components/forms/Pickers';

const STATUS_TONE: Record<IPStatus, Tone> = { disclosure: 'neutral', provisional: 'accent', 'patent-pending': 'accent', issued: 'good', unknown: 'warn' };

/** Availability as a reviewer must read it: "available" only counts when OTT has verified it. */
type Avail = 'available' | 'listed' | 'optioned' | 'licensed' | 'unknown';
const availOf = (p: IPRecord): Avail => p.licensing === 'available' ? (p.verified ? 'available' : 'listed') : p.licensing;
const AVAIL: Record<Avail, { label: string; hint: string; mark: string }> = {
  available: { label: 'Available', hint: 'Verified available by OTT', mark: 'bg-good' },
  listed: { label: 'Listed available', hint: 'Source says available — OTT has not verified', mark: 'border-[1.5px] border-dashed border-warn' },
  optioned: { label: 'Optioned', hint: 'Under option to a company', mark: 'bg-warn' },
  licensed: { label: 'Licensed', hint: 'Licensed — not available', mark: 'bg-ink-3' },
  unknown: { label: 'Unknown', hint: 'No availability on record', mark: 'border-[1.5px] border-ink-4' },
};

export function Availability({ p }: { p: IPRecord }) {
  const a = availOf(p);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink"><span className={cn('h-2.5 w-2.5 rounded-full', AVAIL[a].mark)} aria-hidden />{AVAIL[a].label}</span>
      {a === 'listed' && <span className="text-[11px] text-warn">Not verified by OTT</span>}
      {a !== 'listed' && !p.verified && a !== 'unknown' && <span className="text-[11px] text-warn">Status unverified</span>}
    </span>
  );
}

export function IPPage() {
  const db = useDb();
  const isDemo = useIsDemo();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<IPStatus | ''>('');
  const [lic, setLic] = useState<LicensingStatus | ''>('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [avail, setAvail] = useState<Avail | ''>('');
  const openId = params.get('item');

  const rows = useMemo(() => Object.values(db.ip).filter((p) => {
    const text = `${p.title} ${p.summary} ${p.applications.join(' ')} ${p.topics.map(conceptLabel).join(' ')} ${p.facultyIds.map((f) => db.faculty[f]?.name).join(' ')}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase())) && (!status || p.status === status) && (!lic || p.licensing === lic) && (!verifiedOnly || p.verified) && (!avail || availOf(p) === avail);
  }), [db, q, status, lic, verifiedOnly, avail]);

  const counts = { available: Object.values(db.ip).filter((p) => p.licensing === 'available').length, unverified: Object.values(db.ip).filter((p) => !p.verified).length, flagged: Object.values(db.ip).filter((p) => p.flaggedForReview).length };
  const licensingOpps = Object.values(db.opportunities).filter((o) => o.type === 'licensing');

  return (
    <Page wide>
      <PageHeader
        title="IP & Commercialization"
        description="University technologies that may interest industry — one input to matching, never a requirement. Status comes from the source; unknowns stay unknown."
        meta={<>{counts.unverified > 0 && <Badge tone="warn">{counts.unverified} not verified with OTT</Badge>}{counts.flagged > 0 && <Badge tone="brand" icon={<Flag />}>{counts.flagged} flagged for OTT review</Badge>}</>}
      />
      <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-5" role="group" aria-label="Filter by availability">
        {(Object.keys(AVAIL) as Avail[]).map((a, i) => {
          const n = Object.values(db.ip).filter((p) => availOf(p) === a).length;
          const on = avail === a;
          return (
            <button key={a} aria-pressed={on} onClick={() => setAvail(on ? '' : a)} className={cn('px-4 py-2.5 text-left transition-colors duration-fast', i > 0 && 'sm:border-l border-line', on ? 'bg-accent-soft/60' : 'hover:bg-subtle/60')}>
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2"><span className={cn('h-2.5 w-2.5 rounded-full', AVAIL[a].mark)} aria-hidden />{AVAIL[a].label}</span>
              <span className="figure block text-[22px] leading-7">{n}</span>
              <span className="block truncate text-[11.5px] text-ink-3">{AVAIL[a].hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-4 flex items-start gap-2 border-l-2 border-accent-line pl-3 text-[12.5px] text-ink-2"><ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />{isDemo ? 'Fictional demo records. ' : ''}Patent, licensing and availability status must come from the Office of Technology Transfer. A technology is never treated as available until OTT verifies it, and any IP discussion with a company goes through OTT.</p>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-4" /><input className="input pl-9" placeholder="Search technologies, applications, research areas…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Select className="w-auto" value={status} onChange={setStatus} placeholder="Any status" options={(['disclosure', 'provisional', 'patent-pending', 'issued', 'unknown'] as IPStatus[]).map((s) => ({ value: s, label: s.replace('-', ' ').replace(/^./, (c) => c.toUpperCase()) }))} aria-label="Status" />
            <Select className="w-auto" value={lic} onChange={setLic} placeholder="Any licensing" options={(['available', 'optioned', 'licensed', 'unknown'] as LicensingStatus[]).map((s) => ({ value: s, label: s.replace(/^./, (c) => c.toUpperCase()) }))} aria-label="Licensing" />
            <Checkbox checked={verifiedOnly} onChange={setVerifiedOnly} label="Verified only" />
          </div>
          <div className="panel overflow-x-auto scroll-thin" tabIndex={0} role="region" aria-label="Technologies table">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-canvas text-left text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3"><tr><th className="px-4 py-2.5 font-medium">Technology</th><th className="px-3 py-2.5 font-medium">Researchers</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Availability</th><th className="px-3 py-2.5 font-medium">Linked needs</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 && <tr><td colSpan={5}><EmptyState icon={<FlaskConical />} title="No technologies match" /></td></tr>}
                {rows.map((p) => (
                  <tr key={p.id} className={cn('row-hover cursor-pointer', openId === p.id && 'bg-accent-soft/40')} onClick={() => setParams({ item: p.id })}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2 font-medium text-ink">{p.title}{p.flaggedForReview && <Flag className="h-3.5 w-3.5 text-brand" />}</div><div className="mt-0.5 text-xs text-ink-3">{p.applications.join(' · ')}</div></td>
                    <td className="px-3 py-3 text-ink-2">{p.facultyIds.map((f) => db.faculty[f]?.name).join(', ')}</td>
                    <td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><Badge tone={STATUS_TONE[p.status]} className="capitalize">{p.status.replace('-', ' ')}</Badge>{!p.verified && <span className="text-2xs text-warn">unverified</span>}</div></td>
                    <td className="px-3 py-3"><Availability p={p} /></td>
                    <td className="px-3 py-3 tabular text-ink-2">{p.linkedInterestIds.length || <span className="text-ink-4">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="space-y-5">
          <section className="panel">
            <div className="panel-head"><span className="panel-title">Commercialization opportunities</span></div>
            <ul className="divide-y divide-line">{licensingOpps.map((o) => <li key={o.id}><Link to={`/opportunities/${o.id}`} className="block px-4 py-2.5 hover:bg-subtle/70"><div className="text-sm text-ink">{o.title}</div><div className="mt-1 flex items-center gap-2"><StageBadge stage={o.stage} /><span className="text-xs text-ink-3">{db.companies[o.companyId]?.name}</span></div></Link></li>)}</ul>
          </section>
          <section className="panel p-4 text-sm text-ink-2 space-y-2">
            <div className="panel-title">How IP fits matching</div>
            <p>For <b>licensing</b> requests, related available IP raises the “engagement fit” component. For research requests it is only supporting evidence.</p>
            <p className="text-ink-3">A researcher with no patents can still be the strongest match.</p>
          </section>
        </aside>
      </div>

      <Drawer open={!!openId && !!db.ip[openId]} onOpenChange={(o) => !o && setParams({})} title={openId ? db.ip[openId]?.title : ''} subtitle="Technology record" width={600}>
        {openId && db.ip[openId] && <IPDetail p={db.ip[openId]} />}
      </Drawer>
    </Page>
  );
}

function IPDetail({ p }: { p: IPRecord }) {
  const db = useDb();
  const related = Object.values(db.interests).filter((i) => i.status !== 'fulfilled' && i.topics.some((t) => p.topics.includes(t)));
  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap gap-2"><Badge tone={STATUS_TONE[p.status]} className="capitalize">{p.status.replace('-', ' ')}</Badge><Availability p={p} /><Badge tone={p.verified ? 'good' : 'warn'}>{p.verified ? 'Verified with OTT' : 'Not verified'}</Badge></div>
      <p className="text-md text-ink-2 leading-relaxed">{p.summary}</p>
      <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-sm">
        <dt className="text-ink-3">Reference</dt><dd>{p.reference ?? <span className="text-ink-4">Unknown</span>}</dd>
        <dt className="text-ink-3">Filed</dt><dd>{p.filed ? fmtDate(p.filed) : <span className="text-ink-4">Unknown</span>}</dd>
        <dt className="text-ink-3">Applications</dt><dd>{p.applications.join(', ')}</dd>
        <dt className="text-ink-3">Research areas</dt><dd><TopicChips ids={p.topics} /></dd>
      </dl>
      <SourceLine source={p.source} />
      <section>
        <div className="eyebrow mb-2">Researchers</div>
        <ul className="space-y-2">{p.facultyIds.map((f) => <li key={f}><Link to={`/faculty/${f}`} className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-subtle"><Avatar name={db.faculty[f].name} size={28} /><span className="text-sm font-medium text-ink">{db.faculty[f].name}</span><span className="text-xs text-ink-3">{db.departments[db.faculty[f].departmentId]?.name}</span></Link></li>)}</ul>
      </section>
      <section>
        <div className="eyebrow mb-2">Company needs this could address</div>
        {related.length === 0 && <p className="text-sm text-ink-3">No open company needs share these research areas.</p>}
        <ul className="space-y-1.5">
          {related.map((i) => (
            <li key={i.id} className="flex items-start gap-3 rounded-md p-2 ring-1 ring-line">
              <Checkbox checked={p.linkedInterestIds.includes(i.id)} onChange={(v) => linkIPToInterest(p.id, i.id, v)} />
              <div className="min-w-0 flex-1"><div className="text-sm text-ink">{i.title}</div><div className="text-xs text-ink-3">{db.companies[i.companyId]?.name} · <span className={cn(PATHWAY_META[i.pathway].tone === 'accent' && 'text-accent')}>{PATHWAY_META[i.pathway].label}</span></div></div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-3">Linking records an internal hypothesis. It does not share anything with the company.</p>
      </section>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="primary" icon={<Flag className="h-4 w-4" />} disabled={p.flaggedForReview} onClick={async () => { const r = await ask({ title: 'Flag for OTT review', confirmLabel: 'Flag', input: { label: 'What should OTT check?', multiline: true, required: true, initial: p.verified ? 'Confirm licensing availability before discussing with a company.' : 'Confirm this technology exists in OTT records and its status.' } }); if (r) flagIP(p.id, r); }}>{p.flaggedForReview ? 'Flagged for OTT review' : 'Flag for OTT review'}</Button>
        <Link to="/match"><Button>Match to a company need</Button></Link>
      </div>
    </div>
  );
}
