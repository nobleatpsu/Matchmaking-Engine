import { useState } from 'react';
import { CircleHelp, Database, Hand, MessageSquare, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useDb } from '@/lib/store';
import { cn } from '@/lib/cn';
import { useUI } from '@/lib/ui';
import { relTime } from '@/lib/format';
import { setFeedbackStatus } from '@/lib/actions';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, Checkbox, Select, Tabs } from '@/components/ui/primitives';
import { InfoNote } from '@/components/domain';

const QUESTIONS: Record<string, string[]> = {
  'Corporate Engagement Center (CEC)': [
    'How does a company relationship usually begin today?',
    'How are introductions to faculty made and tracked?',
    'Where do opportunities get delayed or cancelled — and why?',
    'Where have people been matched incorrectly? What was missing?',
    'What do staff do manually that takes the most time?',
    'How are existing leads tracked, and who owns them?',
    'What does a good handoff to a faculty member look like?',
  ],
  'Office of Technology Transfer (OTT)': [
    'What faculty and research data does OTT maintain?',
    'Which datasets are reliable and current? How often are they updated?',
    'How does IP enter the engagement process today?',
    'What commercialization workflows and approvals already exist?',
    'Can disclosure-level information be used internally for matching?',
  ],
  'Research data & success': [
    'Why are some researchers listed with only one project?',
    'What counts as a successful match? Who decides?',
    'What historical successful-match data exists, and can it be shared?',
    'What is the best way to reach faculty when direct contact is difficult?',
  ],
  'Bursar (unresolved)': [
    'Where does the Bursar connect to sponsored research or company engagement?',
    'Is any payment, invoicing or contracting step visible to CEC staff?',
    'Who should the platform hand off to — if anyone — once an agreement exists?',
  ],
};
const KEY = 'keystone.discovery';
const loadChecked = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };

