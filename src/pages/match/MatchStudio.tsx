import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight, Ban, Bookmark, BookmarkCheck, CircleHelp, Columns3, History, ListChecks, MessageSquare, Pencil, Send, Sparkles, Star, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { conceptLabel } from '@shared/taxonomy';
import type { MatchResponse, MatchResult } from '@shared/matching/types';
import type { Candidate, CandidateStatus, MatchRequest, OpportunityType } from '@shared/types';
import { api } from '@/lib/api';
import { useDb, useStore } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { cn } from '@/lib/cn';
import { relTime, plural } from '@/lib/format';
import { deleteSearch, requestReview, saveSearch, setCandidate } from '@/lib/actions';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, EmptyState, Segmented, Checkbox, Select } from '@/components/ui/primitives';
import { Dialog, Tip, ask } from '@/components/ui/overlays';
import { BandBadge, EvidenceMark, FreshnessBadge, ScoreDial, CompanyLink } from '@/components/domain';
import { motion } from 'motion/react';
import { t } from '@/lib/motion';
import { ConfidenceBreakdown, CoverageTable, EvidenceList, NotProof, ScoreBreakdown, ScoreHeader, UnknownsAndConcerns } from '@/components/match/Explanation';
import { CompareView, RankingWhy } from '@/components/match/Compare';
import { Composer, ExamplePrompts, ENGAGEMENT_OPTIONS } from './Composer';
import { EXAMPLES, emptyRequest } from './examples';

const DISMISS_REASONS = ['Wrong expertise', 'Already engaged with this company', 'Known to be unavailable', 'Too junior / senior for scope', 'Duplicate of another candidate', 'Other'];
const STATUS_META: Record<CandidateStatus, { label: string; tone: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' }> = {
  suggested: { label: 'Suggested', tone: 'neutral' }, saved: { label: 'Saved', tone: 'accent' }, promising: { label: 'Promising', tone: 'good' },
  'needs-info': { label: 'Needs info', tone: 'warn' }, dismissed: { label: 'Dismissed', tone: 'bad' }, 'in-review': { label: 'In review', tone: 'accent' },
};
const SHORTLISTED: CandidateStatus[] = ['saved', 'promising', 'needs-info', 'in-review'];

/** Last run, kept across route remounts so returning to a search is instant (results are deterministic). */
let lastRun: { searchId: string; request: MatchRequest; response: MatchResponse; selected: string | null } | null = null;

