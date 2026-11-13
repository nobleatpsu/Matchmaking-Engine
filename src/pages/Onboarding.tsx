import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Check, Code2, FlaskRound, Lock, ShieldCheck } from 'lucide-react';
import { BRAND } from '@shared/brand';
import { isAdmin } from '@shared/roles';
import { useDb, useMe, useStore } from '@/lib/store';
import { Page } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { t } from '@/lib/motion';
import { SOURCE_STATUS, SourceGlyph } from './DataHealthPage';

/**
 * Shown on the Command Center while the live workspace has little or no data.
 * Every status here is derived from real records — the live workspace is never padded with sample data.
 */
export function Onboarding() {
  const db = useDb();
  const me = useMe();
  const admin = isAdmin(me);
  const { meta, setWorkspace } = useStore();
  const n = (c: keyof typeof db) => Object.keys(db[c]).length;
  const steps = [
    { done: n('users') > 1, title: 'Invite your colleagues', body: 'Add CEC, OTT and research-office staff with the right role. Reviewers approve introductions; staff do the day-to-day work.', status: plural(n('users'), 'person', 'people') + ' with access', to: '/admin', cta: 'Manage users', admin: true },
    { done: n('faculty') > 0, title: 'Load researchers', body: 'Import a CSV, push records through the ingestion API, or add researchers by hand. Include emails or ORCIDs so research records can be linked.', status: plural(n('faculty'), 'researcher') + ' on file', to: '/data?tab=import', cta: 'Import researchers' },
    { done: n('projects') + n('publications') > 0, title: 'Load research evidence', body: 'Projects, publications and IP are what the matcher explains scores with. Run the OpenAlex provider for researchers with ORCIDs, or import CSVs.', status: `${plural(n('projects'), 'project')} · ${plural(n('publications'), 'publication')} · ${plural(n('ip'), 'IP record')}`, to: '/admin', cta: 'Run a data sync', admin: true },
    { done: n('companies') > 0, title: 'Load companies', body: 'Import the OSVPR industry leads list (CSV) or add companies as they come in. Record each distinct need separately.', status: plural(n('companies'), 'company', 'companies') + ' on file', to: '/data?tab=import', cta: 'Import companies' },
    { done: n('searches') > 0, title: 'Run your first match', body: 'Describe a company need in Match Studio and inspect the evidence behind every ranking.', status: plural(n('searches'), 'saved search', 'saved searches'), to: '/match', cta: 'Open Match Studio' },
    { done: (meta?.providers.length ?? 1) > 1, title: 'Connect the team’s matcher', optional: true, body: 'Register an in-process provider or point MATCHERS_HTTP at a service, then compare it with the baseline in Administration.', status: plural(meta?.providers.length ?? 1, 'matcher') + ' registered', to: '/admin', cta: 'See matchers', admin: true },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.findIndex((s) => !s.done);
  const sources = Object.values(db.sources);

  return (
    <Page>
      <header className="mb-6 border-b border-line pb-5">
        <div className="flex items-center gap-2 text-[12px] font-medium text-ink-3"><span className="h-1.5 w-1.5 rounded-full bg-good" />Live workspace · setup</div>
        <h1 className="mt-1.5 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-ink">Set up {BRAND.product}, {me.name.split(' ')[0]}.</h1>
        <p className="mt-1 max-w-[72ch] text-[14px] text-ink-3">This workspace holds real institutional records, so it starts empty. Nothing fictional is added here. The Command Center becomes your daily view once researchers and companies are on file.</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex gap-1" aria-hidden>{steps.map((s, i) => <motion.span key={i} className={cn('h-1.5 w-10 rounded-full', s.done ? 'bg-good' : i === current ? 'bg-accent' : 'bg-line')} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ ...t.slow, delay: i * 0.04 }} style={{ originX: 0 }} />)}</div>
          <span className="text-[12.5px] font-medium text-ink-2">{doneCount} of {steps.length} complete</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ol className="relative" aria-label="Setup steps">
          {steps.map((s, i) => {
            const isCurrent = i === current;
            const locked = s.admin && !admin;
            return (
              <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && <span className={cn('absolute left-[13px] top-8 bottom-0 w-px', s.done ? 'bg-good/50' : 'bg-line')} aria-hidden />}
                <span className={cn('relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-medium',
                  s.done ? 'bg-good text-white' : isCurrent ? 'bg-surface text-accent ring-2 ring-accent' : 'bg-surface text-ink-3 ring-1 ring-line-strong')}>
                  {s.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <div className={cn('min-w-0 flex-1', isCurrent && 'panel -mt-1 px-4 py-3 shadow-sm')}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h2 className={cn('text-[14.5px] font-semibold', s.done ? 'text-ink-2' : 'text-ink')}>{s.title}</h2>
                    {s.optional && <span className="text-[11.5px] text-ink-3">Optional</span>}
                    <span className={cn('meta ml-auto', s.done && '!text-good')}>{s.status}</span>
                  </div>
                  {(isCurrent || !s.done) && <p className="mt-1 max-w-[68ch] text-[13px] leading-snug text-ink-3">{s.body}</p>}
                  {!s.done && (
                    <div className="mt-2.5 flex items-center gap-2">
                      {locked
                        ? <span className="flex items-center gap-1.5 text-xs text-ink-3"><Lock className="h-3 w-3" />An administrator completes this step</span>
                        : <Link to={s.to}><Button size="sm" variant={isCurrent ? 'primary' : 'secondary'} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>{s.cta}</Button></Link>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <aside className="space-y-6">
          <section aria-labelledby="integrations">
            <div className="mb-2 flex items-baseline justify-between"><h2 id="integrations" className="text-[14px] font-semibold text-ink">Integration status</h2><Link to="/data" className="text-xs font-medium text-accent hover:underline">Data Health</Link></div>
            <ul className="panel divide-y divide-line">
              {sources.length === 0 && <li className="px-4 py-4 text-[13px] text-ink-3">No data sources are registered in this workspace yet. They appear here after the first import or sync.</li>}
              {sources.map((s) => (
                <li key={s.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className="mt-1"><SourceGlyph status={s.status} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">{s.name}</div>
                    <div className="text-xs text-ink-3">{SOURCE_STATUS[s.status].label}{s.status === 'awaiting-access' ? ' — not connected' : ''}</div>
                  </div>
                </li>
              ))}
              <li className="flex items-start gap-2.5 px-4 py-2.5">
                <span className="mt-1"><SourceGlyph status="connected" /></span>
                <div className="min-w-0 flex-1"><div className="text-[13px] font-medium text-ink">Matching</div><div className="text-xs text-ink-3">{meta?.providers.map((p) => p.name).join(', ')}</div></div>
              </li>
            </ul>
          </section>

          <div className="flex gap-2.5 border-l-2 border-accent-line pl-3 text-[13px] text-ink-2">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-good" />
            <p>The platform never contacts researchers or companies. People review each recommendation, prepare introductions, and send them themselves.</p>
          </div>
          <div className="flex gap-2.5 border-l-2 border-line-strong pl-3 text-[13px] text-ink-2">
            <Code2 className="mt-px h-4 w-4 shrink-0 text-ink-3" />
            <p>For the data and algorithm team: the ingestion API, data providers, matcher contract and deployment are documented in the repository’s <code className="mono">docs/</code> folder.</p>
          </div>
          {meta?.workspaces.includes('demo') && (
            <div className="relative overflow-hidden rounded-lg border border-demo/30 bg-demo-soft/60 py-3 pl-5 pr-4">
              <span className="demo-hatch absolute inset-y-0 left-0 w-2" aria-hidden />
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink"><FlaskRound className="h-3.5 w-3.5 text-demo" />See it with data first</div>
              <p className="mt-1 text-[12.5px] text-ink-2">The demo workspace has a complete fictional dataset for training and presentations. It is clearly marked and kept separate from live records.</p>
              <Button size="sm" className="mt-2.5" onClick={() => setWorkspace('demo')}>Open demo workspace</Button>
            </div>
          )}
        </aside>
      </div>
    </Page>
  );
}
