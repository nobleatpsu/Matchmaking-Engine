import { useMemo, useState } from 'react';
import { requestForOpportunity } from '@shared/matching/requests';
import { token, useTheme } from '@/lib/theme';
import { useDb, useIsDemo } from '@/lib/store';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FlaskConical, Info } from 'lucide-react';
import { OUTCOME_LABELS, STAGES, STAGE_INDEX, freshness } from '@shared/rules';
import { runBaseline } from '@shared/matching/baseline';
import type { Stage } from '@shared/types';
import { cn } from '@/lib/cn';
import { corpusOf } from '@/lib/corpus';
import { fmtDate } from '@/lib/format';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Badge, Meter, Segmented } from '@/components/ui/primitives';
import { Tip } from '@/components/ui/overlays';
import { InfoNote, ScoreDial } from '@/components/domain';

const RANGES = { '90': 90, '365': 365, all: 100000 } as const;
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const axis = () => ({ fontSize: 11, fill: token('ink-3'), fontFamily: 'Roboto Variable, Roboto, sans-serif' });

export function AnalyticsPage() {
  const db = useDb();
  const isDemo = useIsDemo();
  const [range, setRange] = useState<keyof typeof RANGES>('365');
  const since = Date.now() - RANGES[range] * 864e5;
  const inRange = (iso?: string) => !!iso && Date.parse(iso) >= since;

  const opps = Object.values(db.opportunities);
  const reviews = Object.values(db.reviews);
  const m = useMemo(() => {
    const created = opps.filter((o) => inRange(o.createdAt));
    const decided = reviews.filter((r) => ['match', 'introduction', 'low-confidence'].includes(r.kind) && (r.status === 'approved' || r.status === 'rejected') && inRange(r.decidedAt));
    const approved = decided.filter((r) => r.status === 'approved');
    const intros = Object.values(db.drafts).filter((d) => d.status === 'recorded-sent' && inRange(d.recordedAt));
    const meetings = Object.values(db.activities).filter((a) => a.kind === 'meeting' && inRange(a.at));
    const outcomes = opps.flatMap((o) => o.outcomes.map((x) => ({ ...x, opp: o }))).filter((x) => inRange(x.recordedAt));
    const success = outcomes.filter((x) => OUTCOME_LABELS[x.kind].success);
    const agreements = outcomes.filter((x) => x.kind === 'agreement-signed' || x.kind === 'successful-collaboration');
    const failed = outcomes.filter((x) => OUTCOME_LABELS[x.kind].success === false);
    return { created, decided, approved, intros, meetings, outcomes, success, agreements, failed };
  }, [db, range]); // eslint-disable-line react-hooks/exhaustive-deps

  // Funnel: opportunities (created in range) that ever reached each stage.
  const funnel = STAGES.filter((s) => s.id !== 'closed').map((s) => ({
    stage: s.label, n: m.created.filter((o) => o.stageHistory.some((h) => STAGE_INDEX[h.stage] >= STAGE_INDEX[s.id] && h.stage !== 'closed') || STAGE_INDEX[o.stage] >= STAGE_INDEX[s.id] && o.stage !== 'closed').length,
  }));

  // Median days between consecutive stages.
  const transitions: [Stage, Stage][] = [['new', 'discovery'], ['discovery', 'matching'], ['matching', 'review'], ['review', 'intro-prepared'], ['intro-prepared', 'intro-recorded'], ['intro-recorded', 'discussion'], ['discussion', 'outcome']];
  const times = transitions.map(([a, b]) => {
    const ds = opps.map((o) => { const x = o.stageHistory.find((h) => h.stage === a); const y = o.stageHistory.find((h) => h.stage === b); return x && y ? (Date.parse(y.at) - Date.parse(x.at)) / 864e5 : null; }).filter((d): d is number => d !== null && d >= 0);
    return { from: a, to: b, median: median(ds), n: ds.length };
  });

  const outcomeBars = Object.entries(OUTCOME_LABELS).map(([k, v]) => ({ label: v.label, n: m.outcomes.filter((o) => o.kind === k).length, success: v.success })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);

  // Prediction vs. outcome — current baseline score for each outcome with a researcher.
  const predictions = useMemo(() => {
    const corpus = corpusOf(db);
    return opps.flatMap((o) => o.outcomes.filter((x) => x.facultyId).map((x) => {
      const f = db.faculty[x.facultyId!];
      const r = f ? runBaseline(requestForOpportunity(db, o), { ...corpus, faculty: [f] }).results[0] : undefined;
      return { opp: o, outcome: x, score: r?.score, band: r?.band, success: OUTCOME_LABELS[x.kind].success };
    }));
  }, [db, opps]);
  const avg = (xs: (number | undefined)[]) => { const v = xs.filter((x): x is number => x !== undefined); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const avgOk = avg(predictions.filter((p) => p.success).map((p) => p.score));
  const avgBad = avg(predictions.filter((p) => p.success === false).map((p) => p.score));

  const byIndustry = Object.entries(m.created.reduce<Record<string, number>>((acc, o) => { const k = db.companies[o.companyId]?.industry ?? 'Unknown'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  const byDept = Object.entries(m.created.flatMap((o) => o.facultyIds).reduce<Record<string, number>>((acc, f) => { const d = db.departments[db.faculty[f]?.departmentId]?.name ?? 'Unknown'; acc[d] = (acc[d] ?? 0) + 1; return acc; }, {})).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 8);

  const fac = Object.values(db.faculty);
  const coverage = [
    { label: 'Verified in the last 6 months', n: fac.filter((f) => freshness(f.lastVerified) === 'fresh').length },
    { label: 'Contact details verified', n: fac.filter((f) => f.emailVerified).length },
    { label: 'Two or more independent sources', n: fac.filter((f) => f.sources.length >= 2).length },
    { label: 'No known coverage gaps', n: fac.filter((f) => !f.coverageNotes.length).length },
  ];
  const dismissals = Object.values(db.searches).flatMap((s) => s.candidates.filter((c) => c.status === 'dismissed' && c.dismissReason).map((c) => c.dismissReason!));
  const dismissCounts = Object.entries(dismissals.reduce<Record<string, number>>((a, r) => ({ ...a, [r]: (a[r] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  const tiles = [
    { label: 'Opportunities created', v: m.created.length, href: '/opportunities?view=table' },
    { label: 'Match decisions', v: m.decided.length, sub: m.decided.length ? `${Math.round((m.approved.length / m.decided.length) * 100)}% approved` : '—', href: '/review' },
    { label: 'Introductions recorded', v: m.intros.length, sub: 'Sent by staff, outside this system', href: '/opportunities' },
    { label: 'Meetings recorded', v: m.meetings.length, href: '/opportunities' },
    { label: 'Agreements recorded', v: m.agreements.length, href: '/opportunities' },
    { label: 'Closed without success', v: m.failed.length, href: '/opportunities' },
  ];

  return (
    <Page wide>
      <PageHeader
        title="Outcomes & Analytics"
        description="Does matchmaking actually work? Predicted match quality and real-world outcomes are kept separate on purpose."
        actions={<Segmented value={range} onChange={setRange} options={[{ value: '90', label: '90 days' }, { value: '365', label: '12 months' }, { value: 'all', label: 'All time' }]} />}
      />
      <InfoNote className="mb-5" tone={isDemo ? 'warn' : 'neutral'} icon={<Info />}>{isDemo ? <>All figures are computed from the <b>fictional demo dataset</b>. </> : <>All figures are computed from records in this workspace. </>}No dollar totals are shown unless an opportunity records a justified estimate.</InfoNote>

      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t, i) => (
          <Link key={t.label} to={t.href} className={cn('-ml-px -mt-px border-l border-t border-line px-4 py-3 transition-colors duration-fast hover:bg-subtle/60', i === 0 && '')}>
            <div className="text-[12px] font-medium text-ink-3">{t.label}</div>
            <div className="figure mt-0.5 text-[26px] leading-8">{t.v}</div>
            {t.sub && <div className="text-[12px] text-ink-3">{t.sub}</div>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartPanel title="Engagement funnel" sub={`Opportunities created in range that reached each stage (n=${m.created.length})`}>
          <HBar data={funnel.map((f) => ({ label: f.stage, n: f.n }))} />
        </ChartPanel>

        <ChartPanel title="Recorded outcomes" sub="What actually happened, as recorded by staff">
          {outcomeBars.length === 0 ? <p className="py-16 text-center text-sm text-ink-3">No outcomes recorded in this range.</p> : (
            <ul className="space-y-2.5 py-1">
              {outcomeBars.map((o) => (
                <li key={o.label} className="grid grid-cols-[170px_1fr_28px] items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-ink-2"><span className={cn('h-2 w-2 rounded-full', o.success ? 'bg-good' : o.success === false ? 'bg-bad' : 'bg-ink-4')} />{o.label}</span>
                  <Meter value={o.n} max={Math.max(...outcomeBars.map((x) => x.n))} tone="ink" height={8} />
                  <span className="text-right tabular text-ink">{o.n}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-3">● green = counted as success, ● red = not successful. Labels, not color, carry the meaning.</p>
        </ChartPanel>

        <section className="panel xl:col-span-2">
          <div className="panel-head"><span className="panel-title">Predicted match quality vs. actual outcome</span><Badge tone="outline">n = {predictions.length}</Badge></div>
          <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="rounded-md bg-canvas p-4 ring-1 ring-line/70">
                <div className="text-xs text-ink-3">Average baseline score</div>
                <div className="mt-2 flex items-baseline justify-between text-sm"><span className="text-ink-2">Successful outcomes</span><span className="text-lg font-semibold tabular">{avgOk ?? '—'}</span></div>
                <div className="flex items-baseline justify-between text-sm"><span className="text-ink-2">Unsuccessful outcomes</span><span className="text-lg font-semibold tabular">{avgBad ?? '—'}</span></div>
              </div>
              <InfoNote icon={<FlaskConical />}>With {predictions.length} recorded outcomes this says nothing statistically. The prototype has <b>not learned</b> from these records; they are collected so a future matcher can be evaluated against them.</InfoNote>
            </div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="text-left text-xs text-ink-3"><tr className="border-b border-line"><th className="py-2 font-medium">Opportunity</th><th className="py-2 font-medium">Researcher</th><th className="py-2 font-medium">Score today</th><th className="py-2 font-medium">Outcome</th><th className="py-2 font-medium">Recorded</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {predictions.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-3"><Link className="hover:text-accent" to={`/opportunities/${p.opp.id}`}>{p.opp.title}</Link></td>
                      <td className="py-2.5 pr-3 text-ink-2">{db.faculty[p.outcome.facultyId!]?.name}</td>
                      <td className="py-2.5 pr-3">{p.score !== undefined && p.band ? <span className="flex items-center gap-2"><ScoreDial score={p.score} band={p.band} size={28} stroke={3} /></span> : <Tip content="Below the relevance threshold for this need"><span className="text-ink-4">below threshold</span></Tip>}</td>
                      <td className="py-2.5 pr-3"><Badge tone={p.success ? 'good' : p.success === false ? 'bad' : 'neutral'}>{OUTCOME_LABELS[p.outcome.kind].label}</Badge></td>
                      <td className="py-2.5 text-ink-3">{fmtDate(p.outcome.recordedAt, 'MMM yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink-3">“Wrong expertise” with a high score is exactly the case worth studying — e.g. the crop-genomics match scored on the word “genomics”.</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><span className="panel-title">Median time between stages</span><span className="text-xs text-ink-3">All opportunities</span></div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {times.map((t) => (
                <tr key={t.from}>
                  <td className="px-5 py-2.5 text-ink-2">{STAGES[STAGE_INDEX[t.from]].short} → {STAGES[STAGE_INDEX[t.to]].short}</td>
                  <td className="px-3 py-2.5 w-[45%]"><Meter value={t.median ?? 0} max={Math.max(...times.map((x) => x.median ?? 0), 1)} tone="accent" height={6} /></td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right tabular text-ink">{t.median === null ? '—' : `${Math.round(t.median)} d`}<span className="ml-2 text-xs text-ink-4">n={t.n}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-head"><span className="panel-title">Faculty data coverage</span><Link to="/data" className="text-xs text-accent hover:underline">Data Health</Link></div>
          <ul className="space-y-4 p-5">
            {coverage.map((c) => (
              <li key={c.label}>
                <div className="flex justify-between text-sm"><span className="text-ink-2">{c.label}</span><span className="tabular text-ink">{c.n} / {fac.length} <span className="text-ink-4">({Math.round((c.n / fac.length) * 100)}%)</span></span></div>
                <Meter className="mt-1.5" value={c.n} max={fac.length} tone={c.n / fac.length >= 0.75 ? 'good' : c.n / fac.length >= 0.5 ? 'warn' : 'bad'} />
              </li>
            ))}
          </ul>
        </section>

        <ChartPanel title="Opportunities by industry" sub="Created in range">
          <HBar data={byIndustry} />
        </ChartPanel>
        <ChartPanel title="Researchers involved, by department" sub="Faculty linked to opportunities created in range">
          <HBar data={byDept} />
        </ChartPanel>

        <section className="panel xl:col-span-2">
          <div className="panel-head"><span className="panel-title">Match feedback captured for the algorithm</span><span className="text-xs text-ink-3">Dismissal reasons from Match Studio</span></div>
          <div className="p-5 text-sm">
            {dismissCounts.length === 0 ? <p className="text-ink-3">No dismissals recorded yet. When staff dismiss a match with a reason, it appears here as labelled training data for the next matcher.</p> : (
              <ul className="flex flex-wrap gap-2">{dismissCounts.map(([r, n]) => <li key={r}><Badge tone="outline">{r} · {n}</Badge></li>)}</ul>
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}

function ChartPanel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-head"><span className="panel-title">{title}</span>{sub && <span className="text-xs text-ink-3">{sub}</span>}</div><div className="p-5">{children}</div></section>;
}

function HBar({ data }: { data: { label: string; n: number }[] }) {
  useTheme((x) => x.resolved); // re-render with the active theme's tokens
  const AXIS = axis();
  if (!data.length) return <p className="py-10 text-center text-sm text-ink-3">No data in this range.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={token('line')} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={190} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: token('subtle') }} content={<Tip2 unit="" />} />
        <Bar dataKey="n" fill={token('viz-2')} radius={[0, 2, 2, 0]} maxBarSize={16} isAnimationActive={false} label={{ position: 'right', fill: token('ink-2'), fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Tip2({ active, payload, label, unit }: { active?: boolean; payload?: { value: number; payload: { label?: string; stage?: string } }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md bg-surface px-3 py-2 text-xs shadow-md ring-1 ring-line"><div className="font-medium text-ink">{label ?? payload[0].payload.label}</div><div className="text-ink-2 tabular">{payload[0].value} {unit}</div></div>;
}
