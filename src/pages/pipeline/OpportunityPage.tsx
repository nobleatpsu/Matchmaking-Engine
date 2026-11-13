import { useParams } from 'react-router-dom';
import { Page } from '@/components/layout/PageHeader';
import { OpportunityDetail } from '@/components/opportunity/OpportunityDetail';
import { useDb } from '@/lib/store';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export function OpportunityPage() {
  const { id } = useParams();
  const db = useDb();
  const opp = id ? db.opportunities[id] : undefined;
  return (
    <Page wide>
      <nav className="mb-3 flex items-center gap-1 text-xs text-ink-3" aria-label="Breadcrumb">
        <Link to="/opportunities" className="hover:text-ink">Pipeline</Link><ChevronRight className="h-3 w-3 text-ink-4" />
        {opp && <Link to={`/companies/${opp.companyId}`} className="hover:text-ink">{db.companies[opp.companyId]?.name}</Link>}
      </nav>
      <OpportunityDetail id={id!} />
    </Page>
  );
}
