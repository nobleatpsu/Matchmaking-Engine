import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Building2, Check, DownloadCloud, FileBox, FlaskConical, Landmark, Link2, Plus, Radar, RefreshCw, Sparkles, X } from 'lucide-react';
import { conceptLabel } from '@shared/taxonomy';
import type { Signal, SignalKind } from '@shared/types';
import { useDb, useIsDemo } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { cn } from '@/lib/cn';
import { fmtDate, nowIso, relTime, uid } from '@/lib/format';
import { attachSignal, ingestSignals, markSignalConverted, setSignalStatus } from '@/lib/actions';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, EmptyState, Segmented } from '@/components/ui/primitives';
import { Tip, ask } from '@/components/ui/overlays';
import { CompanyMark, InfoNote, SourceLine, StageBadge } from '@/components/domain';
import { TopicChips } from '@/components/forms/Pickers';

const KIND: Record<SignalKind, { label: string; icon: React.ReactNode }> = {
  'new-project': { label: 'New project', icon: <FileBox /> }, 'new-publication': { label: 'New publication', icon: <BookOpen /> },
  'new-ip': { label: 'New IP', icon: <FlaskConical /> }, 'company-announcement': { label: 'Company news', icon: <Building2 /> },
  'company-focus-change': { label: 'Company focus change', icon: <Building2 /> }, 'funding-announcement': { label: 'Funding', icon: <Landmark /> },
  'new-interest': { label: 'New interest', icon: <Sparkles /> }, 'record-updated': { label: 'Record updated', icon: <RefreshCw /> },
};

/** Mock ingestion pool: clearly-labelled demo events used to show the pipeline. */
const POOL: Omit<Signal, 'id' | 'date' | 'status' | 'source' | 'ingestedBy'>[] = [
  { kind: 'new-publication', title: 'Chandra group posts preprint on ML-predicted electrolyte stability', detail: 'Preprint on interfacial stability predictions.', facultyIds: ['f-chandra'], companyIds: ['c-voltaic'], topics: ['solid-state-batteries', 'computational-materials'], suggestedAction: 'Attach to the Voltaic solid-state opportunity as evidence.' },
  { kind: 'company-announcement', title: 'Northwind announces $40M grid storage pilot', detail: 'Utility plans three battery sites by 2028.', facultyIds: ['f-reyes'], companyIds: ['c-northwind'], topics: ['energy-storage', 'power-systems'], suggestedAction: 'Prioritize the storage siting opportunity; verify Reyes profile first.' },
  { kind: 'new-project', title: 'Osei awarded AM qualification project', detail: 'New sponsored project on printed superalloys.', facultyIds: ['f-osei'], companyIds: ['c-halcyon'], topics: ['additive-manufacturing'], suggestedAction: 'Add Osei to the Halcyon AM opportunity as a candidate.' },
  { kind: 'funding-announcement', title: 'State program funds PFAS treatment pilots', detail: 'Matching funds for utility–university pilots.', facultyIds: ['f-castillo'], companyIds: ['c-clearwater'], topics: ['environmental-remediation'], suggestedAction: 'Share with Clearwater owner; may close the funding gap.' },
];