export function MatchStudio() {
  const db = useDb();
  const { searchId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const openNewOpp = useUI((s) => s.openNewOpp);

  const [request, setRequest] = useState<MatchRequest>(emptyRequest);
  const meta = useStore((s) => s.meta);
  const [providerId, setProviderId] = useState<string>(meta?.defaultProvider ?? 'baseline');
  const [response, setResponse] = useState<MatchResponse | null>(null);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [tab, setTab] = useState<'results' | 'shortlist'>('results');
  const [sort, setSort] = useState<'score' | 'confidence'>('score');
  const [showDismissed, setShowDismissed] = useState(false);

  const search = searchId ? db.searches[searchId] : undefined;
  const linkedOppId = search?.opportunityId ?? params.get('opp') ?? undefined;
  const linkedOpp = linkedOppId ? db.opportunities[linkedOppId] : undefined;

  // Prefill from URL: saved search, demo example, company interest or opportunity.
  useEffect(() => {
    if (searchId) {
      if (lastRun?.searchId === searchId) {
        setRequest(lastRun.request); setResponse(lastRun.response); setSelected(lastRun.selected); setPhase('done');
        return;
      }
      const s = db.searches[searchId];
      if (!s) return;
      setRequest(s.request);
      if (meta?.providers.some((p) => p.id === s.providerId)) setProviderId(s.providerId);
      execute(s.request, false, s.providerId);
      return;
    }
    setResponse(null); setPhase('idle'); setSelected(null); setCompare([]);
    const demo = params.get('demo');
    const interestId = params.get('interest');
    const oppId = params.get('opp');
    if (demo) { const ex = EXAMPLES.find((e) => e.id === demo); if (ex) setRequest(usableExample(ex.request)); }
    else if (interestId && db.interests[interestId]) {
      const i = db.interests[interestId];
      setRequest({ ...emptyRequest(), text: i.description, topics: i.topics, companyId: i.companyId, interestId: i.id, engagementType: i.pathway === 'talent' ? 'talent' : i.pathway === 'engagement' ? 'engagement' : 'research' });
    } else if (oppId && db.opportunities[oppId]) {
      const o = db.opportunities[oppId];
      const i = o.interestId ? db.interests[o.interestId] : undefined;
      setRequest({ ...emptyRequest(), text: o.description, topics: i?.topics ?? [], companyId: o.companyId, interestId: o.interestId, engagementType: o.type === 'licensing' ? 'licensing' : o.type === 'recruiting' ? 'talent' : o.type.includes('event') || o.type.includes('center') ? 'engagement' : 'research', constraints: { excludeFacultyIds: [] } });
    } else setRequest(emptyRequest());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId, params.toString()]);

  /** Examples reference demo companies; drop those links where the company doesn't exist (live workspace). */
  function usableExample(r: MatchRequest): MatchRequest {
    return r.companyId && !db.companies[r.companyId] ? { ...r, companyId: undefined, interestId: undefined } : r;
  }

  async function execute(req: MatchRequest, persist: boolean, provider = providerId) {
    setPhase('running'); setEditing(false);
    const started = Date.now();
    try {
      const res = await api.match(req, provider);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const wait = reduced ? 0 : Math.max(0, 1100 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setResponse(res);
      setPhase('done');
      setSelected(res.results[0]?.facultyId ?? null);
      setTab('results');
      if (!persist && searchId) lastRun = { searchId, request: req, response: res, selected: res.results[0]?.facultyId ?? null };
      if (persist) {
        const company = req.companyId ? db.companies[req.companyId]?.name : undefined;
        const title = `${company ? `${company}: ` : ''}${res.requestConcepts.slice(0, 3).map(conceptLabel).join(', ') || req.text.slice(0, 48)}`;
        const id = await saveSearch(req, res, title, linkedOppId);
        lastRun = { searchId: id, request: req, response: res, selected: res.results[0]?.facultyId ?? null };
        navigate(`/match/${id}`);
      }
    } catch (e) {
      setPhase('idle');
      toast.error(e instanceof Error ? e.message : 'Matching failed');
    }
  }

  const candidates: Record<string, Candidate> = useMemo(() => Object.fromEntries((search?.candidates ?? []).map((c) => [c.facultyId, c])), [search]);
  const byId = useMemo(() => Object.fromEntries((response?.results ?? []).map((r) => [r.facultyId, r])), [response]);
  const results = useMemo(() => {
    const rs = [...(response?.results ?? [])].filter((r) => showDismissed || candidates[r.facultyId]?.status !== 'dismissed');
    if (sort === 'confidence') rs.sort((a, b) => b.confidence.score - a.confidence.score || b.score - a.score);
    return rs;
  }, [response, sort, showDismissed, candidates]);
  const dismissedCount = (response?.results ?? []).filter((r) => candidates[r.facultyId]?.status === 'dismissed').length;
  const shortlist = Object.values(candidates).filter((c) => SHORTLISTED.includes(c.status));
  const current = selected ? byId[selected] : undefined;
  useEffect(() => { if (selected && lastRun && lastRun.searchId === searchId) lastRun.selected = selected; }, [selected, searchId]);

  const mark = async (fid: string, status: CandidateStatus, extra: Partial<Candidate> = {}) => {
    if (!searchId) return;
    const name = db.faculty[fid].name;
    await setCandidate(searchId, fid, { status, ...extra }, status === 'dismissed' ? `Dismissed ${name}` : status === 'suggested' ? 'Removed from shortlist' : `${name} → ${STATUS_META[status].label.toLowerCase()}`);
  };
  const dismiss = async (fid: string) => {
    const reason = await ask({ title: `Dismiss ${db.faculty[fid].name}?`, body: 'Dismissed candidates are hidden from results. The reason is kept so the matching algorithm can learn from it later.', confirmLabel: 'Dismiss', input: { label: 'Reason', options: DISMISS_REASONS.map((r) => ({ value: r, label: r })), required: true } });
    if (reason) mark(fid, 'dismissed', { dismissReason: reason });
  };
  const note = async (fid: string) => {
    const text = await ask({ title: `Note on ${db.faculty[fid].name}`, confirmLabel: 'Save note', input: { label: 'Note', multiline: true, required: true, initial: candidates[fid]?.note } });
    if (text !== null && searchId) setCandidate(searchId, fid, { note: text, status: candidates[fid]?.status === 'suggested' || !candidates[fid] ? 'saved' : candidates[fid].status }, 'Note saved');
  };
  const toggleCompare = (fid: string) => setCompare((c) => (c.includes(fid) ? c.filter((x) => x !== fid) : c.length >= 4 ? (toast.message('Compare up to four researchers'), c) : [...c, fid]));

  const sendShortlistToReview = async (ids: string[]) => {
    if (!searchId || !ids.length) return;
    const ctx = Object.fromEntries(ids.map((id) => [id, byId[id]]).filter(([, r]) => r));
    if (linkedOpp) {
      if (await requestReview(linkedOpp.id, ids, ctx)) {
        for (const id of ids) await setCandidate(searchId, id, { status: 'in-review' });
        navigate(`/opportunities/${linkedOpp.id}`);
      }
      return;
    }
    const interest = request.interestId ? db.interests[request.interestId] : undefined;
    const type: OpportunityType = request.engagementType === 'licensing' ? 'licensing' : request.engagementType === 'talent' ? 'recruiting' : request.engagementType === 'engagement' ? 'event-sponsorship' : 'sponsored-research';
    openNewOpp({
      title: interest?.title ?? (response?.requestConcepts.slice(0, 2).map(conceptLabel).join(' & ') || 'Research collaboration'),
      companyId: request.companyId, interestId: request.interestId, type, priority: 'high',
      description: request.text + (request.outcome ? ` Desired outcome: ${request.outcome}` : ''),
      facultyIds: ids, matchSearchId: searchId, requestReviewFor: ids, reviewContext: ctx,
      nextAction: 'Reviewer to check evidence and contact details',
      onCreated: async (oppId) => {
        for (const id of ids) await setCandidate(searchId, id, { status: 'in-review' });
        navigate(`/opportunities/${oppId}`);
      },
    });
  };

  const recent = Object.values(db.searches).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const showComposer = phase === 'idle' || editing;

  return (
    <Page wide>
      <PageHeader
        title={search ? search.title : 'Match Studio'}
        description={phase === 'idle' ? 'Describe a company’s need. Researchers are ranked by evidence, every score is explained, and a person decides what happens next.' : undefined}
        crumbs={search ? [{ label: 'Match Studio', to: '/match' }, { label: `Saved search · ${relTime(search.createdAt)}` }] : undefined}
        meta={linkedOpp && <Badge tone="accent">Matching for: <Link className="underline" to={`/opportunities/${linkedOpp.id}`}>{linkedOpp.title}</Link></Badge>}
        actions={<>
          {(meta?.providers.length ?? 0) > 1 && (
            <Tip content="Which matching algorithm ranks the results. Register new ones in server/matchers.">
              <span><Select className="h-8 w-auto" value={providerId} onChange={(v) => { setProviderId(v); if (phase === 'done') execute(request, true, v); }} options={meta!.providers.map((p) => ({ value: p.id, label: `Matcher: ${p.name}` }))} aria-label="Matcher" /></span>
            </Tip>
          )}
          {phase !== 'idle' && <Button variant="secondary" icon={<Sparkles className="h-4 w-4" />} onClick={() => navigate('/match')}>New search</Button>}
        </>}
      />

      {showComposer && phase === 'idle' && (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <Composer value={request} onChange={setRequest} onRun={() => execute(request, true)} running={false} />
            <MethodNote providerId={providerId} />
          </div>
          <aside className="space-y-7">
            <div>
              <div className="mb-1.5 eyebrow">Start from an example</div>
              <ExamplePrompts onPick={(r) => setRequest(usableExample(r))} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 eyebrow"><History className="h-3 w-3" />Recent searches</div>
              {recent.length === 0 ? <p className="border-y border-line py-3 text-[13px] text-ink-3">Searches you run are saved here automatically, with their shortlists.</p> : (
                <ul className="divide-y divide-line border-y border-line">
                  {recent.map((s) => (
                    <li key={s.id} className="group flex items-center hover:bg-surface/70">
                      <Link to={`/match/${s.id}`} className="min-w-0 flex-1 px-1 py-2">
                        <span className="block truncate text-[13px] text-ink group-hover:text-accent">{s.title}</span>
                        <span className="meta">{relTime(s.createdAt)} · {s.snapshot.length} ranked · {s.candidates.filter((c) => SHORTLISTED.includes(c.status)).length} shortlisted</span>
                      </Link>
                      <Button variant="ghost" size="icon-sm" className="mr-1 opacity-0 focus:opacity-100 group-hover:opacity-100" aria-label={`Delete search ${s.title}`} onClick={() => deleteSearch(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {phase !== 'idle' && (
        <>
          {editing ? (
            <div className="mb-5 animate-slide-up"><Composer compact value={request} onChange={setRequest} onRun={() => execute(request, true)} running={phase === 'running'} /></div>
          ) : (
            <BriefBar request={request} response={response} onEdit={() => setEditing(true)} />
          )}

          {phase === 'running' && <RunningState request={request} />}

          {phase === 'done' && response && (
            response.results.length === 0 ? (
              <div className="panel"><EmptyState icon={<Sparkles />} title="No researchers matched" action={<Button onClick={() => setEditing(true)}>Refine the request</Button>}>
                {response.requestConcepts.length === 0 ? 'The matcher couldn’t recognise research topics in the request. Add topics explicitly.' : `${response.excluded.length} researchers were excluded by hard constraints. Try relaxing them.`}
              </EmptyState></div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <section aria-label="Results" className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <Segmented value={tab} onChange={setTab} options={[{ value: 'results', label: <>Ranked results <span className="text-ink-4 tabular">{response.results.length}</span></> }, { value: 'shortlist', label: <>Shortlist <span className="text-ink-4 tabular">{shortlist.length}</span></> }]} />
                    {tab === 'results' && (
                      <div className="flex items-center gap-2">
                        {dismissedCount > 0 && <Button size="sm" variant="ghost" onClick={() => setShowDismissed(!showDismissed)}>{showDismissed ? 'Hide' : 'Show'} {dismissedCount} dismissed</Button>}
                        <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: 'score', label: 'By match' }, { value: 'confidence', label: 'By confidence' }]} />
                      </div>
                    )}
                  </div>
                  {tab === 'results' ? (
                    <>
                    <div className="hidden grid-cols-[minmax(0,1fr)_64px_92px] gap-3 px-4 pb-1.5 sm:grid" aria-hidden>
                      <span className="eyebrow">Researcher</span>
                      <Tip content="How well the evidence matches the need (0–100). A ranking, not a probability."><span className="eyebrow cursor-help text-right underline decoration-dotted underline-offset-2">Relevance</span></Tip>
                      <Tip content="How far to trust the underlying records — recency, sources, verification. Independent of relevance."><span className="eyebrow cursor-help underline decoration-dotted underline-offset-2">Evidence</span></Tip>
                    </div>
                    <ol className="panel divide-y divide-line overflow-hidden" aria-label="Ranked researchers">
                      {results.map((r) => (
                        <ResultRow key={r.facultyId} r={r} active={selected === r.facultyId} candidate={candidates[r.facultyId]}
                          comparing={compare.includes(r.facultyId)} onSelect={() => setSelected(r.facultyId)} onCompare={() => toggleCompare(r.facultyId)}
                          onSave={() => mark(r.facultyId, candidates[r.facultyId] && SHORTLISTED.includes(candidates[r.facultyId].status) ? 'suggested' : 'saved')} />
                      ))}
                    </ol>
                    </>
                  ) : (
                    <ShortlistPanel candidates={shortlist} results={byId} linkedOppTitle={linkedOpp?.title} onSelect={(id) => { setSelected(id); }} onSend={sendShortlistToReview} onCompare={(ids) => { setCompare(ids.slice(0, 4)); setCompareOpen(true); }} onNote={note} />
                  )}
                  {response.excluded.length > 0 && tab === 'results' && (
                    <p className="mt-3 px-1 text-xs text-ink-3">{plural(response.excluded.length, 'researcher')} excluded by hard constraints ({[...new Set(response.excluded.map((e) => e.reason))].join('; ')}).</p>
                  )}
                </section>

                <section aria-label="Match explanation" className="min-w-0">
                  {current ? (
                    <Inspector key={current.facultyId} r={current} total={response.results.length} candidate={candidates[current.facultyId]}
                      next={response.results.find((x) => x.rank === current.rank + 1)}
                      onMark={(s) => mark(current.facultyId, s)} onDismiss={() => dismiss(current.facultyId)} onNote={() => note(current.facultyId)} />
                  ) : <div className="panel"><EmptyState title="Select a researcher" >Choose a result to see why it ranked where it did.</EmptyState></div>}
                </section>
              </div>
            )
          )}
        </>
      )}

      {compare.length > 0 && phase === 'done' && !compareOpen && (
        <div className="fixed bottom-5 inset-x-0 mx-auto w-fit z-30 flex items-center gap-3 rounded-xl bg-navy px-3 py-2 text-white shadow-lg animate-slide-up">
          <span className="flex -space-x-1.5">{compare.map((id) => <Avatar key={id} name={db.faculty[id].name} size={26} className="ring-2 ring-navy bg-white" />)}</span>
          <span className="text-sm">{compare.length} selected</span>
          <Button size="sm" variant="primary" icon={<Columns3 className="h-3.5 w-3.5" />} disabled={compare.length < 2} onClick={() => setCompareOpen(true)}>Compare</Button>
          <button className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Clear selection" onClick={() => setCompare([])}><X className="h-4 w-4" /></button>
        </div>
      )}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen} size="full" title="Compare researchers" description="Side by side, with the same evidence the ranking used. Green marks the strongest value in a row.">
        {compare.length >= 2 && <div className="space-y-4">
          <CompareView facultyIds={compare} results={byId} />
          {byId[compare[0]] && byId[compare[1]] && <RankingWhy a={[byId[compare[0]], byId[compare[1]]].sort((x, y) => x.rank - y.rank)[0]} b={[byId[compare[0]], byId[compare[1]]].sort((x, y) => x.rank - y.rank)[1]} />}
          <div className="flex flex-wrap gap-2">
            {compare.map((id) => (
              <Button key={id} size="sm" icon={<Bookmark className="h-3.5 w-3.5" />} onClick={() => mark(id, 'saved')} disabled={SHORTLISTED.includes(candidates[id]?.status)}>
                {SHORTLISTED.includes(candidates[id]?.status) ? `${db.faculty[id].name.split(' ')[0]} shortlisted` : `Shortlist ${db.faculty[id].name.split(' ')[0]}`}
              </Button>
            ))}
          </div>
        </div>}
      </Dialog>
    </Page>
  );
}

/* ------------------------------------------------------------------------ */

function BriefBar({ request, response, onEdit }: { request: MatchRequest; response: MatchResponse | null; onEdit: () => void }) {
  const db = useDb();
  return (
    <div className="panel mb-5 flex flex-wrap items-start gap-x-6 gap-y-3 border-l-[3px] border-l-accent px-5 py-3.5">
      <div className="min-w-0 flex-1 basis-[420px]">
        <div className="eyebrow mb-1">Company need</div>
        <p className="line-clamp-2 text-[15px] leading-snug text-ink">{request.text || 'Topics only'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(response?.requestConcepts ?? []).map((c) => <Badge key={c} tone="accent">{conceptLabel(c)}</Badge>)}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-ink-3">Company</dt><dd className="text-ink">{request.companyId ? <CompanyLink id={request.companyId} /> : '—'}</dd></div>
        <div><dt className="text-xs text-ink-3">Engagement</dt><dd className="text-ink">{ENGAGEMENT_OPTIONS.find((o) => o.value === request.engagementType)?.label}</dd></div>
        <div><dt className="text-xs text-ink-3">Matcher</dt><dd className="text-ink"><Tip content={response?.method}><span className="mono !text-[12px] !text-ink underline decoration-dotted underline-offset-2">{response ? `${response.providerId} v${response.providerVersion}` : '…'}</span></Tip></dd></div>
        {request.interestId && <div className="col-span-2"><dt className="text-xs text-ink-3">Interest</dt><dd className="text-ink truncate">{db.interests[request.interestId]?.title}</dd></div>}
      </dl>
      <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>Refine</Button>
    </div>
  );
}

function RunningState({ request }: { request: MatchRequest }) {
  const db = useDb();
  const [step, setStep] = useState(0);
  useEffect(() => { const t = [setTimeout(() => setStep(1), 250), setTimeout(() => setStep(2), 550), setTimeout(() => setStep(3), 850)]; return () => t.forEach(clearTimeout); }, []);
  const steps = [
    'Reading the request and detecting research topics',
    'Expanding to adjacent fields with the topic taxonomy',
    `Scanning ${Object.keys(db.faculty).length} researchers · ${Object.keys(db.projects).length} projects · ${Object.keys(db.publications).length} publications · ${Object.keys(db.ip).length} IP records`,
    'Scoring, checking constraints and estimating evidence confidence',
  ];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" aria-live="polite">
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="panel flex items-center gap-3 p-4" style={{ opacity: 1 - i * 0.15 }}>
            <div className="skeleton h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-3.5 w-1/3" /><div className="skeleton h-3 w-2/3" /></div><div className="skeleton h-11 w-11 rounded-full" />
          </div>
        ))}
      </div>
      <div className="panel p-6">
        <div className="text-sm font-semibold text-ink">Matching{request.companyId ? ` for ${db.companies[request.companyId]?.name}` : ''}…</div>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={s} className={cn('flex items-center gap-3 text-sm transition-opacity duration-300', i <= step ? 'opacity-100' : 'opacity-30')}>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold', i < step ? 'bg-good text-white' : i === step ? 'bg-accent text-white animate-pulse' : 'bg-subtle text-ink-3')}>{i < step ? '✓' : i + 1}</span>
              <span className="text-ink-2">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ResultRow({ r, active, candidate, comparing, onSelect, onCompare, onSave }: {
  r: MatchResult; active: boolean; candidate?: Candidate; comparing: boolean; onSelect: () => void; onCompare: () => void; onSave: () => void;
}) {
  const db = useDb();
  const f = db.faculty[r.facultyId];
  const dept = db.departments[f.departmentId];
  const saved = candidate && SHORTLISTED.includes(candidate.status);
  const dismissed = candidate?.status === 'dismissed';
  const supported = r.concepts.filter((c) => c.strength > 0);
  const missing = r.concepts.filter((c) => c.strength === 0);
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: dismissed ? 0.55 : 1, y: 0 }}
      transition={{ ...t.base, delay: Math.min(r.rank, 10) * 0.025 }}
      className={cn('group relative cursor-pointer px-4 py-3 outline-none transition-colors duration-fast focus-visible:bg-accent-soft/40',
        active ? 'bg-accent-soft/50' : 'hover:bg-subtle/60')}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const el = (e.currentTarget as HTMLElement)[e.key === 'ArrowDown' ? 'nextElementSibling' : 'previousElementSibling'] as HTMLElement | null; el?.focus(); el?.click(); }
      }}
      tabIndex={0}
      aria-selected={active}
      aria-label={`Rank ${r.rank}: ${f.name}, relevance ${r.score}, ${r.confidence.level} evidence confidence`}
    >
      {active && <motion.span layoutId="match-active" transition={t.layout} className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_64px_92px]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-[11px] text-ink-4 tabular">{String(r.rank).padStart(2, '0')}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14px] font-semibold text-ink">{f.name}</span>
              {candidate && candidate.status !== 'suggested' && <Badge tone={STATUS_META[candidate.status].tone}>{STATUS_META[candidate.status].label}</Badge>}
            </div>
            <div className="truncate text-[12.5px] text-ink-3">{f.title} · {dept?.name}</div>
          </div>
        </div>
        <div className="max-sm:hidden"><ScoreDial score={r.score} band={r.band} /></div>
        <div className="flex flex-col items-start gap-0.5 pt-0.5 max-sm:items-end">
          <span className="sm:hidden"><ScoreDial score={r.score} band={r.band} /></span>
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2"><EvidenceMark level={r.confidence.level} /><span className="capitalize">{r.confidence.level}</span></span>
          <FreshnessBadge iso={f.lastVerified} compact />
        </div>
      </div>
      <div className="ml-8 mt-2 flex flex-wrap gap-1">
        {supported.map((c) => (
          <span key={c.concept} className={cn('inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11.5px]', c.direct ? 'bg-good-soft text-good' : 'bg-accent-soft text-accent')} title={c.direct ? 'Direct evidence' : 'Adjacent field'}>
            {c.direct ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : <span className="h-1.5 w-1.5 rounded-full ring-1 ring-current" />}{conceptLabel(c.concept)}
          </span>
        ))}
        {missing.map((c) => <span key={c.concept} className="inline-flex h-5 items-center rounded-sm px-1.5 text-[11.5px] border border-dashed border-line-strong text-ink-3" title="No evidence found — not the same as no expertise">{conceptLabel(c.concept)} · no evidence</span>)}
      </div>
      <p className="ml-8 mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-2">{r.summary}</p>
      {dismissed && candidate?.dismissReason && <p className="ml-8 mt-1 text-xs text-bad">Dismissed: {candidate.dismissReason}</p>}
      {candidate?.note && <p className="ml-8 mt-1.5 flex items-start gap-1.5 text-xs text-ink-3"><MessageSquare className="mt-[1px] h-3 w-3" />{candidate.note}</p>}
      <div className="ml-8 mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {r.relatedIpIds.length > 0 && <span className="text-[11.5px] text-ink-3">{plural(r.relatedIpIds.length, 'related IP record')}</span>}
        {r.concerns.length > 0 && <span className="text-[11.5px] font-medium text-bad">{plural(r.concerns.length, 'concern')}</span>}
        <span className="ml-auto flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <span className={cn('flex h-7 items-center rounded-md px-2 text-xs font-medium', comparing ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-subtle')}>
            <Checkbox checked={comparing} onChange={onCompare} label={<span className="text-xs font-medium">Compare</span>} className="items-center gap-1.5" />
          </span>
          <Tip content={saved ? 'Remove from shortlist' : 'Save to shortlist'}>
            <Button size="icon-sm" variant={saved ? 'subtle' : 'ghost'} aria-label={saved ? `Remove ${f.name} from shortlist` : `Save ${f.name} to shortlist`} onClick={onSave}>
              {saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}
            </Button>
          </Tip>
        </span>
      </div>
    </motion.li>
  );
}

