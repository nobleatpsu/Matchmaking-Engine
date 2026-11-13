import { useMemo } from 'react';
import { requestForOpportunity } from '@shared/matching/requests';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { conceptLabel } from '@shared/taxonomy';
import { runBaseline } from '@shared/matching/baseline';
import { TYPE_BY_ID, stageLabel } from '@shared/rules';
import { useDb } from '@/lib/store';
import { corpusOf } from '@/lib/corpus';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { BrandMark } from '@/components/layout/Brand';
import { BRAND } from '@shared/brand';
import { useStore } from '@/lib/store';

/** Printable internal brief. Uses the browser's print dialog for PDF export. */
export function BriefPage() {
  const { id } = useParams();
  const db = useDb();
  const workspace = useStore((s) => s.workspace);
  const opp = id ? db.opportunities[id] : undefined;
  const results = useMemo(() => {
    if (!opp) return [];
    const req = requestForOpportunity(db, opp);
    const res = runBaseline(req, corpusOf(db));
    const linked = res.results.filter((r) => opp.facultyIds.includes(r.facultyId));
    const others = res.results.filter((r) => !opp.facultyIds.includes(r.facultyId)).slice(0, Math.max(0, 3 - linked.length));
    return [...linked, ...others];
  }, [db, opp]);
  if (!opp) return <div className="p-10">Not found. <Link className="link" to="/opportunities">Back</Link></div>;
  const c = db.companies[opp.companyId];
  const i = opp.interestId ? db.interests[opp.interestId] : undefined;
  const unknowns = [...new Set(results.flatMap((r) => r.unknowns))].slice(0, 6);
  const reviews = Object.values(db.reviews).filter((r) => r.opportunityId === opp.id);

  return (
    <div className="min-h-screen bg-canvas py-8">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <Link to={`/opportunities/${opp.id}`}><Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>Back to opportunity</Button></Link>
        <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print / save as PDF</Button>
      </div>
      <article className="print-page mx-auto max-w-[820px] bg-surface px-14 py-12 shadow-md ring-1 ring-line rounded-lg text-[13.5px] leading-relaxed text-ink">
        <header className="flex items-start justify-between border-b border-line pb-5">
          <div>
            <div className="eyebrow">Internal opportunity brief · not for external distribution</div>
            <h1 className="mt-2 font-serif text-[28px] font-semibold leading-tight">{opp.title}</h1>
            <p className="mt-1 text-ink-3">{c?.name} · {TYPE_BY_ID[opp.type].label} · {stageLabel(opp.stage)}</p>
          </div>
          <div className="text-right text-xs text-ink-3"><BrandMark size={26} className="ml-auto" /><div className="mt-2">Prepared {fmtDate(new Date().toISOString())}</div><div>Owner: {db.users[opp.ownerId]?.name}</div></div>
        </header>

        <Section n="1" title="The company’s need">
          <p>{opp.description}</p>
          {i && <p className="mt-2"><b>Recorded interest:</b> {i.title} — {i.description}</p>}
          <p className="mt-2 text-ink-2"><b>About {c?.name}:</b> {c?.description}</p>
        </Section>

        <Section n="2" title="Recommended researchers">
          <table className="w-full text-left">
            <thead className="text-xs text-ink-3"><tr className="border-b border-line"><th className="py-1.5">Researcher</th><th className="py-1.5">Score</th><th className="py-1.5">Evidence</th><th className="py-1.5">Confidence</th></tr></thead>
            <tbody>
              {results.map((r) => {
                const f = db.faculty[r.facultyId];
                return (
                  <tr key={r.facultyId} className="border-b border-line align-top">
                    <td className="py-2 pr-3"><b>{f.name}</b><div className="text-xs text-ink-3">{f.title}, {db.departments[f.departmentId]?.name}</div>{!opp.facultyIds.includes(f.id) && <div className="text-xs text-warn">Not yet linked — additional candidate</div>}</td>
                    <td className="py-2 pr-3 tabular">{r.score}/100</td>
                    <td className="py-2 pr-3">{r.summary}</td>
                    <td className="py-2 capitalize">{r.confidence.level}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-3">Scores are from the deterministic baseline matcher and rank evidence of relevant expertise. They do not indicate availability or willingness.</p>
        </Section>

        <Section n="3" title="Supporting research">
          <ul className="list-disc pl-5 space-y-1">
            {results.flatMap((r) => r.evidence.filter((e) => e.type === 'project' || e.type === 'ip').slice(0, 2).map((e) => (
              <li key={r.facultyId + e.id}>{e.title} <span className="text-ink-3">({db.faculty[r.facultyId].name}; {e.type === 'ip' ? 'IP — confirm with OTT' : e.active ? 'active project' : 'past project'}; covers {e.concepts.map(conceptLabel).join(', ')})</span></li>
            )))}
          </ul>
        </Section>

        <Section n="4" title="Possible collaboration pathways">
          <ul className="list-disc pl-5 space-y-1">{[...new Set(results.flatMap((r) => r.pathways))].map((p) => <li key={p}>{p}</li>)}</ul>
        </Section>

        <Section n="5" title="Outstanding questions">
          <ul className="list-disc pl-5 space-y-1">{unknowns.map((u) => <li key={u}>{u}</li>)}{!c?.objectives.length && <li>Company objectives not recorded</li>}<li>Budget range and timeline (not yet confirmed)</li></ul>
        </Section>

        <Section n="6" title="Suggested internal next steps">
          <ol className="list-decimal pl-5 space-y-1">
            {reviews.some((r) => r.status === 'pending') && <li>Complete pending review{reviews.filter((r) => r.status === 'pending').length > 1 ? 's' : ''} in the platform.</li>}
            {opp.nextAction && <li>{opp.nextAction}</li>}
            {results.some((r) => r.relatedIpIds.length) && <li>Involve OTT before discussing any technology.</li>}
            <li>Confirm researcher availability through a warm path before any introduction.</li>
          </ol>
        </Section>

        <footer className="mt-8 border-t border-line pt-3 text-2xs text-ink-4">Generated by {BRAND.name}{workspace === 'demo' ? ' from fictional demo data' : ''}. Internal working document. No one has been contacted as a result of this brief.</footer>
      </article>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return <section className="mt-6 break-inside-avoid"><h2 className="mb-2 text-[15px] font-semibold"><span className="mr-2 text-ink-4">{n}</span>{title}</h2>{children}</section>;
}
