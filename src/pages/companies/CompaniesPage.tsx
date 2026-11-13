import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import type { Company } from '@shared/types';
import { useDb, useIsDemo } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { relTime } from '@/lib/format';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, Segmented, type Tone } from '@/components/ui/primitives';
import { CompanyMark, PATHWAY_META } from '@/components/domain';

export const REL_META: Record<Company['relationship'], { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'good' }, prospect: { label: 'Prospect', tone: 'accent' }, dormant: { label: 'Dormant', tone: 'warn' }, former: { label: 'Former', tone: 'neutral' },
};

export function CompaniesPage() {
  const db = useDb();
  const isDemo = useIsDemo();
  const navigate = useNavigate();
  const setNewCompany = useUI((s) => s.setNewCompany);
  const [q, setQ] = useState('');
  const [rel, setRel] = useState<'all' | Company['relationship']>('all');
  const rows = useMemo(() => Object.values(db.companies)
    .filter((c) => (rel === 'all' || c.relationship === rel) && `${c.name} ${c.industry} ${c.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.lastTouch ?? '').localeCompare(a.lastTouch ?? '')), [db, q, rel]);

  return (
    <Page wide>
      <PageHeader
        title="Companies"
        description={`Organizations, their distinct needs, and how they already connect to the university.${isDemo ? ' All companies in this demo are fictional.' : ''}`}
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setNewCompany(true)}>Add company</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[320px]"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-4" /><input className="input pl-9" placeholder="Search companies or industries…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented value={rel} onChange={setRel} options={[{ value: 'all', label: 'All' }, ...(['active', 'prospect', 'dormant', 'former'] as const).map((r) => ({ value: r, label: REL_META[r].label }))]} />
      </div>
      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-xs text-ink-3">
            <tr><th className="px-4 py-2.5 font-medium">Company</th><th className="px-3 py-2.5 font-medium">Relationship</th><th className="px-3 py-2.5 font-medium">Needs on record</th><th className="px-3 py-2.5 font-medium">Open opportunities</th><th className="px-3 py-2.5 font-medium">Owner</th><th className="px-3 py-2.5 font-medium">Last touch</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={6}><EmptyState title="No companies found" action={<Button onClick={() => setNewCompany(true)}>Add a company</Button>} /></td></tr>}
            {rows.map((c) => {
              const interests = Object.values(db.interests).filter((i) => i.companyId === c.id && i.status !== 'fulfilled');
              const opps = Object.values(db.opportunities).filter((o) => o.companyId === c.id && o.stage !== 'closed' && o.stage !== 'outcome');
              return (
                <tr key={c.id} className="row-hover cursor-pointer" onClick={() => navigate(`/companies/${c.id}`)}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><CompanyMark name={c.name} size={32} /><div className="min-w-0"><div className="font-medium text-ink">{c.name}</div><div className="text-xs text-ink-3">{c.industry}{c.hq ? ` · ${c.hq}` : ''}</div></div></div></td>
                  <td className="px-3 py-3"><Badge tone={REL_META[c.relationship].tone} dot>{REL_META[c.relationship].label}</Badge></td>
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{(['research', 'talent', 'engagement'] as const).map((p) => { const n = interests.filter((i) => i.pathway === p).length; return n ? <Badge key={p} tone={PATHWAY_META[p].tone}>{n} {PATHWAY_META[p].label.split(' ')[0].toLowerCase()}</Badge> : null; })}{!interests.length && <span className="text-ink-4">—</span>}</div></td>
                  <td className="px-3 py-3 tabular text-ink-2">{opps.length || <span className="text-ink-4">—</span>}</td>
                  <td className="px-3 py-3 text-ink-2">{c.ownerId ? db.users[c.ownerId]?.name : <span className="text-ink-4">Unassigned</span>}</td>
                  <td className="px-3 py-3 text-ink-3">{relTime(c.lastTouch)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
