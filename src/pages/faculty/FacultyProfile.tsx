import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Pencil, Plus, Bookmark, BookmarkCheck, BookOpen, ExternalLink, FileBox, FlaskConical, Mail, ShieldQuestion, Sparkles, UserCheck } from 'lucide-react';
import { conceptLabel } from '@shared/taxonomy';
import { runBaseline } from '@shared/matching/baseline';
import { OUTCOME_LABELS } from '@shared/rules';
import type { MatchResult } from '@shared/matching/types';
import { useDb, useIsDemo, useMe } from '@/lib/store';
import { canEdit } from '@shared/roles';
import { FacultyDialog, ResearchDialog } from '@/components/forms/RecordForms';
import { cn } from '@/lib/cn';
import { daysSince, fmtDate } from '@/lib/format';
import { corpusOf } from '@/lib/corpus';
import { markVerified, requestFacultyVerification, toggleSavedFaculty, addToShortlist } from '@/lib/actions';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, EmptyState, Meter, Tabs } from '@/components/ui/primitives';
import { Menu, MenuItem, MenuLabel, Tip, ask } from '@/components/ui/overlays';
import { ActivityFeed, CompanyMark, FreshnessBadge, InfoNote, PATHWAY_META, ScoreDial, SourceLine, StageBadge } from '@/components/domain';

type Tab = 'overview' | 'research' | 'ip' | 'engagement' | 'matching' | 'data';