export function SignalsPage() {
  const db = useDb();
  const isDemo = useIsDemo();
  const navigate = useNavigate();
  const openNewOpp = useUI((s) => s.openNewOpp);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<'new' | 'all' | 'converted' | 'dismissed'>('new');
  const [ingesting, setIngesting] = useState(false);

  const all = Object.values(db.signals).sort((a, b) => b.date.localeCompare(a.date));
  const rows = all.filter((s) => filter === 'all' || (filter === 'new' ? s.status === 'new' || s.status === 'reviewed' : s.status === filter));
  const selected = params.get('item') ? db.signals[params.get('item')!] : rows[0];

  // Relevance: how many open company needs share topics with this signal.
  const relevance = useMemo(() => Object.fromEntries(all.map((s) => [s.id, Object.values(db.interests).filter((i) => i.status !== 'fulfilled' && i.topics.some((t) => s.topics.includes(t)))])), [all, db.interests]);

  const ingest = async () => {
    setIngesting(true);
    await new Promise((r) => setTimeout(r, 700));
    const existing = new Set(all.map((s) => s.title));
    const fresh = POOL.filter((p) => !existing.has(p.title)).slice(0, 2);
    if (!fresh.length) { setIngesting(false); toast.message('Demo feed has nothing new', { description: 'All demo events have been ingested. Reset demo data to replay.' }); return; }
    await ingestSignals(fresh.map((p) => ({ ...p, id: uid('s'), date: nowIso(), status: 'new', ingestedBy: 'demo-feed', source: { sourceId: 'src-company', label: 'Demo feed (simulated ingestion)', retrievedAt: nowIso() } })));
    setIngesting(false);
    setFilter('new');
  };

  const convert = (s: Signal) => openNewOpp({
    title: s.title.replace(/^.*?:\s*/, ''), companyId: s.companyIds[0], description: `${s.detail} (From signal: ${s.title})`, facultyIds: s.facultyIds,
    nextAction: s.suggestedAction, signalIds: [s.id],
    onCreated: async (oppId) => { await markSignalConverted(s.id, oppId); navigate(`/opportunities/${oppId}`); },
  });
  const attach = async (s: Signal) => {
    const candidates = Object.values(db.opportunities).filter((o) => o.stage !== 'closed' && (s.companyIds.includes(o.companyId) || o.facultyIds.some((f) => s.facultyIds.includes(f))));
    const pool = candidates.length ? candidates : Object.values(db.opportunities).filter((o) => o.stage !== 'closed');
    const id = await ask({ title: 'Attach to an opportunity', confirmLabel: 'Attach', input: { label: candidates.length ? 'Related opportunities' : 'Opportunity', required: true, options: pool.map((o) => ({ value: o.id, label: `${o.title} — ${db.companies[o.companyId]?.name}` })) } });
    if (id) attachSignal(s.id, id);
  };

  return (
    <Page wide>
      <PageHeader
        title="Signals"
        description="Events that might open or change an engagement: new research, new IP, company news, funding calls. Triage them into opportunities — or dismiss them."
        actions={isDemo
          ? <Tip content="Simulates the ingestion pipeline with a demo feed. No external sources are queried."><span><Button icon={<DownloadCloud className="h-4 w-4" />} loading={ingesting} onClick={ingest}>Run demo ingestion</Button></span></Tip>
          : <Link to="/admin"><Button icon={<DownloadCloud className="h-4 w-4" />}>Data sync</Button></Link>}
      />
      <InfoNote className="mb-5" icon={<Radar />}>{isDemo
        ? <>Signals here come from a <b>simulated feed</b>. In the live workspace they are created automatically when a sync finds new projects, publications or IP, or pushed directly through the ingestion API.</>
        : <>Signals are created automatically when a data sync finds new projects, publications or IP, and can be pushed directly through the ingestion API (<code>entity: "signals"</code>).</>}</InfoNote>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="panel flex flex-col overflow-hidden xl:max-h-[calc(100vh-260px)]">
          <div className="border-b border-line p-3"><Segmented value={filter} onChange={setFilter} className="w-full [&>button]:flex-1 [&>button]:justify-center" options={[{ value: 'new', label: 'To triage' }, { value: 'converted', label: 'Converted' }, { value: 'dismissed', label: 'Dismissed' }, { value: 'all', label: 'All' }]} /></div>
          <ul className="flex-1 overflow-y-auto scroll-thin divide-y divide-line" tabIndex={0} aria-label="Signals">
            {rows.length === 0 && <EmptyState icon={<Check />} title="All triaged">Nothing waiting. Run the demo ingestion to see new signals arrive.</EmptyState>}
            {rows.map((s) => (
              <li key={s.id} onClick={() => setParams({ item: s.id })} className={cn('relative cursor-pointer px-4 py-3 transition-colors', selected?.id === s.id ? 'bg-accent-soft/60' : 'hover:bg-subtle/70')}>
                {selected?.id === s.id && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
                <div className="flex items-center gap-1.5 text-xs text-ink-3 [&>svg]:h-3.5 [&>svg]:w-3.5">{KIND[s.kind].icon}{KIND[s.kind].label}<span className="ml-auto">{relTime(s.date)}</span></div>
                <div className={cn('mt-1 text-sm leading-snug', s.status === 'new' ? 'font-medium text-ink' : 'text-ink-2')}>{s.status === 'new' && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />}{s.title}</div>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-3">
                  {relevance[s.id]?.length > 0 && <span className="text-accent">{relevance[s.id].length} related need{relevance[s.id].length > 1 ? 's' : ''}</span>}
                  {s.status !== 'new' && <Badge tone={s.status === 'converted' ? 'good' : s.status === 'dismissed' ? 'neutral' : 'outline'} className="capitalize">{s.status}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {selected ? (
          <div className="panel p-6 space-y-5 animate-fade-in" key={selected.id}>
            <div>
              <div className="flex items-center gap-2"><Badge tone="accent" icon={<span className="[&>svg]:h-3 [&>svg]:w-3">{KIND[selected.kind].icon}</span>}>{KIND[selected.kind].label}</Badge><Badge tone="outline" className="capitalize">{selected.status}</Badge><span className="text-xs text-ink-3">{fmtDate(selected.date)}</span></div>
              <h2 className="mt-2 text-xl font-semibold text-ink">{selected.title}</h2>
              <p className="mt-1 text-md text-ink-2">{selected.detail}</p>
              <SourceLine source={selected.source} className="mt-2" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-md bg-canvas p-4 ring-1 ring-line/70">
                <div className="eyebrow mb-2">Affected</div>
                <ul className="space-y-2">
                  {selected.facultyIds.map((f) => <li key={f}><Link to={`/faculty/${f}`} className="flex items-center gap-2 text-sm hover:text-accent"><Avatar name={db.faculty[f]?.name ?? '?'} size={22} />{db.faculty[f]?.name}</Link></li>)}
                  {selected.companyIds.map((c) => <li key={c}><Link to={`/companies/${c}`} className="flex items-center gap-2 text-sm hover:text-accent"><CompanyMark name={db.companies[c]?.name ?? '?'} size={22} />{db.companies[c]?.name}</Link></li>)}
                </ul>
                <div className="mt-3"><TopicChips ids={selected.topics} /></div>
              </div>
              <div className="rounded-md bg-accent-soft/40 p-4 ring-1 ring-accent-line">
                <div className="eyebrow mb-2 text-accent">Suggested next step</div>
                <p className="text-sm text-ink">{selected.suggestedAction}</p>
                <p className="mt-2 text-xs text-ink-3">Rule-based suggestion. A person decides.</p>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2">Why it may matter</div>
              {relevance[selected.id]?.length ? (
                <ul className="divide-y divide-line rounded-md ring-1 ring-line">
                  {relevance[selected.id].map((i) => <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span><span className="text-ink">{i.title}</span> <span className="text-ink-3">· {db.companies[i.companyId]?.name}</span></span><span className="text-xs text-ink-3">shares {i.topics.filter((t) => selected.topics.includes(t)).map(conceptLabel).join(', ')}</span></li>)}
                </ul>
              ) : <p className="text-sm text-ink-3">No open company needs share these topics.</p>}
            </div>
            {selected.opportunityId && db.opportunities[selected.opportunityId] && (
              <div className="flex items-center gap-3 rounded-md bg-good-soft/50 px-4 py-3 ring-1 ring-good/20 text-sm"><Link2 className="h-4 w-4 text-good" />Linked to <Link className="font-medium hover:text-accent" to={`/opportunities/${selected.opportunityId}`}>{db.opportunities[selected.opportunityId].title}</Link><StageBadge stage={db.opportunities[selected.opportunityId].stage} /></div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => convert(selected)}>Create opportunity</Button>
              <Button icon={<Link2 className="h-4 w-4" />} onClick={() => attach(selected)}>Attach to existing</Button>
              {selected.status === 'new' && <Button icon={<Check className="h-4 w-4" />} onClick={() => setSignalStatus(selected.id, 'reviewed')}>Mark reviewed</Button>}
              {selected.status !== 'dismissed' && <Button variant="ghost" className="ml-auto" icon={<X className="h-4 w-4" />} onClick={() => setSignalStatus(selected.id, 'dismissed')}>Dismiss</Button>}
            </div>
          </div>
        ) : <div className="panel"><EmptyState icon={<Radar />} title="No signal selected" /></div>}
      </div>
    </Page>
  );
}