export function ProcessPage() {
  const db = useDb();
  const setFeedback = useUI((s) => s.setFeedback);
  const [tab, setTab] = useState<'workflow' | 'questions' | 'feedback' | 'team'>('workflow');
  const [checked, setChecked] = useState<string[]>(loadChecked);
  const toggle = (q: string) => { const n = checked.includes(q) ? checked.filter((x) => x !== q) : [...checked, q]; setChecked(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* */ } };
  const feedback = Object.values(db.feedback).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Page>
      <PageHeader title="Process & Open Questions" description="How the platform expects the work to flow, what is still unknown, and what stakeholders have told us. Assumptions are labelled as assumptions." />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'workflow', label: 'Human-review workflow' }, { value: 'questions', label: 'Discovery questions' }, { value: 'feedback', label: 'Stakeholder feedback', count: feedback.length }, { value: 'team', label: 'Team & integration points' }]} />

      {tab === 'workflow' && (
        <div className="space-y-5">
          <Swimlane />
          <section className="panel p-5 space-y-3 text-sm text-ink-2">
            <div className="panel-title">Guardrails enforced in the product</div>
            <ul className="space-y-1.5">
              <li>• No code path sends email or contacts anyone. The API has no outbound messaging endpoint.</li>
              <li>• “Introduction prepared” requires an approved review — enforced on the server, not just the UI.</li>
              <li>• “Introduction recorded” requires a person to record how they sent it.</li>
              <li>• Outreach-related reviews can’t be bulk-approved; approval requires a completed checklist.</li>
              <li>• Recruiting and event engagements use shorter workflows without an introduction step.</li>
              <li>• Match scores and outcomes are stored and shown separately.</li>
            </ul>
          </section>
          <InfoNote icon={<CircleHelp />}><b>Assumption:</b> CEC owns company relationships and OTT owns any IP conversation. Reviewer roles, approval thresholds and who may record outcomes are placeholders until confirmed in discovery.</InfoNote>
          <section className="panel p-5">
            <div className="panel-title">Administrative handoffs (placeholder)</div>
            <p className="mt-1 text-sm text-ink-2">The relationship between the Bursar and industry engagement is <b>not yet understood</b>. The platform deliberately models no billing, contracting or payment step. Once the process is verified, a handoff stage can be added to the relevant workflow types in <code>shared/rules.ts</code>.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              {['Sponsored research office', 'Office of Technology Transfer', 'Bursar'].map((x) => <div key={x} className="rounded-md bg-canvas px-3 py-2 ring-1 ring-line/70"><div className="font-medium text-ink">{x}</div><div className="text-xs text-ink-3">Handoff: to be defined</div></div>)}
            </div>
          </section>
        </div>
      )}

      {tab === 'questions' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Object.entries(QUESTIONS).map(([g, qs]) => (
            <section key={g} className="panel p-5">
              <div className="flex items-center justify-between"><div className="panel-title">{g}</div><span className="text-xs text-ink-3 tabular">{qs.filter((q) => checked.includes(q)).length}/{qs.length} answered</span></div>
              <div className="mt-3 space-y-2.5">{qs.map((q) => <Checkbox key={q} checked={checked.includes(q)} onChange={() => toggle(q)} label={q} />)}</div>
            </section>
          ))}
          <p className="text-xs text-ink-4 lg:col-span-2">Progress is saved in this browser. Capture answers as stakeholder feedback so the team can see them.</p>
        </div>
      )}

      {tab === 'feedback' && (
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Captured feedback</span><Button size="sm" variant="primary" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => setFeedback(true)}>Capture feedback</Button></div>
          <ul className="divide-y divide-line">
            {feedback.map((f) => (
              <li key={f.id} className="flex items-start gap-3 px-5 py-3.5">
                <Badge tone={f.kind === 'match-quality' ? 'accent' : f.kind === 'missing-data' ? 'warn' : f.kind === 'workflow' ? 'talent' : 'neutral'} className="capitalize">{f.kind.replace('-', ' ')}</Badge>
                <div className="min-w-0 flex-1"><p className="text-sm text-ink">{f.text}</p><p className="mt-0.5 text-xs text-ink-3">{f.stakeholder ?? 'Unspecified'} · {db.users[f.authorId]?.name} · {relTime(f.at)} · on <code>{f.page}</code></p></div>
                <Select className="h-8 w-[120px]" value={f.status} onChange={(v) => setFeedbackStatus(f.id, v)} options={[{ value: 'open', label: 'Open' }, { value: 'triaged', label: 'Triaged' }, { value: 'closed', label: 'Closed' }]} aria-label="Status" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'team' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="panel p-5">
            <div className="panel-title flex items-center gap-2"><Users className="h-4 w-4" />Project team</div>
            <dl className="mt-3 space-y-2 text-sm">
              {[['Noble', 'Frontend, product interface, user-facing documentation'], ['Ian', 'Matching algorithm'], ['Athrav', 'Data collection and sourcing'], ['Kim', 'Supervisor'], ['Jeff Hershey', 'Key stakeholder']].map(([n, r]) => <div key={n} className="grid grid-cols-[120px_1fr]"><dt className="font-medium text-ink">{n}</dt><dd className="text-ink-2">{r}</dd></div>)}
            </dl>
            <p className="mt-3 text-xs text-ink-3">In the demo workspace, staff names (Jordan, Marcus, Leah, Dana, Sam) are fictional personas.</p>
          </section>
          <section className="panel p-5 text-sm text-ink-2 space-y-3">
            <div className="panel-title">Integration points</div>
            <div><b className="text-ink">Matching (Ian):</b> register a provider in <code>server/matchers/index.ts</code>, or run a service in any language and set <code>MATCHERS_HTTP</code>. Check it with <code>npm run matcher:check</code>, measure it with <code>npm run eval</code>. Docs: <code>docs/matching/</code>.</div>
            <div><b className="text-ink">Data (Athrav):</b> push batches to <code>POST /api/w/live/ingest</code> with an API key, or write a <code>DataProvider</code> in <code>server/data-providers/</code>. Disagreements between sources become data-conflict issues instead of silent overwrites. Docs: <code>docs/data-ingestion.md</code>.</div>
            <div><b className="text-ink">Persistence:</b> one SQLite file per workspace in <code>data/</code> (<code>live.db</code>, <code>demo.db</code>), with an audit log and migrations. PostgreSQL path in <code>docs/deployment.md</code>.</div>
          </section>
        </div>
      )}
    </Page>
  );
}