export function FacultyProfile() {
  const { id } = useParams();
  const db = useDb();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const f = id ? db.faculty[id] : undefined;
  const me = useMe();
  const isDemo = useIsDemo();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<'project' | 'publication' | 'ip' | null>(null);

  const projects = useMemo(() => Object.values(db.projects).filter((p) => f && p.facultyIds.includes(f.id)).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || (b.start ?? '').localeCompare(a.start ?? '')), [db, f]);
  const pubs = useMemo(() => Object.values(db.publications).filter((p) => f && p.facultyIds.includes(f.id)).sort((a, b) => b.year - a.year), [db, f]);
  const ips = useMemo(() => Object.values(db.ip).filter((p) => f && p.facultyIds.includes(f.id)), [db, f]);
  const opps = useMemo(() => Object.values(db.opportunities).filter((o) => f && o.facultyIds.includes(f.id)), [db, f]);
  const rels = useMemo(() => Object.values(db.relationships).filter((r) => f && r.facultyIds.includes(f.id)), [db, f]);

  // Reverse matching: which open company interests does this researcher fit?
  const fits = useMemo(() => {
    if (!f) return [];
    const corpus = { ...corpusOf(db), faculty: [f] };
    return Object.values(db.interests).filter((i) => i.status === 'open' || i.status === 'exploring').map((i) => {
      const r = runBaseline({ text: `${i.title}. ${i.description}`, topics: i.topics, engagementType: i.pathway === 'talent' ? 'talent' : i.pathway === 'engagement' ? 'engagement' : 'research', disciplines: [], constraints: {} }, corpus).results[0];
      return r ? { interest: i, r } : null;
    }).filter((x): x is { interest: typeof db.interests[string]; r: MatchResult } => !!x && x.r.score >= 50).sort((a, b) => b.r.score - a.r.score);
  }, [db, f]);

  if (!f) return <Page><EmptyState title="Researcher not found" action={<Link to="/faculty" className="link">Back to faculty</Link>} /></Page>;
  const editable = canEdit(me);
  const d = db.departments[f.departmentId];
  const issues = Object.values(db.issues).filter((i) => i.entity === 'faculty' && i.entityId === f.id);
  const openIssues = issues.filter((i) => i.status === 'open');
  const activities = Object.values(db.activities).filter((a) => a.facultyId === f.id);
  const age = daysSince(f.lastVerified);

  const missing = [
    !f.emailVerified && 'Verified contact details',
    f.availability === 'unknown' && 'Current availability',
    !f.interests.some((i) => i.verified) && 'Confirmed collaboration interests',
    projects.length <= 1 && 'Complete project list',
    f.labSize === undefined && 'Group size',
  ].filter(Boolean) as string[];

  return (
    <Page wide>
      <PageHeader
        crumbs={[{ label: 'Faculty', to: '/faculty' }, { label: d?.college ?? '' }]}
        title={<span className="flex items-center gap-4"><Avatar name={f.name} size={52} />{f.name}</span>}
        description={`${f.title} · ${d?.name} · ${d?.college}`}
        meta={<>
          <FreshnessBadge iso={f.lastVerified} />
          {f.emailVerified ? <Badge tone="good" icon={<BadgeCheck className="h-3 w-3" />}>Contact verified</Badge> : <Badge tone="warn">Contact unverified</Badge>}
          <Badge tone={f.availability === 'open' ? 'good' : f.availability === 'unknown' ? 'neutral' : 'warn'} className="capitalize">Availability: {f.availability}</Badge>
          {f.labName && <Badge tone="outline">{f.labName}{f.labSize ? ` · ${f.labSize} people` : ''}</Badge>}
        </>}
        actions={<>
          {editable && <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Edit</Button>}
          <Button icon={f.saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />} onClick={() => toggleSavedFaculty(f.id)}>{f.saved ? 'Saved' : 'Save'}</Button>
          <Menu trigger={<Button>Add to collection</Button>}>
            <MenuLabel>Collections</MenuLabel>
            {Object.values(db.shortlists).map((l) => <MenuItem key={l.id} disabled={l.facultyIds.includes(f.id)} onSelect={() => addToShortlist(l.id, [f.id])}>{l.name}</MenuItem>)}
          </Menu>
          <Link to={`/match`}><Button variant="primary" icon={<Sparkles className="h-4 w-4" />}>Match to a need</Button></Link>
        </>}
      />

      <Tabs className="mb-6" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} tabs={[
        { value: 'overview', label: 'Overview' }, { value: 'research', label: 'Research', count: projects.length + pubs.length }, { value: 'ip', label: 'Intellectual property', count: ips.length },
        { value: 'engagement', label: 'Industry engagement', count: opps.length + rels.length }, { value: 'matching', label: 'Matching intelligence', count: fits.length }, { value: 'data', label: 'Data quality', count: openIssues.length },
      ]} />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="panel p-5">
              <div className="eyebrow mb-2">Research summary</div>
              <p className="text-md leading-relaxed text-ink-2">{f.summary}</p>
              <div className="mt-4 eyebrow mb-2">Areas of expertise</div>
              <div className="flex flex-wrap gap-1.5">{f.expertise.map((e) => <Badge key={e} tone="accent">{conceptLabel(e)}</Badge>)}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">{f.keywords.map((k) => <span key={k} className="rounded bg-subtle px-2 py-0.5 text-xs text-ink-2">{k}</span>)}</div>
            </section>
            <section className="panel">
              <div className="panel-head"><span className="panel-title">Current research</span><button className="text-xs text-accent hover:underline" onClick={() => setParams({ tab: 'research' })}>All research</button></div>
              <ul className="divide-y divide-line">{projects.filter((p) => p.status === 'active').slice(0, 3).map((p) => <ProjectRow key={p.id} p={p} />)}
                {projects.filter((p) => p.status === 'active').length === 0 && <li className="px-5 py-4 text-sm text-ink-3">No active projects on file. This may be a coverage gap.</li>}
              </ul>
            </section>
            {f.coverageNotes.length > 0 && <InfoNote tone="warn" icon={<AlertTriangle />}><b>Coverage limitation:</b> {f.coverageNotes.join(' ')} Treat counts on this page as a lower bound.</InfoNote>}
          </div>
          <aside className="space-y-5">
            <section className="panel p-5 text-sm space-y-3">
              <div className="eyebrow">Contact</div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-ink-4" /><span className={f.emailVerified ? 'text-ink' : 'text-ink-3'}>{f.email}</span>{!f.emailVerified && <Tip content="Inferred, not confirmed. Verify before using."><span className="text-xs text-warn">unverified</span></Tip>}</div>
              {f.profileUrl && <a href={f.profileUrl} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm">Directory profile<ExternalLink className="h-3 w-3" /></a>}
              <p className="text-xs text-ink-3">This system never contacts researchers. Use these details only after review approval.</p>
            </section>
            <section className="panel p-5">
              <div className="eyebrow mb-2">Collaboration interests</div>
              {f.interests.length === 0 ? <p className="text-sm text-ink-3">None recorded. Interests are only shown when stated by the researcher or confirmed by staff.</p> : (
                <ul className="space-y-2.5">{f.interests.map((i) => (
                  <li key={i.pathway} className="text-sm"><div className="flex items-center gap-2"><Badge tone={PATHWAY_META[i.pathway].tone}>{PATHWAY_META[i.pathway].label}</Badge>{i.verified ? <span className="text-xs text-good">Confirmed</span> : <span className="text-xs text-warn">Unconfirmed</span>}</div><p className="mt-1 text-ink-2">{i.note}</p></li>
                ))}</ul>
              )}
            </section>
            <section className="panel p-5">
              <div className="eyebrow mb-2">Evidence on file</div>
              <dl className="divide-y divide-line border-y border-line">
                {([['Projects', projects.length, `${projects.filter((p) => p.status === 'active').length} active`], ['Publications', pubs.length, ''], ['IP records', ips.length, '']] as const).map(([l, n, sub]) => (
                  <div key={l} className="flex items-baseline justify-between py-1.5">
                    <dt className="text-[13px] text-ink-2">{l}{sub && n ? <span className="ml-1.5 text-xs text-ink-3">{sub}</span> : null}</dt>
                    <dd>{n ? <span className="figure text-[15px]">{n}</span> : <span className="text-xs text-ink-3">None on file</span>}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-ink-3">From {f.sources.length} source{f.sources.length === 1 ? '' : 's'}. Counts reflect what is on file, not a complete record — “none on file” is a coverage gap, not a lack of expertise.</p>
            </section>
          </aside>
        </div>
      )}

      {tab === 'research' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="panel">
            <div className="panel-head"><span className="panel-title">Projects</span><span className="flex items-center gap-2 text-xs text-ink-3">{projects.filter((p) => p.status === 'active').length} active{editable && <Button size="xs" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding('project')}>Add</Button>}</span></div>
            {f.coverageNotes.length > 0 && <div className="border-b border-line px-5 py-2.5 text-xs text-warn">{f.coverageNotes[0]}</div>}
            <ul className="divide-y divide-line">{projects.map((p) => <ProjectRow key={p.id} p={p} />)}</ul>
            {projects.length === 0 && <EmptyState title="No projects on file">This doesn’t mean there are none — the sources may not list them.</EmptyState>}
          </section>
          <section className="panel">
            <div className="panel-head"><span className="panel-title">Publications</span><span className="flex items-center gap-2 text-xs text-ink-3">{isDemo && 'Demo citations'}{editable && <Button size="xs" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding('publication')}>Add</Button>}</span></div>
            <ul className="divide-y divide-line">
              {pubs.map((p) => (
                <li key={p.id} className="flex gap-3 px-5 py-3">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" />
                  <div className="min-w-0">
                    <div className="text-sm text-ink leading-snug">{p.title}</div>
                    <div className="mt-0.5 text-xs text-ink-3">{p.venue} · {p.year}{p.facultyIds.length > 1 && <> · with {p.facultyIds.filter((x) => x !== f.id).map((x) => db.faculty[x]?.name).join(', ')}</>}</div>
                    <div className="mt-1 flex flex-wrap gap-1">{p.topics.map((t) => <span key={t} className="rounded bg-subtle px-1.5 text-2xs text-ink-3">{conceptLabel(t)}</span>)}</div>
                  </div>
                </li>
              ))}
              {pubs.length === 0 && <li className="px-5 py-6 text-sm text-ink-3">No publications on file.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === 'ip' && (
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Patents, disclosures & technologies</span><span className="flex items-center gap-2 text-xs text-ink-3">Status shown only as recorded by source{editable && <Button size="xs" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding('ip')}>Add</Button>}</span></div>
          {ips.length === 0 ? (
            <EmptyState icon={<FlaskConical />} title="No IP on file">That’s common and fine. This researcher remains fully eligible for research matching — patents are one signal, not a requirement.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">{ips.map((p) => (
              <li key={p.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2"><Link to={`/ip?item=${p.id}`} className="font-medium text-ink hover:text-accent">{p.title}</Link><Badge tone={p.verified ? 'good' : 'warn'}>{p.verified ? 'Verified with OTT' : 'Unverified'}</Badge></div>
                <p className="mt-1 text-sm text-ink-2">{p.summary}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
                  <span>Status: <b className="font-medium text-ink-2">{p.status.replace('-', ' ')}</b></span>
                  <span>Licensing: <b className="font-medium text-ink-2">{p.licensing}</b></span>
                  {p.reference && <span>Ref: {p.reference}</span>}
                  {p.filed && <span>Filed {fmtDate(p.filed, 'MMM yyyy')}</span>}
                </div>
                <SourceLine source={p.source} className="mt-2" />
              </li>
            ))}</ul>
          )}
        </section>
      )}

      {tab === 'engagement' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="panel">
            <div className="panel-head"><span className="panel-title">Opportunities</span></div>
            <ul className="divide-y divide-line">
              {opps.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                  <CompanyMark name={db.companies[o.companyId]?.name ?? '?'} size={26} />
                  <div className="min-w-0 flex-1"><Link to={`/opportunities/${o.id}`} className="text-sm font-medium text-ink hover:text-accent">{o.title}</Link><div className="text-xs text-ink-3">{db.companies[o.companyId]?.name}{o.outcomes.length ? ` · ${OUTCOME_LABELS[o.outcomes[o.outcomes.length - 1].kind].label}` : ''}</div></div>
                  <StageBadge stage={o.stage} />
                </li>
              ))}
              {opps.length === 0 && <li className="px-5 py-6 text-sm text-ink-3">Not linked to any opportunity yet.</li>}
            </ul>
          </section>
          <section className="panel">
            <div className="panel-head"><span className="panel-title">Known relationships</span><span className="text-xs text-ink-3">From authorized records only</span></div>
            <ul className="divide-y divide-line">
              {rels.map((r) => (
                <li key={r.id} className="px-5 py-3"><div className="flex items-center gap-2 text-sm"><span className="font-medium text-ink">{db.companies[r.companyId]?.name}</span><Badge tone="outline" className="capitalize">{r.kind.replace('-', ' ')}</Badge><Badge tone={r.status === 'active' ? 'good' : 'neutral'}>{r.status}</Badge></div><div className="mt-0.5 text-xs text-ink-3">{r.title} · {fmtDate(r.since, 'yyyy')}{r.until ? `–${fmtDate(r.until, 'yyyy')}` : '–present'}</div></li>
              ))}
              {rels.length === 0 && <li className="px-5 py-6 text-sm text-ink-3">No recorded relationships.</li>}
            </ul>
            <div className="border-t border-line p-5"><div className="eyebrow mb-3">Recorded activity</div><ActivityFeed items={activities} limit={6} /></div>
          </section>
        </div>
      )}

      {tab === 'matching' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="panel">
            <div className="panel-head"><span className="panel-title">Open company needs this researcher fits</span><span className="text-xs text-ink-3">Baseline matcher, live</span></div>
            <ul className="divide-y divide-line">
              {fits.map(({ interest, r }) => (
                <li key={interest.id} className="flex items-center gap-3 px-5 py-3">
                  <ScoreDial score={r.score} band={r.band} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{interest.title}</div>
                    <div className="text-xs text-ink-3">{db.companies[interest.companyId]?.name} · {PATHWAY_META[interest.pathway].label} · {r.confidence.level} evidence</div>
                    <div className="mt-0.5 text-xs text-ink-2">{r.summary}</div>
                  </div>
                  <Link to={`/match?interest=${interest.id}`}><Button size="sm">Open in Match Studio</Button></Link>
                </li>
              ))}
              {fits.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-3">No open company interests currently fit above the threshold.</li>}
            </ul>
          </section>
          <aside className="space-y-5">
            <section className="panel p-5">
              <div className="eyebrow mb-2 flex items-center gap-1.5"><ShieldQuestion className="h-3.5 w-3.5" />Evidence gaps</div>
              {missing.length ? <ul className="space-y-1 text-sm text-ink-2">{missing.map((m) => <li key={m}>• {m}</li>)}</ul> : <p className="text-sm text-ink-3">No major gaps.</p>}
            </section>
            <section className="panel p-5">
              <div className="eyebrow mb-2">Suggested internal follow-up questions</div>
              <ul className="space-y-2 text-sm text-ink-2">
                {f.availability === 'unknown' && <li>Is {f.name.split(' ')[0]} taking on new industry projects this year?</li>}
                {!f.interests.some((i) => i.pathway === 'research' && i.verified) && <li>Do they prefer sponsored projects, gifts, or consortium membership?</li>}
                {projects.length <= 1 && <li>Which current projects are missing from the directory?</li>}
                {ips.length > 0 && <li>Has OTT discussed these technologies with any company already?</li>}
                <li>Who is the best warm path — department chair, center director, or a past sponsor?</li>
              </ul>
            </section>
          </aside>
        </div>
      )}

      {tab === 'data' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="panel p-5 space-y-4">
            <div className="flex items-center justify-between"><div className="panel-title">Record status</div><FreshnessBadge iso={f.lastVerified} /></div>
            <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
              <dt className="text-ink-3">Last verified</dt><dd>{f.lastVerified ? `${fmtDate(f.lastVerified)} (${age} days ago)` : 'Never'}</dd>
              <dt className="text-ink-3">Contact</dt><dd>{f.emailVerified ? 'Verified' : 'Not verified'}</dd>
              <dt className="text-ink-3">Independent sources</dt><dd>{f.sources.length}</dd>
              <dt className="text-ink-3">Missing</dt><dd>{missing.join(', ') || '—'}</dd>
            </dl>
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-3"><span>Coverage</span><span>{Math.round((5 - missing.length) / 5 * 100)}%</span></div>
              <Meter value={(5 - missing.length) / 5 * 100} tone={missing.length <= 1 ? 'good' : missing.length <= 3 ? 'warn' : 'bad'} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="primary" icon={<UserCheck className="h-4 w-4" />} onClick={async () => { const c = await ask({ title: 'Mark profile as verified?', body: 'Confirm you checked title, department and current projects against an authoritative source today.', confirmLabel: 'Mark verified', input: { label: 'Contact details also verified?', options: [{ value: 'yes', label: 'Yes — email confirmed' }, { value: 'no', label: 'No — profile only' }], required: true } }); if (c) markVerified(f.id, { email: c === 'yes' }); }}>Mark verified</Button>
              <Button onClick={async () => { const r = await ask({ title: 'Request verification', confirmLabel: 'Send to data steward', input: { label: 'What should be checked?', required: true, multiline: true } }); if (r) requestFacultyVerification(f.id, r); }}>Request verification</Button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><span className="panel-title">Sources</span></div>
            <ul className="divide-y divide-line">{f.sources.map((s, i) => <li key={i} className="px-5 py-3"><SourceLine source={s} /></li>)}</ul>
            <div className="panel-head border-t"><span className="panel-title">Data issues</span></div>
            <ul className="divide-y divide-line">
              {issues.map((i) => <li key={i.id} className={cn('px-5 py-3 text-sm', i.status !== 'open' && 'opacity-60')}><div className="flex items-center gap-2"><Badge tone={i.status === 'open' ? 'warn' : 'good'} className="capitalize">{i.kind.replace('-', ' ')}</Badge><span className="text-ink-2">{i.detail}</span></div>{i.resolution && <div className="mt-1 text-xs text-ink-3">Resolved: {i.resolution}</div>}</li>)}
              {issues.length === 0 && <li className="px-5 py-4 text-sm text-ink-3">No issues recorded.</li>}
            </ul>
          </section>
        </div>
      )}
      <FacultyDialog open={editing} faculty={f} onClose={() => setEditing(false)} />
      {adding && <ResearchDialog kind={adding} open facultyId={f.id} onClose={() => setAdding(null)} />}
    </Page>
  );
}

function ProjectRow({ p }: { p: { id: string; title: string; description: string; status: string; start?: string; end?: string; sponsor?: string; topics: string[]; source: import('@shared/types').SourceRef; facultyIds: string[] } }) {
  return (
    <li className="flex gap-3 px-5 py-3.5">
      <FileBox className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-ink">{p.title}</span>{p.status === 'active' ? <Badge tone="good">Active</Badge> : <Badge tone="neutral" className="capitalize">{p.status}</Badge>}</div>
        <p className="mt-0.5 text-sm text-ink-2">{p.description}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span>{p.start ? fmtDate(p.start, 'MMM yyyy') : 'Start unknown'} – {p.end ? fmtDate(p.end, 'MMM yyyy') : p.status === 'active' ? 'present' : 'unknown'}</span>
          {p.sponsor && <span>Funding: {p.sponsor}</span>}
          <span>{p.topics.map(conceptLabel).join(', ')}</span>
        </div>
        <SourceLine source={p.source} className="mt-1" />
      </div>
    </li>
  );
}
