/**
 * Turning stored records into match requests, consistently everywhere
 * (review evidence, briefs, analytics, evaluation, exports).
 */
import type { Database, MatchRequest, Opportunity, CompanyInterest } from '../types';

export function requestForInterest(i: CompanyInterest): MatchRequest {
  return {
    text: `${i.title}. ${i.description}`, topics: i.topics, companyId: i.companyId, interestId: i.id,
    engagementType: i.pathway === 'talent' ? 'talent' : i.pathway === 'engagement' ? 'engagement' : 'research',
    disciplines: [], constraints: {},
  };
}

export function requestForOpportunity(db: Pick<Database, 'searches' | 'interests'>, o: Opportunity): MatchRequest {
  const search = o.matchSearchId ? db.searches[o.matchSearchId] : undefined;
  if (search) return search.request;
  const i = o.interestId ? db.interests[o.interestId] : undefined;
  return {
    text: `${o.title}. ${o.description}`, topics: i?.topics ?? [], companyId: o.companyId, interestId: o.interestId,
    engagementType: o.type === 'licensing' ? 'licensing' : o.type === 'recruiting' ? 'talent' : o.type === 'event-sponsorship' || o.type === 'center-membership' ? 'engagement' : 'research',
    disciplines: [], constraints: {},
  };
}
