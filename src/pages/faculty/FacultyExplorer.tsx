import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ArrowDownUp, Bookmark, BookmarkCheck, Columns3, FolderPlus, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { CONCEPTS, conceptLabel, extractConcepts, type Domain } from '@shared/taxonomy';
import { freshness } from '@shared/rules';
import { collegesOf } from '@/lib/colleges';
import type { Faculty, Pathway } from '@shared/types';
import { useDb, useIsDemo, useMe } from '@/lib/store';
import { canEdit } from '@shared/roles';
import { FacultyDialog } from '@/components/forms/RecordForms';
import { cn } from '@/lib/cn';
import { addToShortlist, toggleSavedFaculty, upsertShortlist } from '@/lib/actions';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Checkbox, EmptyState, Select } from '@/components/ui/primitives';
import { Dialog, Menu, MenuItem, MenuLabel, MenuSep, ask } from '@/components/ui/overlays';
import { FreshnessBadge } from '@/components/domain';
import { CompareView } from '@/components/match/Compare';
import { toast } from 'sonner';

const DOMAINS = [...new Set(CONCEPTS.map((c) => c.domain))] as Domain[];
type F = { q: string; college: string; domain: string; ip: boolean; fresh: string[]; interest: '' | Pathway; avail: string; saved: boolean; list: string };
const EMPTY: F = { q: '', college: '', domain: '', ip: false, fresh: [], interest: '', avail: '', saved: false, list: '' };
const VIEWS_KEY = 'keystone.facultyViews';
const loadViews = (): { name: string; f: F }[] => { try { return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '[]'); } catch { return []; } };