type Basis = 'enforced' | 'assumption' | 'open';
const BASIS: Record<Basis, { label: string; cls: string }> = {
  enforced: { label: 'Enforced in the product', cls: 'border-solid border-accent/50 bg-surface' },
  assumption: { label: 'Assumption — to confirm', cls: 'border-dashed border-warn/70 bg-warn-soft/30' },
  open: { label: 'Open question', cls: 'border-dotted border-ink-4 bg-canvas' },
};
const LANES = ['Platform', 'CEC staff', 'Reviewer', 'OTT', 'Research office'] as const;
const FLOW: { n: number; lane: (typeof LANES)[number]; title: string; body: string; basis: Basis; icon: React.ReactNode }[] = [
  { n: 1, lane: 'Platform', title: 'Rank & explain', body: 'Ranks researchers and shows the evidence. Nothing leaves the system.', basis: 'enforced', icon: <Sparkles /> },
  { n: 2, lane: 'CEC staff', title: 'Shortlist', body: 'Save, dismiss with a reason, or ask for more information.', basis: 'enforced', icon: <Hand /> },
  { n: 3, lane: 'Reviewer', title: 'Review', body: 'Checks evidence, contact, intent and process. Checklist required; no bulk approval.', basis: 'enforced', icon: <ShieldCheck /> },
  { n: 4, lane: 'OTT', title: 'IP consult', body: 'OTT joins when IP is in scope. Who triggers this is not yet agreed.', basis: 'assumption', icon: <CircleHelp /> },
  { n: 5, lane: 'CEC staff', title: 'Draft & send', body: 'A draft is allowed only after approval. Staff send it themselves, outside the platform.', basis: 'enforced', icon: <MessageSquare /> },
  { n: 6, lane: 'CEC staff', title: 'Record', body: 'Staff record the introduction and what happened. Outcomes feed analytics.', basis: 'enforced', icon: <Database /> },
  { n: 7, lane: 'Research office', title: 'Agreement handoff', body: 'Sponsored-research, licensing or Bursar handoff once an agreement exists — undefined.', basis: 'open', icon: <Users /> },
];

/** Who does what, in order — and how sure we are about each step. */
function Swimlane() {
  return (
    <section className="panel overflow-hidden" aria-label="Human-review workflow by role">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-line px-4 py-2.5">
        <span className="text-[13px] font-semibold text-ink">Who does what</span>
        {(Object.keys(BASIS) as Basis[]).map((b) => <span key={b} className="flex items-center gap-1.5 text-xs text-ink-3"><span className={cn('h-3 w-5 rounded-sm border-[1.5px]', BASIS[b].cls)} />{BASIS[b].label}</span>)}
      </div>
      <div className="overflow-x-auto scroll-thin">
        <div className="grid min-w-[980px]" style={{ gridTemplateColumns: `128px repeat(${FLOW.length}, minmax(0, 1fr))` }}>
          <div className="border-b border-line bg-canvas" />
          {FLOW.map((f, i) => (
            <div key={f.n} className="relative flex items-center justify-center border-b border-line bg-canvas py-2">
              {i > 0 && <span className="absolute left-0 right-1/2 top-1/2 h-px bg-line-strong" aria-hidden />}
              {i < FLOW.length - 1 && <span className="absolute left-1/2 right-0 top-1/2 h-px bg-line-strong" aria-hidden />}
              <span className="relative z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-surface font-mono text-[10.5px] text-ink-2 ring-1 ring-line-strong">{f.n}</span>
            </div>
          ))}
          {LANES.map((lane, li) => (
            <div key={lane} className="contents">
              <div className={cn('flex items-center border-r border-line px-3 py-3 text-[12px] font-semibold text-ink-2', li > 0 && 'border-t border-line', lane === 'Platform' && 'bg-accent-soft/30')}>{lane}</div>
              {FLOW.map((f) => (
                <div key={f.n} className={cn('relative px-1.5 py-2', li > 0 && 'border-t border-line', lane === 'Platform' && 'bg-accent-soft/30')}>
                  <span className="absolute inset-y-0 left-1/2 w-px border-l border-dotted border-line-strong/70" aria-hidden />
                  {f.lane === lane && (
                    <div className={cn('relative rounded-md border-[1.5px] px-2.5 py-2', BASIS[f.basis].cls)}>
                      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-ink-3">{f.icon}{f.title}</div>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{f.body}</p>
                      <span className="sr-only">{BASIS[f.basis].label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