function Inspector({ r, total, candidate, next, onMark, onDismiss, onNote }: {
  r: MatchResult; total: number; candidate?: Candidate; next?: MatchResult; onMark: (s: CandidateStatus) => void; onDismiss: () => void; onNote: () => void;
}) {
  const db = useDb();
  const f = db.faculty[r.facultyId];
  const dept = db.departments[f.departmentId];
  const status = candidate?.status ?? 'suggested';
  return (
    <motion.div initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={t.base} className="panel lg:sticky lg:top-4 flex max-h-[calc(100dvh-110px)] flex-col overflow-hidden">
      <div className="border-b border-line px-5 pb-4 pt-4">
        <div className="flex items-start gap-3">
          <Avatar name={f.name} size={38} />
          <div className="min-w-0 flex-1">
            <Link to={`/faculty/${f.id}`} className="group inline-flex items-center gap-1 text-[17px] font-semibold tracking-[-0.01em] text-ink hover:text-accent">{f.name}<ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100" /></Link>
            <div className="text-[12.5px] text-ink-3">{f.title} · {dept?.name} · {dept?.college}</div>
          </div>
          <BandBadge band={r.band} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
          <ScoreHeader r={r} total={total} />
          <div className="border-line sm:border-l sm:pl-4">
            <div className="eyebrow">Evidence confidence</div>
            <div className="mt-1.5 flex items-center gap-2 text-[15px] font-semibold capitalize text-ink"><EvidenceMark level={r.confidence.level} />{r.confidence.level}<span className="meta font-normal normal-case">{r.confidence.score}/100</span></div>
            <p className="mt-1 text-[11.5px] leading-4 text-ink-3">Trust in the records — scored separately from relevance.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-5 space-y-6">
        <NotProof />
        <Section title="Score breakdown"><ScoreBreakdown r={r} /></Section>
        <Section title="Topic coverage"><CoverageTable r={r} /></Section>
        <Section title={`Supporting evidence (${r.evidence.length})`}><EvidenceList items={r.evidence} facultyId={f.id} /></Section>
        <Section title="Before any introduction"><UnknownsAndConcerns r={r} /></Section>
        <Section title="Evidence confidence"><ConfidenceBreakdown r={r} /></Section>
        {r.pathways.length > 0 && (
          <Section title="Possible collaboration formats">
            <ul className="space-y-1 text-sm text-ink-2">{r.pathways.map((p) => <li key={p} className="flex gap-2"><span className="text-accent">→</span>{p}</li>)}</ul>
          </Section>
        )}
        {next && <Section title="Compared with the next result"><RankingWhy a={r} b={next} /></Section>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-canvas/70 px-4 py-2.5">
        <Button size="sm" variant={status === 'saved' ? 'primary' : 'secondary'} icon={<Bookmark className="h-3.5 w-3.5" />} onClick={() => onMark(status === 'saved' ? 'suggested' : 'saved')}>{status === 'saved' ? 'Saved' : 'Save'}</Button>
        <Button size="sm" variant={status === 'promising' ? 'primary' : 'secondary'} icon={<Star className="h-3.5 w-3.5" />} onClick={() => onMark(status === 'promising' ? 'saved' : 'promising')}>Promising</Button>
        <Button size="sm" variant={status === 'needs-info' ? 'primary' : 'secondary'} icon={<CircleHelp className="h-3.5 w-3.5" />} onClick={() => onMark(status === 'needs-info' ? 'saved' : 'needs-info')}>Needs info</Button>
        <Button size="sm" variant="ghost" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={onNote}>Note</Button>
        <Button size="sm" variant="ghost" className="ml-auto text-bad hover:bg-bad-soft" icon={<Ban className="h-3.5 w-3.5" />} onClick={onDismiss} disabled={status === 'dismissed'}>Dismiss…</Button>
      </div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="eyebrow mb-2.5">{title}</h3>{children}</section>;
}

function ShortlistPanel({ candidates, results, linkedOppTitle, onSelect, onSend, onCompare, onNote }: {
  candidates: Candidate[]; results: Record<string, MatchResult>; linkedOppTitle?: string;
  onSelect: (id: string) => void; onSend: (ids: string[]) => void; onCompare: (ids: string[]) => void; onNote: (id: string) => void;
}) {
  const db = useDb();
  const sendable = candidates.filter((c) => c.status !== 'in-review').map((c) => c.facultyId);
  const [chosen, setChosen] = useState<string[]>(sendable);
  useEffect(() => setChosen(sendable), [candidates.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!candidates.length) return <div className="panel"><EmptyState icon={<ListChecks />} title="Nothing shortlisted yet">Save or mark candidates as promising from the ranked results. Your shortlist is saved with this search.</EmptyState></div>;
  return (
    <div className="panel">
      <ul className="divide-y divide-line">
        {candidates.sort((a, b) => (results[a.facultyId]?.rank ?? 99) - (results[b.facultyId]?.rank ?? 99)).map((c) => {
          const f = db.faculty[c.facultyId];
          const r = results[c.facultyId];
          return (
            <li key={c.facultyId} className="flex items-start gap-3 px-4 py-3">
              <Checkbox checked={chosen.includes(c.facultyId)} disabled={c.status === 'in-review'} onChange={(v) => setChosen(v ? [...chosen, c.facultyId] : chosen.filter((x) => x !== c.facultyId))} />
              <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => onSelect(c.facultyId)}>
                <Avatar name={f.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="font-medium text-ink">{f.name}</span><Badge tone={STATUS_META[c.status].tone}>{STATUS_META[c.status].label}</Badge></span>
                  <span className="block truncate text-xs text-ink-3">{db.departments[f.departmentId]?.name}</span>
                  {c.note && <span className="mt-1 block text-xs text-ink-2">“{c.note}”</span>}
                </span>
              </button>
              {r && <ScoreDial score={r.score} band={r.band} size={34} />}
              <Button size="icon-sm" variant="ghost" aria-label="Add note" onClick={() => onNote(c.facultyId)}><MessageSquare className="h-3.5 w-3.5" /></Button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line bg-canvas/60 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Send className="h-4 w-4" />} disabled={!chosen.length} onClick={() => onSend(chosen)}>
            {linkedOppTitle ? `Send ${chosen.length} to review` : `Create opportunity & send ${chosen.length} to review`}
          </Button>
          <Button icon={<Columns3 className="h-4 w-4" />} disabled={chosen.length < 2} onClick={() => onCompare(chosen)}>Compare</Button>
        </div>
        <p className="text-xs text-ink-3">{linkedOppTitle ? <>Adds researchers to <b>{linkedOppTitle}</b> and creates review items.</> : 'You’ll confirm opportunity details first.'} Nothing is sent to anyone — reviewers check the evidence before an introduction can be drafted.</p>
      </div>
    </div>
  );
}

/** Which matcher ranks results and what it can't know. Kept visible so the method is never a black box. */
function MethodNote({ providerId }: { providerId: string }) {
  const meta = useStore((s) => s.meta);
  const p = meta?.providers.find((x) => x.id === providerId);
  return (
    <div className="flex items-start gap-3 border-l-2 border-accent-line pl-3 text-xs text-ink-3">
      <CircleHelp className="mt-px h-3.5 w-3.5 shrink-0" />
      <p>
        Ranked by <span className="font-medium text-ink-2">{p?.name ?? providerId}</span> <span className="mono">v{p?.version ?? '—'}</span>. {p?.description}
        {' '}A relevance score ranks evidence of expertise; it says nothing about availability or willingness to collaborate.
      </p>
    </div>
  );
}