export function FacultyExplorer() {
  const db = useDb();
  const isDemo = useIsDemo();
  const me = useMe();
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState<F>({ ...EMPTY, list: params.get('list') ?? '' });
  const [sort, setSort] = useState<{ k: 'name' | 'fresh' | 'evidence'; dir: 1 | -1 }>({ k: 'name', dir: 1 });
  const [sel, setSel] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const [views, setViews] = useState(loadViews);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((x) => ({ ...x, [k]: v }));

  const stats = useMemo(() => Object.fromEntries(Object.values(db.faculty).map((x) => {
    const projects = Object.values(db.projects).filter((p) => p.facultyIds.includes(x.id));
    return [x.id, {
      active: projects.filter((p) => p.status === 'active').length, projects: projects.length,
      pubs: Object.values(db.publications).filter((p) => p.facultyIds.includes(x.id)).length,
      ip: Object.values(db.ip).filter((p) => p.facultyIds.includes(x.id)).length,
      text: `${x.name} ${x.summary} ${x.keywords.join(' ')} ${x.expertise.map(conceptLabel).join(' ')} ${db.departments[x.departmentId]?.name} ${projects.map((p) => p.title).join(' ')}`.toLowerCase(),
    }];
  })), [db]);

  const rows = useMemo(() => {
    const qConcepts = f.q ? extractConcepts(f.q) : [];
    return Object.values(db.faculty).filter((x) => {
      const d = db.departments[x.departmentId];
      const s = stats[x.id];
      if (f.q && !(s.text.includes(f.q.toLowerCase()) || qConcepts.some((c) => x.expertise.includes(c)))) return false;
      if (f.college && d?.college !== f.college) return false;
      if (f.domain && !x.expertise.some((e) => CONCEPTS.find((c) => c.id === e)?.domain === f.domain)) return false;
      if (f.ip && s.ip === 0) return false;
      if (f.fresh.length && !f.fresh.includes(freshness(x.lastVerified))) return false;
      if (f.interest && !x.interests.some((i) => i.pathway === f.interest && i.verified)) return false;
      if (f.avail && x.availability !== f.avail) return false;
      if (f.saved && !x.saved) return false;
      if (f.list && !db.shortlists[f.list]?.facultyIds.includes(x.id)) return false;
      return true;
    }).sort((a, b) => {
      const v = sort.k === 'name' ? a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0])
        : sort.k === 'fresh' ? (b.lastVerified ?? '').localeCompare(a.lastVerified ?? '')
        : (stats[b.id].projects + stats[b.id].pubs) - (stats[a.id].projects + stats[a.id].pubs);
      return v * sort.dir;
    });
  }, [db, f, sort, stats]);

  const activeFilters = Object.entries(f).filter(([k, v]) => k !== 'q' && (Array.isArray(v) ? v.length : !!v)).length;
  const saveView = async () => {
    const name = await ask({ title: 'Save this search', confirmLabel: 'Save', input: { label: 'Name', required: true, placeholder: 'e.g. Stale energy profiles' } });
    if (!name) return;
    const next = [...views.filter((v) => v.name !== name), { name, f }];
    setViews(next);
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); } catch { /* */ }
    toast.success('Search saved (in this browser)');
  };
  const addSelectedTo = async (listId: string | 'new') => {
    if (listId === 'new') {
      const name = await ask({ title: 'New collection', confirmLabel: 'Create', input: { label: 'Name', required: true } });
      if (!name) return;
      await upsertShortlist({ name, facultyIds: sel });
    } else await addToShortlist(listId, sel);
    setSel([]);
  };

  return (
    <Page wide>
      <PageHeader
        title="Faculty"
        description="Researchers, their evidence and how current it is. A missing patent or a short project list is a coverage gap, not a lack of expertise."
        actions={<>
          {canEdit(me) && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add researcher</Button>}
          <Button variant="primary" onClick={() => navigate('/match')}>Match to a company need</Button>
        </>}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="space-y-1.5">
            <div className="eyebrow">Collections</div>
            <button onClick={() => set('list', '')} className={cn('flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm', !f.list && !f.saved ? 'bg-accent-soft text-accent font-medium' : 'text-ink-2 hover:bg-subtle')}>All researchers <span className="tabular text-xs">{Object.keys(db.faculty).length}</span></button>
            <button onClick={() => setF({ ...f, saved: !f.saved, list: '' })} className={cn('flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm', f.saved ? 'bg-accent-soft text-accent font-medium' : 'text-ink-2 hover:bg-subtle')}><span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" />Saved</span><span className="tabular text-xs">{Object.values(db.faculty).filter((x) => x.saved).length}</span></button>
            {Object.values(db.shortlists).map((l) => (
              <button key={l.id} onClick={() => setF({ ...f, list: f.list === l.id ? '' : l.id, saved: false })} className={cn('flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm', f.list === l.id ? 'bg-accent-soft text-accent font-medium' : 'text-ink-2 hover:bg-subtle')}>
                <span className="truncate">{l.name}</span><span className="tabular text-xs">{l.facultyIds.length}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="eyebrow flex items-center gap-1.5"><SlidersHorizontal className="h-3 w-3" />Filters</span>{activeFilters > 0 && <button className="text-xs text-accent hover:underline" onClick={() => setF({ ...EMPTY, q: f.q })}>Clear {activeFilters}</button>}</div>
            <Select value={f.college} onChange={(v) => set('college', v)} placeholder="Any college" options={collegesOf(db).map((c) => ({ value: c, label: c.replace('College of ', '') }))} aria-label="College" />
            <Select value={f.domain} onChange={(v) => set('domain', v)} placeholder="Any research area" options={DOMAINS.map((d) => ({ value: d, label: d }))} aria-label="Research area" />
            <Select value={f.interest} onChange={(v) => set('interest', v)} placeholder="Any verified interest" options={[{ value: 'research', label: 'Verified: sponsored research' }, { value: 'talent', label: 'Verified: recruiting' }, { value: 'engagement', label: 'Verified: engagement' }]} aria-label="Collaboration interest" />
            <Select value={f.avail} onChange={(v) => set('avail', v)} placeholder="Any availability" options={[{ value: 'open', label: 'Open' }, { value: 'limited', label: 'Limited' }, { value: 'unavailable', label: 'Unavailable' }, { value: 'unknown', label: 'Unknown' }]} aria-label="Availability" />
            <Checkbox checked={f.ip} onChange={(v) => set('ip', v)} label="Has IP on file" description="Optional signal — not required for matching" />
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-3">Data freshness</div>
              <div className="space-y-1.5">
                {[['fresh', 'Current (≤6 mo)'], ['aging', 'Aging (6–12 mo)'], ['stale', 'Stale (>12 mo)'], ['unknown', 'Never verified']].map(([k, l]) => (
                  <Checkbox key={k} checked={f.fresh.includes(k)} onChange={(v) => set('fresh', v ? [...f.fresh, k] : f.fresh.filter((x) => x !== k))} label={l} />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><span className="eyebrow">Saved searches</span><button className="text-xs text-accent hover:underline" onClick={saveView}>Save current</button></div>
            {views.length === 0 && <p className="text-xs text-ink-4">None yet.</p>}
            {views.map((v) => (
              <div key={v.name} className="group flex items-center rounded-md hover:bg-subtle">
                <button className="flex-1 truncate px-2.5 py-1.5 text-left text-sm text-ink-2" onClick={() => setF(v.f)}>{v.name}</button>
                <button aria-label="Delete saved search" className="px-2 text-ink-4 opacity-0 group-hover:opacity-100 hover:text-bad" onClick={() => { const n = views.filter((x) => x.name !== v.name); setViews(n); try { localStorage.setItem(VIEWS_KEY, JSON.stringify(n)); } catch { /* */ } }}><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-4" />
              <input className="input pl-9" placeholder="Search by name, department, expertise, keyword or project…" value={f.q} onChange={(e) => set('q', e.target.value)} />
            </div>
            {sel.length > 0 && (
              <>
                <span className="text-sm text-ink-3">{sel.length} selected</span>
                <Button icon={<Columns3 className="h-4 w-4" />} disabled={sel.length < 2 || sel.length > 4} onClick={() => setCompare(true)}>Compare</Button>
                <Menu trigger={<Button icon={<FolderPlus className="h-4 w-4" />}>Add to collection</Button>}>
                  <MenuLabel>Collections</MenuLabel>
                  {Object.values(db.shortlists).map((l) => <MenuItem key={l.id} onSelect={() => addSelectedTo(l.id)}>{l.name}</MenuItem>)}
                  <MenuSep /><MenuItem onSelect={() => addSelectedTo('new')}>New collection…</MenuItem>
                </Menu>
              </>
            )}
          </div>

          <div className="panel overflow-x-auto scroll-thin">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Researchers</caption>
              <thead className="border-b border-line bg-canvas text-left text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
                <tr>
                  <th className="w-10 pl-4"><Checkbox ariaLabel="Select all researchers" checked={rows.length > 0 && sel.length === rows.length} onChange={(v) => setSel(v ? rows.map((r) => r.id) : [])} /></th>
                  <SortTh label="Researcher" k="name" sort={sort} setSort={setSort} />
                  <th className="px-3 py-2.5 font-medium">Expertise</th>
                  <SortTh label="Evidence on file" k="evidence" sort={sort} setSort={setSort} />
                  <SortTh label="Freshness" k="fresh" sort={sort} setSort={setSort} />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 && <tr><td colSpan={6}><EmptyState title="No researchers match" action={<Button onClick={() => setF(EMPTY)}>Clear filters</Button>}>Try a broader search or remove a filter.</EmptyState></td></tr>}
                {rows.map((x) => <FacultyRow key={x.id} x={x} s={stats[x.id]} checked={sel.includes(x.id)} onCheck={(v) => setSel(v ? [...sel, x.id] : sel.filter((y) => y !== x.id))} />)}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-4">{rows.length} of {Object.keys(db.faculty).length} researchers{isDemo ? ' · all records are fictional demo data' : ''}</p>
        </div>
      </div>

      <FacultyDialog open={adding} onClose={(id) => { setAdding(false); if (id) navigate(`/faculty/${id}`); }} />
      <Dialog open={compare} onOpenChange={setCompare} size="full" title="Compare researchers" description="Attributes only. Run a match in Match Studio to compare against a specific company need.">
        {sel.length >= 2 && <CompareView facultyIds={sel.slice(0, 4)} />}
      </Dialog>
    </Page>
  );
}

function SortTh({ label, k, sort, setSort }: { label: string; k: 'name' | 'fresh' | 'evidence'; sort: { k: string; dir: 1 | -1 }; setSort: (s: { k: 'name' | 'fresh' | 'evidence'; dir: 1 | -1 }) => void }) {
  const on = sort.k === k;
  return <th className="px-3 py-2.5 font-medium"><button className={cn('inline-flex items-center gap-1 hover:text-ink', on && 'text-ink')} onClick={() => setSort({ k, dir: on ? (sort.dir === 1 ? -1 : 1) : 1 })}>{label}<ArrowDownUp className={cn('h-3 w-3', on ? '' : 'opacity-40')} /></button></th>;
}

function FacultyRow({ x, s, checked, onCheck }: { x: Faculty; s: { active: number; projects: number; pubs: number; ip: number }; checked: boolean; onCheck: (v: boolean) => void }) {
  const db = useDb();
  const navigate = useNavigate();
  const d = db.departments[x.departmentId];
  return (
    <tr className={cn('row-hover cursor-pointer', checked && 'bg-accent-soft/40')} onClick={() => navigate(`/faculty/${x.id}`)}>
      <td className="pl-4" onClick={(e) => e.stopPropagation()}><Checkbox ariaLabel={`Select ${x.name}`} checked={checked} onChange={onCheck} /></td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Avatar name={x.name} size={30} />
          <div className="min-w-0">
            <Link to={`/faculty/${x.id}`} className="font-medium text-ink hover:text-accent" onClick={(e) => e.stopPropagation()}>{x.name}</Link>
            <div className="truncate text-xs text-ink-3">{x.title} · {d?.name}</div>
          </div>
        </div>
      </td>
      <td className="max-w-[300px] px-3 py-2.5"><div className="line-clamp-2 text-[12.5px] leading-snug text-ink-2" title={x.expertise.map(conceptLabel).join(', ')}>{x.expertise.map(conceptLabel).join(' · ')}</div></td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-px overflow-hidden rounded-md ring-1 ring-line" aria-label={`${s.active} active of ${s.projects} projects, ${s.pubs} publications, ${s.ip} IP records on file`}>
          {([['Proj', s.projects, s.active ? `${s.active} active` : ''], ['Pubs', s.pubs, ''], ['IP', s.ip, '']] as const).map(([l, n, sub]) => (
            <span key={l} className="flex w-[46px] flex-col items-center bg-surface py-1" title={sub || undefined}>
              {n ? <span className="figure text-[13px] leading-4">{n}</span> : <span className="text-[13px] leading-4 text-ink-4" aria-label="none on file">–</span>}
              <span className="text-[10px] uppercase tracking-[0.04em] text-ink-3">{l}</span>
            </span>
          ))}
        </div>
        {x.coverageNotes.length > 0 && <div className="mt-1 text-[11px] text-warn">Coverage gap noted</div>}
      </td>
      <td className="px-3 py-2.5"><FreshnessBadge iso={x.lastVerified} /></td>
      <td className="pr-3" onClick={(e) => e.stopPropagation()}>
        <Button size="icon-sm" variant="ghost" aria-label={x.saved ? 'Unsave' : 'Save'} onClick={() => toggleSavedFaculty(x.id)}>{x.saved ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4" />}</Button>
      </td>
    </tr>
  );
}
