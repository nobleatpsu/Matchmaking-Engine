import { introChecklist } from '../rules';
import type {
  Activity, DataIssue, DataSource, Feedback, IntroDraft, Notification, Opportunity, OutcomeRecord, ReviewItem,
  Shortlist, Signal, Stage, Task,
} from '../types';
import { ago, ahead, src } from './util';

/* ------------------------------------------------------------------------ */
/* Opportunities                                                            */
/* ------------------------------------------------------------------------ */

type O = Omit<Opportunity, 'createdAt' | 'updatedAt' | 'stageEnteredAt' | 'stageHistory' | 'stage' | 'notes' | 'outcomes' | 'followUp' | 'signalIds'> & {
  path: [Stage, number, string?][]; // stage, daysAgo, by
  follow?: number; // days from now (negative = overdue)
  outcomes?: (Omit<OutcomeRecord, 'recordedAt'> & { d: number })[];
  notes?: [string, string, number][];
  signalIds?: string[];
};

const opp = (x: O): Opportunity => {
  const { path, follow, outcomes, notes, ...rest } = x;
  const history = path.map(([stage, d, by]) => ({ stage, at: ago(d), by: by ?? x.ownerId }));
  const last = history[history.length - 1];
  return {
    ...rest,
    stage: last.stage,
    createdAt: history[0].at,
    updatedAt: last.at,
    stageEnteredAt: last.at,
    stageHistory: history,
    followUp: follow === undefined ? undefined : ahead(follow),
    outcomes: (outcomes ?? []).map(({ d, ...o }) => ({ ...o, recordedAt: ago(d) })),
    notes: (notes ?? []).map(([authorId, text, d], i) => ({ id: `${x.id}-n${i}`, authorId, text, at: ago(d) })),
    signalIds: x.signalIds ?? [],
  };
};

export const makeOpportunities = (): Opportunity[] => [
  opp({
    id: 'o-voltaic-mfg', title: 'Lower-carbon electrode manufacturing', companyId: 'c-voltaic', interestId: 'ci-voltaic-2', type: 'sponsored-research',
    description: 'Voltaic wants to cut energy and solvent use in cell manufacturing before committing to an in-house line. Prior relationship with the Electrode Manufacturing Group (2022–23).',
    priority: 'medium', ownerId: 'u-jordan', facultyIds: ['f-lindqvist'],
    nextAction: 'Confirm whether the 2023 project created any IP obligations', follow: 2,
    path: [['new', 60], ['discovery', 41]],
    notes: [['u-jordan', 'Lindqvist has limited availability this year; may need a co-PI.', 20]],
  }),
  opp({
    id: 'o-meridian-lnp', title: 'Tissue-targeted LNP delivery collaboration', companyId: 'c-meridian', interestId: 'ci-meridian-1', type: 'sponsored-research',
    description: 'Sponsored project on spleen- and lung-targeted lipid nanoparticles for a rare-disease program.',
    priority: 'high', ownerId: 'u-jordan', facultyIds: ['f-sato'],
    nextAction: 'Reviewer to confirm Sato’s interest note is current', follow: 1,
    path: [['new', 40], ['discovery', 33], ['matching', 20], ['review', 3]],
  }),
  opp({
    id: 'o-meridian-lic', title: 'License: ionizable lipid library', companyId: 'c-meridian', interestId: 'ci-meridian-2', type: 'licensing',
    description: 'Meridian asked about a field-of-use license to the provisional lipid filing. OTT leads.',
    priority: 'high', ownerId: 'u-leah', facultyIds: ['f-sato'],
    nextAction: 'OTT to confirm licensing availability and field-of-use carve-outs', follow: 6,
    path: [['new', 25], ['discovery', 18, 'u-leah']],
  }),
  opp({
    id: 'o-corvane-edge', title: 'Sparse inference accelerator research', companyId: 'c-corvane', interestId: 'ci-corvane-1', type: 'sponsored-research',
    description: 'Two-year sponsored project on hardware–software co-design for transformer inference at the edge.',
    priority: 'high', ownerId: 'u-marcus', facultyIds: ['f-whitaker'],
    nextAction: 'Finalize and send introduction draft (manually)', follow: 0,
    path: [['new', 120, 'u-marcus'], ['discovery', 100, 'u-marcus'], ['matching', 70, 'u-marcus'], ['review', 14, 'u-marcus'], ['intro-prepared', 2, 'u-marcus']],
  }),
  opp({
    id: 'o-corvane-gan', title: 'GaN device engineer recruiting pipeline', companyId: 'c-corvane', interestId: 'ci-corvane-2', type: 'recruiting',
    description: 'Connect Corvane with MSE and EE groups training GaN and wide-bandgap device engineers.',
    priority: 'medium', ownerId: 'u-marcus', facultyIds: ['f-cho', 'f-ndlovu'],
    nextAction: 'Schedule lab tour for Corvane recruiting team', follow: -3,
    path: [['new', 90, 'u-marcus'], ['discovery', 80, 'u-marcus'], ['matching', 60, 'u-marcus'], ['review', 45, 'u-marcus'], ['discussion', 30, 'u-marcus']],
  }),
  opp({
    id: 'o-halcyon-tps', title: 'Hypersonic thermal protection materials', companyId: 'c-halcyon', interestId: 'ci-halcyon-1', type: 'sponsored-research',
    description: 'Follow-on to an active CMC oxidation test campaign; scope a two-year research agreement.',
    priority: 'high', ownerId: 'u-jordan', facultyIds: ['f-volkova'],
    nextAction: 'Log the outcome of the 10/14 call', follow: -1,
    path: [['new', 150], ['discovery', 130], ['matching', 100], ['review', 60], ['intro-prepared', 45], ['intro-recorded', 38]],
  }),
  opp({
    id: 'o-halcyon-am', title: 'Printed superalloy bracket qualification', companyId: 'c-halcyon', interestId: 'ci-halcyon-2', type: 'faculty-collaboration',
    description: 'Halcyon wants to qualify AM brackets; exploring a smaller collaboration.',
    priority: 'medium', ownerId: 'u-jordan', facultyIds: [],
    nextAction: 'Run a match for AM qualification expertise', follow: 4,
    path: [['new', 40], ['discovery', 30], ['matching', 12]],
  }),
  opp({
    id: 'o-arbor-scout', title: 'Autonomous scouting field trials', companyId: 'c-arbor', interestId: 'ci-arbor-1', type: 'sponsored-research',
    description: 'Field trials of ground and aerial scouting robots across university research farms.',
    priority: 'medium', ownerId: 'u-jordan', facultyIds: ['f-yilmaz', 'f-bennett'],
    nextAction: 'Share draft scope with sponsored research office', follow: 7,
    path: [['new', 100], ['discovery', 90], ['matching', 75], ['review', 60], ['intro-prepared', 55], ['intro-recorded', 50], ['discussion', 30]],
  }),
  opp({
    id: 'o-tess-eval', title: 'LLM evaluation co-development', companyId: 'c-tessellate', interestId: 'ci-tess-1', type: 'faculty-collaboration',
    description: 'Pilot on human evaluation protocols for enterprise LLMs.',
    priority: 'medium', ownerId: 'u-jordan', facultyIds: ['f-iyer'],
    nextAction: 'Discuss follow-on sponsored project', follow: 20,
    path: [['new', 220], ['discovery', 210], ['matching', 205], ['review', 200], ['intro-prepared', 198], ['intro-recorded', 196], ['discussion', 180], ['outcome', 40]],
    outcomes: [{ kind: 'productive-introduction', note: 'Three-month pilot completed; both sides want a larger project.', recordedBy: 'u-jordan', facultyId: 'f-iyer', d: 40 }],
  }),
  opp({
    id: 'o-tess-interns', title: 'AI research intern pipeline (summer 2027)', companyId: 'c-tessellate', interestId: 'ci-tess-2', type: 'recruiting',
    description: 'Tessellate wants 3–4 graduate interns with NLP evaluation experience.',
    priority: 'low', ownerId: 'u-jordan', facultyIds: [],
    nextAction: 'Ask which degree levels and visa constraints apply', follow: 10,
    path: [['new', 6]],
  }),
  opp({
    id: 'o-keyline-freight', title: 'Freight network resilience study', companyId: 'c-keyline', interestId: 'ci-keyline-1', type: 'sponsored-research',
    description: 'Proposed resilience modeling study.',
    priority: 'low', ownerId: 'u-marcus', facultyIds: ['f-hollis'],
    path: [['new', 400, 'u-marcus'], ['discovery', 380, 'u-marcus'], ['matching', 360, 'u-marcus'], ['review', 350, 'u-marcus'], ['intro-prepared', 345, 'u-marcus'], ['intro-recorded', 340, 'u-marcus'], ['discussion', 300, 'u-marcus'], ['closed', 160, 'u-marcus']],
    outcomes: [{ kind: 'budget-mismatch', note: 'Company budget was about a third of a realistic two-year scope.', recordedBy: 'u-marcus', facultyId: 'f-hollis', d: 160 }],
    closeReason: 'Budget mismatch — revisit if Keyline’s FY27 innovation budget is approved.',
  }),
  opp({
    id: 'o-fair-pack', title: 'Compostable produce packaging', companyId: 'c-fairmount', interestId: 'ci-fair-1', type: 'sponsored-research',
    description: 'Sponsored project on bio-based barrier films.',
    priority: 'medium', ownerId: 'u-jordan', facultyIds: ['f-dubois'],
    estimatedValue: { amount: 180000, basis: 'Budget in the signed agreement (illustrative demo figure)' },
    path: [['new', 520], ['discovery', 500], ['matching', 480], ['review', 470], ['intro-prepared', 468], ['intro-recorded', 465], ['discussion', 420], ['outcome', 240]],
    outcomes: [{ kind: 'agreement-signed', note: 'Two-year sponsored research agreement executed.', recordedBy: 'u-jordan', facultyId: 'f-dubois', d: 240 }],
  }),
  opp({
    id: 'o-sentinel-wear', title: 'Wearable sensor validation study', companyId: 'c-sentinel', interestId: 'ci-sent-1', type: 'faculty-collaboration',
    description: 'Clinical validation of Sentinel’s patch sensor against lab-grade references.',
    priority: 'medium', ownerId: 'u-marcus', facultyIds: ['f-nwosu'],
    nextAction: 'Verify Nwosu contact details and availability', follow: -6,
    path: [['new', 80, 'u-marcus'], ['discovery', 60, 'u-marcus'], ['matching', 35, 'u-marcus'], ['review', 22, 'u-marcus']],
  }),
  opp({
    id: 'o-ridge-lic', title: 'Recyclable polyester license & sponsored catalysis work', companyId: 'c-ridgeway', interestId: 'ci-ridge-1', type: 'licensing',
    description: 'Ridgeway holds a six-month evaluation option and wants to discuss a license plus sponsored catalyst work.',
    priority: 'high', ownerId: 'u-leah', facultyIds: ['f-haddad'],
    nextAction: 'OTT term-sheet discussion', follow: 5,
    path: [['new', 150, 'u-leah'], ['discovery', 140, 'u-leah'], ['matching', 130, 'u-leah'], ['review', 128, 'u-leah'], ['intro-prepared', 125, 'u-leah'], ['intro-recorded', 122, 'u-leah'], ['discussion', 100, 'u-leah']],
  }),
  opp({
    id: 'o-atlas-seminar', title: 'Building-energy seminar series sponsorship', companyId: 'c-atlas', interestId: 'ci-atlas-1', type: 'event-sponsorship',
    description: 'Atlas wants visibility with architectural engineering students through a seminar series.',
    priority: 'low', ownerId: 'u-jordan', facultyIds: ['f-delgado'],
    nextAction: 'Ask the department about sponsorship guidelines', follow: 12,
    path: [['new', 50], ['discovery', 19]],
  }),
  opp({
    id: 'o-clear-pfas', title: 'PFAS treatment pilot', companyId: 'c-clearwater', interestId: 'ci-clear-1', type: 'sponsored-research',
    description: 'Pilot-scale test of a destructive PFAS technology at one treatment plant.',
    priority: 'high', ownerId: 'u-marcus', facultyIds: ['f-castillo'],
    nextAction: 'Address reviewer’s questions on pilot scope', follow: 1,
    path: [['new', 40, 'u-marcus'], ['discovery', 30, 'u-marcus'], ['matching', 8, 'u-marcus']],
  }),
  opp({
    id: 'o-summit-thermal', title: 'Battery pack thermal safety', companyId: 'c-summit', interestId: 'ci-summit-1', type: 'sponsored-research',
    description: 'Summit Motors is looking for early-warning approaches to thermal runaway in large packs.',
    priority: 'medium', ownerId: 'u-jordan', facultyIds: [],
    nextAction: 'Discovery call with Summit’s pack engineering lead', follow: 3,
    path: [['new', 3]],
  }),
  opp({
    id: 'o-carbon-sorb', title: 'Independent sorbent testing program', companyId: 'c-carbonloop', interestId: 'ci-carbon-1', type: 'sponsored-research',
    description: 'Expand fee-for-service testing into a sponsored research program.',
    priority: 'medium', ownerId: 'u-marcus', facultyIds: ['f-ferreira'],
    nextAction: 'Draft scope for phase 2', follow: 9,
    path: [['new', 150, 'u-marcus'], ['discovery', 140, 'u-marcus'], ['matching', 138, 'u-marcus'], ['review', 136, 'u-marcus'], ['intro-prepared', 135, 'u-marcus'], ['intro-recorded', 134, 'u-marcus'], ['discussion', 60, 'u-marcus']],
  }),
  opp({
    id: 'o-northwind-climate', title: 'Climate risk analytics for grid assets', companyId: 'c-northwind', interestId: 'ci-northwind-1', type: 'faculty-collaboration',
    description: 'Northwind wants probabilistic storm and heat risk for transmission assets.',
    priority: 'medium', ownerId: 'u-marcus', facultyIds: ['f-larsen'],
    nextAction: 'Reviewer to assess low-confidence match', follow: -2,
    path: [['new', 70, 'u-marcus'], ['discovery', 50, 'u-marcus'], ['matching', 25, 'u-marcus'], ['review', 10, 'u-marcus']],
  }),
  opp({
    id: 'o-northwind-storage', title: 'Grid storage siting study', companyId: 'c-northwind', interestId: 'ci-northwind-2', type: 'sponsored-research',
    description: 'Where to place batteries for maximum reliability value.',
    priority: 'medium', ownerId: 'u-marcus', facultyIds: [],
    nextAction: 'Run a match; Reyes profile is stale', follow: 5,
    path: [['new', 20, 'u-marcus']],
  }),
  opp({
    id: 'o-lumen-consortium', title: 'Photonics consortium membership', companyId: 'c-lumen', interestId: 'ci-lumen-1', type: 'center-membership',
    description: 'Lumenfold is considering joining the photonics industry consortium.',
    priority: 'low', ownerId: 'u-marcus', facultyIds: ['f-moreau'],
    nextAction: 'Send membership tier information (manually)', follow: 8,
    path: [['new', 60, 'u-marcus'], ['discovery', 50, 'u-marcus'], ['matching', 45, 'u-marcus'], ['review', 40, 'u-marcus'], ['discussion', 26, 'u-marcus']],
  }),
  opp({
    id: 'o-corvane-fair', title: 'Spring career fair & tech talk series', companyId: 'c-corvane', interestId: 'ci-corvane-3', type: 'event-sponsorship',
    description: 'Corvane sponsored the spring engineering career fair and two tech talks.',
    priority: 'low', ownerId: 'u-marcus', facultyIds: [],
    path: [['new', 260, 'u-marcus'], ['discovery', 250, 'u-marcus'], ['review', 240, 'u-marcus'], ['discussion', 230, 'u-marcus'], ['outcome', 180, 'u-marcus']],
    outcomes: [{ kind: 'agreement-signed', note: 'Sponsorship agreement executed; event held in April.', recordedBy: 'u-marcus', d: 180 }],
  }),
  opp({
    id: 'o-sentinel-analytics', title: 'Clinical analytics methods collaboration', companyId: 'c-sentinel', type: 'faculty-collaboration',
    description: 'Methods for analyzing remote monitoring data.',
    priority: 'low', ownerId: 'u-marcus', facultyIds: ['f-greenberg'],
    path: [['new', 300, 'u-marcus'], ['discovery', 280, 'u-marcus'], ['matching', 270, 'u-marcus'], ['review', 260, 'u-marcus'], ['intro-prepared', 258, 'u-marcus'], ['intro-recorded', 255, 'u-marcus'], ['closed', 200, 'u-marcus']],
    outcomes: [{ kind: 'faculty-unavailable', note: 'Faculty member began sabbatical; profile did not record it at the time.', recordedBy: 'u-marcus', facultyId: 'f-greenberg', d: 200 }],
    closeReason: 'Faculty unavailable (sabbatical).',
  }),
  opp({
    id: 'o-arbor-genomics', title: 'Crop disease genomics', companyId: 'c-arbor', interestId: 'ci-arbor-2', type: 'sponsored-research',
    description: 'Genetic markers for disease resistance.',
    priority: 'low', ownerId: 'u-jordan', facultyIds: ['f-mccarthy'],
    path: [['new', 280], ['discovery', 270], ['matching', 265], ['review', 262], ['intro-prepared', 260], ['intro-recorded', 258], ['closed', 220]],
    outcomes: [{ kind: 'wrong-expertise', note: 'Arbor needed plant pathology, not heat-tolerance breeding. Matched on “genomics” alone.', recordedBy: 'u-jordan', facultyId: 'f-mccarthy', d: 220 }],
    closeReason: 'Wrong expertise — need a plant pathologist.',
  }),
  opp({
    id: 'o-summit-recruit', title: 'Battery engineer recruiting', companyId: 'c-summit', interestId: 'ci-summit-2', type: 'recruiting',
    description: 'Summit wants MS/PhD battery engineers for its new pack team.',
    priority: 'medium', ownerId: 'u-jordan', facultyIds: ['f-chandra', 'f-lindqvist'],
    nextAction: 'Identify graduating students via department contacts', follow: 14,
    path: [['new', 10], ['discovery', 4]],
  }),
];

/* ------------------------------------------------------------------------ */
/* Reviews                                                                  */
/* ------------------------------------------------------------------------ */

type RV = Omit<ReviewItem, 'createdAt' | 'history' | 'checklist' | 'decidedAt'> & {
  created: number; checked?: string[]; checklist?: ReviewItem['checklist'];
  events?: [ReviewItem['history'][number]['action'], string, number, string?][];
};

const rv = (x: RV): ReviewItem => {
  const { created, checked, events, checklist, ...rest } = x;
  const cl = (checklist ?? introChecklist()).map((c) => ({ ...c, checked: c.checked || !!checked?.includes(c.key) || x.status === 'approved' }));
  const history: ReviewItem['history'] = [{ at: ago(created), by: x.createdBy, action: 'created' }];
  for (const [action, by, d, note] of events ?? []) history.push({ action, by, at: ago(d), note });
  const decided = history.filter((h) => ['approved', 'rejected', 'changes-requested'].includes(h.action)).pop();
  return { ...rest, checklist: cl, history, createdAt: ago(created), decidedAt: decided?.at };
};

const dataChecklist = (...labels: string[]) => labels.map((label, i) => ({ key: `c${i}`, label, checked: false }));

export const makeReviews = (): ReviewItem[] => [
  rv({
    id: 'r-meridian-sato', kind: 'match', status: 'pending', priority: 'high', title: 'Emi Sato for Meridian LNP collaboration',
    summary: 'Strong match (88) on drug delivery and nanomaterials, with an active NIH project and a recent provisional filing.', scoreAtRequest: 88,
    reason: 'Every proposed introduction needs a human check of evidence, contact details and process.',
    createdBy: 'u-jordan', assigneeId: 'u-marcus', facultyId: 'f-sato', companyId: 'c-meridian', opportunityId: 'o-meridian-lnp',
    missing: ['Whether Meridian’s licensing discussion (OTT) affects how the research introduction is framed'],
    created: 3, checked: ['why', 'current', 'contact'],
    events: [['commented', 'u-jordan', 2, 'Sato’s interest note was confirmed in spring. Flagging the parallel OTT licensing thread.']],
  }),
  rv({
    id: 'r-corvane-whit', kind: 'introduction', status: 'approved', priority: 'high', title: 'Samuel Whitaker for Corvane accelerator research',
    summary: 'Strong match (91). Prior gift-funded benchmark study with Corvane ended well.', scoreAtRequest: 91,
    reason: 'Proposed introduction.', createdBy: 'u-marcus', facultyId: 'f-whitaker', companyId: 'c-corvane', opportunityId: 'o-corvane-edge',
    missing: [], created: 14,
    events: [['approved', 'u-leah', 3, 'Note: optioned accelerator IP (DEMO-2024-0280) — keep IP out of the first conversation.']],
  }),
  rv({
    id: 'r-halcyon-volk', kind: 'introduction', status: 'approved', priority: 'high', title: 'Irina Volkova for Halcyon TPS program',
    summary: 'Strong match on thermal protection; existing active relationship.', reason: 'Proposed introduction.',
    createdBy: 'u-jordan', facultyId: 'f-volkova', companyId: 'c-halcyon', opportunityId: 'o-halcyon-tps',
    missing: [], created: 60, events: [['approved', 'u-marcus', 46, 'Evidence current. Proceed.']],
  }),
  rv({
    id: 'r-ridge-haddad', kind: 'introduction', status: 'approved', priority: 'high', title: 'Omar Haddad for Ridgeway license discussion',
    summary: 'Licensing-led introduction coordinated by OTT.', reason: 'Proposed introduction involving IP.',
    createdBy: 'u-leah', facultyId: 'f-haddad', companyId: 'c-ridgeway', opportunityId: 'o-ridge-lic',
    missing: [], created: 128, events: [['approved', 'u-marcus', 126]],
  }),
  rv({
    id: 'r-arbor-yil', kind: 'introduction', status: 'approved', priority: 'medium', title: 'Deniz Yilmaz & Owen Bennett for Arbor field trials',
    summary: 'Two complementary researchers: ground robots and drone planning.', reason: 'Proposed introduction.',
    createdBy: 'u-jordan', facultyId: 'f-yilmaz', companyId: 'c-arbor', opportunityId: 'o-arbor-scout',
    missing: [], created: 60, events: [['approved', 'u-marcus', 56]],
  }),
  rv({
    id: 'r-carbon-fer', kind: 'introduction', status: 'approved', priority: 'medium', title: 'Ana Ferreira for CarbonLoop testing',
    summary: 'Existing fee-for-service relationship.', reason: 'Proposed introduction.',
    createdBy: 'u-marcus', facultyId: 'f-ferreira', companyId: 'c-carbonloop', opportunityId: 'o-carbon-sorb',
    missing: [], created: 136, events: [['approved', 'u-jordan', 135]],
  }),
  rv({
    id: 'r-clear-castillo', kind: 'match', status: 'changes-requested', priority: 'high', title: 'Diego Castillo for Clearwater PFAS pilot',
    summary: 'Strong match (89) with an active EPA project and an available patent-pending reactor.', scoreAtRequest: 89,
    reason: 'Proposed introduction involving available IP.', createdBy: 'u-marcus', assigneeId: 'u-leah', facultyId: 'f-castillo', companyId: 'c-clearwater', opportunityId: 'o-clear-pfas',
    missing: ['Pilot scope (lab vs. plant scale)', 'Whether Clearwater can host equipment'],
    created: 8, checked: ['why', 'current', 'contact'],
    events: [['changes-requested', 'u-leah', 4, 'Before an intro: confirm whether Clearwater wants research or a license-and-deploy path. OTT should be on the first call if the reactor is in scope.']],
  }),
  rv({
    id: 'r-northwind-larsen', kind: 'low-confidence', status: 'pending', priority: 'medium', title: 'Erik Larsen for Northwind climate risk',
    summary: 'Good topical match (72) but low evidence confidence: profile verified over a year ago, single source, most relevant project completed.', scoreAtRequest: 72,
    reason: 'Low-confidence matches need a person to confirm the researcher is still active in this area.',
    createdBy: 'u-marcus', assigneeId: 'u-dana', facultyId: 'f-larsen', companyId: 'c-northwind', opportunityId: 'o-northwind-climate',
    missing: ['Current research activity in grid climate risk', 'Contact preference'], created: 10,
  }),
  rv({
    id: 'r-sentinel-nwosu', kind: 'incomplete-opportunity', status: 'pending', priority: 'medium', title: 'Sentinel wearable study — missing information',
    summary: 'Opportunity is in review but the matched researcher’s contact and availability are unverified.',
    reason: 'Opportunities should not move to an introduction with unverified contact details.',
    createdBy: 'u-marcus', assigneeId: 'u-jordan', facultyId: 'f-nwosu', companyId: 'c-sentinel', opportunityId: 'o-sentinel-wear',
    missing: ['Verified email', 'Availability', 'Additional projects beyond the one listed'],
    checklist: dataChecklist('Contact details verified with department', 'Availability confirmed', 'Opportunity description complete'),
    created: 22,
  }),
  rv({
    id: 'r-reyes-verify', kind: 'faculty-verification', status: 'pending', priority: 'medium', title: 'Verify Marisol Reyes profile',
    summary: 'Profile last verified over 13 months ago; directory lists one project but four recent publications.',
    reason: 'Reyes is a likely match for two open storage opportunities; stale records should be confirmed first.',
    createdBy: 'u-dana', assigneeId: 'u-dana', facultyId: 'f-reyes', missing: ['Current projects', 'Verified contact'],
    checklist: dataChecklist('Title and department confirmed', 'Current projects listed', 'Contact verified'),
    created: 5,
  }),
  rv({
    id: 'r-novak-conflict', kind: 'data-conflict', status: 'pending', priority: 'low', title: 'Conflicting title for Petra Novak',
    summary: 'Department page says Associate Professor; publication index lists Professor.',
    reason: 'Two sources disagree.', createdBy: 'u-dana', facultyId: 'f-novak', dataIssueId: 'di-novak-title',
    missing: [], checklist: dataChecklist('Checked an authoritative source', 'Correct value recorded'), created: 12,
  }),
  rv({
    id: 'r-tess-company', kind: 'company-info', status: 'pending', priority: 'low', title: 'Confirm Tessellate AI details',
    summary: 'Company website domain changed; headcount and HQ may be out of date.',
    reason: 'Company records feed matching context and introductions.', createdBy: 'u-jordan', companyId: 'c-tessellate',
    missing: ['Current HQ', 'Primary contact'], checklist: dataChecklist('Website confirmed', 'HQ confirmed'), created: 7,
  }),
  rv({
    id: 'r-arbor-mcc', kind: 'match', status: 'rejected', priority: 'low', title: 'Sean McCarthy for Arbor disease genomics (second attempt)',
    summary: 'Matched on genomics; Arbor needs plant pathology.', reason: 'Proposed introduction.',
    createdBy: 'u-jordan', facultyId: 'f-mccarthy', companyId: 'c-arbor', opportunityId: 'o-arbor-genomics',
    missing: [], created: 230, events: [['rejected', 'u-marcus', 228, 'Wrong expertise — same issue as the first introduction. We need a pathologist.']],
  }),
];

/* ------------------------------------------------------------------------ */
/* Drafts                                                                   */
/* ------------------------------------------------------------------------ */

export const makeDrafts = (): IntroDraft[] => [
  {
    id: 'dr-corvane', opportunityId: 'o-corvane-edge', facultyId: 'f-whitaker', reviewId: 'r-corvane-whit',
    subject: 'Introduction: Corvane Semiconductor × Prof. Samuel Whitaker — sparse inference accelerators',
    body: `Dear Professor Whitaker,

I'm writing from the Corporate Engagement Center to introduce Corvane Semiconductor, who are interested in a two-year sponsored project on hardware–software co-design for transformer inference at the edge.

Why we thought of you: your active work on sparse neural network accelerators and your earlier benchmark study with Corvane.

What we don't know yet: Corvane's budget range and timeline, and whether you have capacity this academic year.

Would you be open to a 30-minute exploratory call? There is no commitment.

Best regards,
Marcus Hale`,
    status: 'draft', createdAt: ago(2), createdBy: 'u-marcus', updatedAt: ago(1),
  },
  {
    id: 'dr-halcyon', opportunityId: 'o-halcyon-tps', facultyId: 'f-volkova', reviewId: 'r-halcyon-volk',
    subject: 'Introduction: Halcyon Aerospace × Prof. Irina Volkova',
    body: 'Dear Professor Volkova, … (recorded draft)', status: 'recorded-sent', createdAt: ago(45), createdBy: 'u-jordan', updatedAt: ago(38),
    recordedAt: ago(38), recordedBy: 'u-jordan', recordedChannel: 'Email from Jordan’s university account',
  },
  {
    id: 'dr-ridge', opportunityId: 'o-ridge-lic', facultyId: 'f-haddad', reviewId: 'r-ridge-haddad',
    subject: 'Introduction: Ridgeway Materials × Prof. Omar Haddad (with OTT)',
    body: 'Dear Professor Haddad, … (recorded draft)', status: 'recorded-sent', createdAt: ago(125), createdBy: 'u-leah', updatedAt: ago(122),
    recordedAt: ago(122), recordedBy: 'u-leah', recordedChannel: 'Joint email from OTT',
  },
  {
    id: 'dr-arbor', opportunityId: 'o-arbor-scout', facultyId: 'f-yilmaz', reviewId: 'r-arbor-yil',
    subject: 'Introduction: Arbor Fields AgTech × Profs. Yilmaz and Bennett',
    body: '(recorded draft)', status: 'recorded-sent', createdAt: ago(55), createdBy: 'u-jordan', updatedAt: ago(50),
    recordedAt: ago(50), recordedBy: 'u-jordan', recordedChannel: 'Introduced in person at Ag Progress Days',
  },
  {
    id: 'dr-carbon', opportunityId: 'o-carbon-sorb', facultyId: 'f-ferreira', reviewId: 'r-carbon-fer',
    subject: 'Introduction: CarbonLoop × Prof. Ana Ferreira', body: '(recorded draft)', status: 'recorded-sent',
    createdAt: ago(135), createdBy: 'u-marcus', updatedAt: ago(134), recordedAt: ago(134), recordedBy: 'u-marcus', recordedChannel: 'Email',
  },
];

/* ------------------------------------------------------------------------ */
/* Activity, tasks                                                          */
/* ------------------------------------------------------------------------ */

type A = [kind: Activity['kind'], text: string, d: number, actor: string, refs?: Partial<Pick<Activity, 'companyId' | 'opportunityId' | 'facultyId' | 'reviewId'>>, h?: number];
let aid = 0;
const act = ([kind, text, d, actorId, refs, h]: A): Activity => ({ id: `a-seed-${++aid}`, kind, text, at: ago(d, h ?? 0), actorId, ...refs });

export const makeActivities = (): Activity[] => {
  aid = 0;
  return ([
    ['note', 'New CTO asked whether the university still works on solid electrolytes', 9, 'u-jordan', { companyId: 'c-voltaic' }],
    ['call', 'Call with Voltaic CTO: interested in solid-state cells for 8-hour storage', 9, 'u-jordan', { companyId: 'c-voltaic' }, 2],
    ['review', 'Requested review: Emi Sato for Meridian LNP collaboration', 3, 'u-jordan', { companyId: 'c-meridian', opportunityId: 'o-meridian-lnp', reviewId: 'r-meridian-sato', facultyId: 'f-sato' }],
    ['stage-change', 'Moved to Internal review', 3, 'u-jordan', { companyId: 'c-meridian', opportunityId: 'o-meridian-lnp' }],
    ['review', 'Approved introduction: Samuel Whitaker for Corvane', 3, 'u-leah', { companyId: 'c-corvane', opportunityId: 'o-corvane-edge', reviewId: 'r-corvane-whit', facultyId: 'f-whitaker' }],
    ['intro-draft', 'Drafted introduction to Samuel Whitaker (not sent)', 2, 'u-marcus', { companyId: 'c-corvane', opportunityId: 'o-corvane-edge', facultyId: 'f-whitaker' }],
    ['stage-change', 'Moved to Introduction prepared', 2, 'u-marcus', { companyId: 'c-corvane', opportunityId: 'o-corvane-edge' }],
    ['review', 'Requested changes: clarify research vs. license path', 4, 'u-leah', { companyId: 'c-clearwater', opportunityId: 'o-clear-pfas', reviewId: 'r-clear-castillo' }],
    ['meeting', 'Discovery meeting with Clearwater operations team', 30, 'u-marcus', { companyId: 'c-clearwater', opportunityId: 'o-clear-pfas' }],
    ['intro-recorded', 'Recorded: introduction sent to Irina Volkova by email (outside Keystone)', 38, 'u-jordan', { companyId: 'c-halcyon', opportunityId: 'o-halcyon-tps', facultyId: 'f-volkova' }],
    ['call', 'Halcyon × Volkova call held — outcome not yet logged', 5, 'u-jordan', { companyId: 'c-halcyon', opportunityId: 'o-halcyon-tps' }],
    ['meeting', 'Lab visit: Corvane recruiters met Hana Cho’s group', 30, 'u-marcus', { companyId: 'c-corvane', opportunityId: 'o-corvane-gan', facultyId: 'f-cho' }],
    ['outcome', 'Outcome recorded: productive introduction — pilot completed', 40, 'u-jordan', { companyId: 'c-tessellate', opportunityId: 'o-tess-eval', facultyId: 'f-iyer' }],
    ['created', 'Created opportunity: AI research intern pipeline', 6, 'u-jordan', { companyId: 'c-tessellate', opportunityId: 'o-tess-interns' }],
    ['created', 'Created opportunity: Battery pack thermal safety', 3, 'u-jordan', { companyId: 'c-summit', opportunityId: 'o-summit-thermal' }],
    ['note', 'Summit asked about thermal runaway detection after a recall at a competitor', 3, 'u-jordan', { companyId: 'c-summit' }, 3],
    ['signal', 'Signal converted: Ridgeway announces recycled-content resin line', 100, 'u-leah', { companyId: 'c-ridgeway', opportunityId: 'o-ridge-lic' }],
    ['outcome', 'Outcome recorded: agreement signed', 240, 'u-jordan', { companyId: 'c-fairmount', opportunityId: 'o-fair-pack', facultyId: 'f-dubois' }],
    ['outcome', 'Outcome recorded: budget mismatch — closed', 160, 'u-marcus', { companyId: 'c-keyline', opportunityId: 'o-keyline-freight', facultyId: 'f-hollis' }],
    ['outcome', 'Outcome recorded: wrong expertise — closed', 220, 'u-jordan', { companyId: 'c-arbor', opportunityId: 'o-arbor-genomics', facultyId: 'f-mccarthy' }],
    ['outcome', 'Outcome recorded: faculty unavailable — closed', 200, 'u-marcus', { companyId: 'c-sentinel', opportunityId: 'o-sentinel-analytics', facultyId: 'f-greenberg' }],
    ['stage-change', 'Moved to Discussion underway', 30, 'u-jordan', { companyId: 'c-arbor', opportunityId: 'o-arbor-scout' }],
    ['data', 'Flagged stale profile: Marisol Reyes (verified 13+ months ago)', 5, 'u-dana', { facultyId: 'f-reyes' }],
    ['data', 'Resolved duplicate company record: “Corvane Semi” merged into Corvane Semiconductor', 18, 'u-dana', { companyId: 'c-corvane' }],
    ['email-logged', 'Logged email from Meridian legal about field-of-use exclusivity', 12, 'u-leah', { companyId: 'c-meridian', opportunityId: 'o-meridian-lic' }],
    ['stage-change', 'Moved to Matching', 8, 'u-marcus', { companyId: 'c-clearwater', opportunityId: 'o-clear-pfas' }],
    ['stage-change', 'Moved to Internal review', 10, 'u-marcus', { companyId: 'c-northwind', opportunityId: 'o-northwind-climate' }],
    ['meeting', 'Northwind resilience team quarterly check-in', 21, 'u-marcus', { companyId: 'c-northwind' }],
    ['note', 'Atlas asked for student design-studio sponsorship options', 19, 'u-jordan', { companyId: 'c-atlas', opportunityId: 'o-atlas-seminar' }],
    ['created', 'Created opportunity: Battery engineer recruiting', 10, 'u-jordan', { companyId: 'c-summit', opportunityId: 'o-summit-recruit' }],
    ['call', 'Call with CarbonLoop about phase 2 testing', 13, 'u-marcus', { companyId: 'c-carbonloop', opportunityId: 'o-carbon-sorb' }],
    ['meeting', 'Ridgeway term-sheet prep with OTT', 8, 'u-leah', { companyId: 'c-ridgeway', opportunityId: 'o-ridge-lic' }],
  ] as A[]).map(act);
};

type TK = [id: string, title: string, due: number, owner: string, refs: Partial<Pick<Task, 'companyId' | 'opportunityId'>>, done?: boolean];
export const makeTasks = (): Task[] => ([
  ['t-1', 'Confirm IP obligations from 2023 Voltaic project with OTT', 2, 'u-jordan', { companyId: 'c-voltaic', opportunityId: 'o-voltaic-mfg' }],
  ['t-2', 'Log outcome of Halcyon × Volkova call', -1, 'u-jordan', { companyId: 'c-halcyon', opportunityId: 'o-halcyon-tps' }],
  ['t-3', 'Schedule Corvane lab tour (Cho, Ndlovu groups)', -3, 'u-marcus', { companyId: 'c-corvane', opportunityId: 'o-corvane-gan' }],
  ['t-4', 'Verify Nwosu contact via BME department admin', -6, 'u-marcus', { companyId: 'c-sentinel', opportunityId: 'o-sentinel-wear' }],
  ['t-5', 'Discovery call with Summit pack engineering', 3, 'u-jordan', { companyId: 'c-summit', opportunityId: 'o-summit-thermal' }],
  ['t-6', 'Copy and send Whitaker introduction from Outlook, then record it', 0, 'u-marcus', { companyId: 'c-corvane', opportunityId: 'o-corvane-edge' }],
  ['t-7', 'Ask AE department about sponsorship guidelines', 12, 'u-jordan', { companyId: 'c-atlas', opportunityId: 'o-atlas-seminar' }],
  ['t-8', 'Revise Clearwater pilot scope per reviewer', 1, 'u-marcus', { companyId: 'c-clearwater', opportunityId: 'o-clear-pfas' }],
  ['t-9', 'Ask Tessellate about intern degree levels', 10, 'u-jordan', { companyId: 'c-tessellate', opportunityId: 'o-tess-interns' }],
  ['t-10', 'Prepare CEC discovery interview questions', 4, 'u-jordan', {}],
  ['t-11', 'Send photonics consortium tiers to Lumenfold', 8, 'u-marcus', { companyId: 'c-lumen', opportunityId: 'o-lumen-consortium' }],
  ['t-12', 'Quarterly check-in with Northwind', -20, 'u-marcus', { companyId: 'c-northwind' }, true],
] as TK[]).map(([id, title, due, ownerId, refs, done]) => ({ id, title, due: ahead(due), ownerId, done: !!done, doneAt: done ? ago(21) : undefined, createdAt: ago(Math.max(1, 14 - due)), ...refs }));

/* ------------------------------------------------------------------------ */
/* Signals                                                                  */
/* ------------------------------------------------------------------------ */

type SG = Omit<Signal, 'date' | 'source' | 'ingestedBy'> & { d: number; source: [string, string, string?] };
const sig = (x: SG): Signal => {
  const { d, source, ...rest } = x;
  return { ...rest, date: ago(d), source: src(source[0], source[1], d, source[2]), ingestedBy: 'demo-feed' };
};

export const makeSignals = (): Signal[] => [
  sig({ id: 's-1', kind: 'new-publication', title: 'Okafor group publishes in-situ study of sulfide electrolyte interphases', detail: 'New paper directly relevant to stationary solid-state storage.', d: 6, source: ['src-pubs', 'Publication index (demo feed)'], facultyIds: ['f-okafor'], companyIds: ['c-voltaic'], topics: ['solid-state-batteries'], suggestedAction: 'Attach to Voltaic solid-state interest; consider a match run.', status: 'new' }),
  sig({ id: 's-2', kind: 'company-focus-change', title: 'Voltaic Ridge names new CTO with solid-state background', detail: 'Leadership change suggests renewed interest in cell technology.', d: 10, source: ['src-company', 'Company news (demo feed)'], facultyIds: [], companyIds: ['c-voltaic'], topics: ['solid-state-batteries', 'energy-storage'], suggestedAction: 'Revisit dormant relationship; create a research opportunity.', status: 'reviewed' }),
  sig({ id: 's-3', kind: 'funding-announcement', title: 'DOE announces long-duration storage manufacturing program', detail: 'Industry–university teams eligible; letters of intent due in ~8 weeks.', d: 4, source: ['src-company', 'Federal funding notice (demo feed)'], facultyIds: ['f-lindqvist', 'f-okafor'], companyIds: ['c-voltaic', 'c-northwind'], topics: ['energy-storage', 'advanced-manufacturing'], suggestedAction: 'Flag to Voltaic and Northwind owners as a possible joint proposal.', status: 'new' }),
  sig({ id: 's-4', kind: 'new-ip', title: 'New disclosure: cathode particle regeneration', detail: 'Lindqvist lab disclosed a direct recycling method.', d: 20, source: ['src-ott', 'OTT disclosures (demo feed)'], facultyIds: ['f-lindqvist'], companyIds: ['c-voltaic'], topics: ['battery-materials', 'sustainable-materials'], suggestedAction: 'Ask OTT whether it can be discussed with Voltaic.', status: 'new' }),
  sig({ id: 's-5', kind: 'company-announcement', title: 'Summit Motors announces in-house pack program', detail: 'Hiring 200 battery engineers over two years.', d: 15, source: ['src-company', 'Company news (demo feed)'], facultyIds: [], companyIds: ['c-summit'], topics: ['transportation', 'energy-storage', 'workforce'], suggestedAction: 'Create recruiting and research opportunities.', status: 'converted', opportunityId: 'o-summit-recruit' }),
  sig({ id: 's-6', kind: 'new-project', title: 'Brennan lab starts thermal runaway sensing project', detail: 'New industry-sponsored project (sponsor confidential).', d: 25, source: ['src-records', 'Sponsored projects feed (demo)'], facultyIds: ['f-brennan'], companyIds: ['c-summit'], topics: ['energy-storage', 'sensors'], suggestedAction: 'Check for conflict before proposing to Summit; Brennan has limited availability.', status: 'new' }),
  sig({ id: 's-7', kind: 'record-updated', title: 'Castillo profile refreshed with new EPA project', detail: 'Previously stale record now verified.', d: 30, source: ['src-directory', 'Directory crawl (demo)'], facultyIds: ['f-castillo'], companyIds: [], topics: ['environmental-remediation'], suggestedAction: 'No action; improves confidence for the Clearwater match.', status: 'reviewed' }),
  sig({ id: 's-8', kind: 'new-interest', title: 'Clearwater posts RFI for PFAS destruction pilots', detail: 'Public request for information from a regional utility.', d: 42, source: ['src-company', 'Public RFI (demo feed)'], facultyIds: ['f-castillo'], companyIds: ['c-clearwater'], topics: ['environmental-remediation'], suggestedAction: 'Converted into the PFAS treatment pilot opportunity.', status: 'converted', opportunityId: 'o-clear-pfas' }),
  sig({ id: 's-9', kind: 'new-publication', title: 'Sato & Abernathy publish thermostable mRNA formulation', detail: 'Relevant to Meridian’s rare-disease program logistics.', d: 18, source: ['src-pubs', 'Publication index (demo feed)'], facultyIds: ['f-sato', 'f-abernathy'], companyIds: ['c-meridian'], topics: ['drug-delivery', 'immunology'], suggestedAction: 'Attach to Meridian LNP opportunity as supporting evidence.', status: 'new' }),
  sig({ id: 's-10', kind: 'company-focus-change', title: 'Keyline approves FY27 innovation budget', detail: 'Previously closed for budget reasons.', d: 8, source: ['src-company', 'Company news (demo feed)'], facultyIds: ['f-hollis'], companyIds: ['c-keyline'], topics: ['supply-chain'], suggestedAction: 'Revisit the closed freight resilience opportunity.', status: 'new' }),
  sig({ id: 's-11', kind: 'new-ip', title: 'Provisional filed: AM ceramic tiles with cooling channels', detail: 'Volkova and Osei joint filing.', d: 55, source: ['src-ott', 'OTT disclosures (demo feed)'], facultyIds: ['f-volkova', 'f-osei'], companyIds: ['c-halcyon'], topics: ['aerostructures', 'additive-manufacturing'], suggestedAction: 'Make sure Halcyon conversation respects OTT process.', status: 'reviewed' }),
  sig({ id: 's-12', kind: 'funding-announcement', title: 'NSF program on AI evaluation science', detail: 'Industry partners encouraged.', d: 12, source: ['src-company', 'Federal funding notice (demo feed)'], facultyIds: ['f-iyer'], companyIds: ['c-tessellate'], topics: ['responsible-ai', 'nlp'], suggestedAction: 'Share with Tessellate owner for the follow-on project.', status: 'new' }),
  sig({ id: 's-13', kind: 'record-updated', title: 'Greenberg sabbatical recorded in directory', detail: 'Availability now marked unavailable through summer 2027.', d: 35, source: ['src-directory', 'Directory crawl (demo)'], facultyIds: ['f-greenberg'], companyIds: [], topics: ['data-science'], suggestedAction: 'Matching now applies an availability penalty.', status: 'reviewed' }),
];

/* ------------------------------------------------------------------------ */
/* Data sources & issues                                                    */
/* ------------------------------------------------------------------------ */

export const makeSources = (): DataSource[] => [
  { id: 'src-directory', name: 'Department faculty directories', kind: 'faculty-directory', provider: 'directory-snapshot', status: 'demo', owner: 'Athrav (data sourcing)', lastSync: ago(3), cadence: 'Weekly (planned)', recordTypes: ['Faculty', 'Projects'], description: 'Public faculty pages: names, titles, departments, research summaries.', accessNote: 'Demo snapshot of fictional records. Approved crawling method and terms-of-use review pending.' },
  { id: 'src-pubs', name: 'Publication index', kind: 'publication-db', provider: 'publication-index', status: 'demo', owner: 'Athrav (data sourcing)', lastSync: ago(5), cadence: 'Weekly (planned)', recordTypes: ['Publications'], description: 'Bibliographic records linked to researcher identifiers (e.g. an open scholarly API).', accessNote: 'Planned: an open, keyless scholarly API. Currently demo data with placeholder DOIs.' },
  { id: 'src-records', name: 'University sponsored-projects records', kind: 'university-records', provider: 'none', status: 'awaiting-access', owner: 'Research Office (TBD)', recordTypes: ['Projects', 'Relationships'], description: 'Awarded projects, sponsors, dates.', accessNote: 'No access requested yet. Project records shown come from the demo dataset.' },
  { id: 'src-ott', name: 'OTT technology portfolio', kind: 'ott', provider: 'none', status: 'awaiting-access', owner: 'Office of Technology Transfer', recordTypes: ['IP', 'Disclosures'], description: 'Disclosures, filings, licensing status.', accessNote: 'To be discussed in OTT discovery meeting. IP shown is fictional demo data.' },
  { id: 'src-company', name: 'Company websites & public news', kind: 'company-site', provider: 'demo-feed', status: 'demo', owner: 'CEC', lastSync: ago(1), cadence: 'Daily (planned)', recordTypes: ['Companies', 'Signals'], description: 'Company descriptions, announcements, funding notices.', accessNote: 'Demo signal feed. All companies are fictional.' },
  { id: 'src-import', name: 'CSV imports', kind: 'import', provider: 'csv', status: 'manual', owner: 'Any staff member', recordTypes: ['Faculty', 'Companies'], description: 'Approved spreadsheets uploaded by staff (e.g. the OSVPR industry leads list).', accessNote: 'Working: upload a CSV on this page. Imported rows are marked unverified.' },
  { id: 'src-manual', name: 'Staff-entered records', kind: 'manual', provider: 'manual', status: 'manual', owner: 'CEC / OTT staff', recordTypes: ['Companies', 'Notes', 'Activity'], description: 'Information typed directly into Keystone.', accessNote: 'Always attributed to the person who entered it.' },
  { id: 'src-mcp', name: 'MCP / API connectors', kind: 'university-records', provider: 'mcp', status: 'not-connected', owner: 'Project team', recordTypes: ['Any'], description: 'Provider slot for approved MCP servers or institutional APIs.', accessNote: 'Interface defined in server/providers.ts. No connector configured.' },
];

type DI = Omit<DataIssue, 'createdAt'> & { d: number };
const di = ({ d, ...x }: DI): DataIssue => ({ ...x, createdAt: ago(d) });

export const makeIssues = (): DataIssue[] => [
  di({ id: 'di-reyes-stale', kind: 'stale', entity: 'faculty', entityId: 'f-reyes', field: 'profile', detail: 'Last verified 412 days ago.', status: 'open', d: 5 }),
  di({ id: 'di-park-stale', kind: 'stale', entity: 'faculty', entityId: 'f-park', field: 'profile', detail: 'Last verified 520 days ago; no active projects listed.', status: 'open', d: 30 }),
  di({ id: 'di-hughes-stale', kind: 'stale', entity: 'faculty', entityId: 'f-hughes', field: 'profile', detail: 'Last verified 460 days ago.', status: 'open', d: 30 }),
  di({ id: 'di-larsen-stale', kind: 'stale', entity: 'faculty', entityId: 'f-larsen', field: 'profile', detail: 'Last verified 380 days ago; most relevant project completed.', status: 'open', d: 10 }),
  di({ id: 'di-reyes-email', kind: 'unverified-contact', entity: 'faculty', entityId: 'f-reyes', field: 'email', detail: 'Email inferred from naming pattern; not verified.', status: 'open', d: 5 }),
  di({ id: 'di-nwosu-email', kind: 'unverified-contact', entity: 'faculty', entityId: 'f-nwosu', field: 'email', detail: 'Email not listed on department page.', status: 'open', d: 22 }),
  di({ id: 'di-reyes-projects', kind: 'missing', entity: 'faculty', entityId: 'f-reyes', field: 'projects', detail: 'One project listed, four publications since 2023. Project list likely incomplete.', status: 'open', d: 5 }),
  di({ id: 'di-nwosu-projects', kind: 'missing', entity: 'faculty', entityId: 'f-nwosu', field: 'projects', detail: 'Only one project listed.', status: 'open', d: 22 }),
  di({ id: 'di-novak-title', kind: 'conflict', entity: 'faculty', entityId: 'f-novak', field: 'title', detail: 'Sources disagree on academic title.', values: [{ value: 'Associate Professor', sourceId: 'src-directory' }, { value: 'Professor', sourceId: 'src-pubs' }], status: 'open', d: 12 }),
  di({ id: 'di-dubois-ip', kind: 'conflict', entity: 'ip', entityId: 'ip-12', field: 'status', detail: 'Press release mentions a “patented film”; OTT has no matching record.', values: [{ value: 'Patented (press release)', sourceId: 'src-company' }, { value: 'No record', sourceId: 'src-ott' }], status: 'open', d: 16 }),
  di({ id: 'di-park-proj', kind: 'missing', entity: 'faculty', entityId: 'f-park', field: 'projects', detail: 'No current projects listed.', status: 'open', d: 30 }),
  di({ id: 'di-corvane-dup', kind: 'duplicate', entity: 'company', entityId: 'c-corvane', duplicateOfId: 'c-corvane', detail: '“Corvane Semi” (import) merged into Corvane Semiconductor.', status: 'resolved', resolution: 'Merged', resolvedBy: 'u-dana', resolvedAt: ago(18), d: 20 }),
  di({ id: 'di-larsen-src', kind: 'missing', entity: 'faculty', entityId: 'f-larsen', field: 'sources', detail: 'Single source; no publication index match after 2022.', status: 'open', d: 10 }),
  di({ id: 'di-greenberg-avail', kind: 'stale', entity: 'faculty', entityId: 'f-greenberg', field: 'availability', detail: 'Sabbatical recorded only after a failed introduction.', status: 'resolved', resolution: 'Availability updated to unavailable', resolvedBy: 'u-dana', resolvedAt: ago(35), d: 200 }),
];

/* ------------------------------------------------------------------------ */
/* Misc                                                                     */
/* ------------------------------------------------------------------------ */

export const makeNotifications = (): Notification[] => [
  { id: 'n-1', at: ago(0, 3), userId: 'u-jordan', kind: 'follow-up', text: 'Halcyon outcome log is overdue', href: '/opportunities/o-halcyon-tps', read: false },
  { id: 'n-2', at: ago(1), userId: 'u-jordan', kind: 'review', text: 'Sentinel wearable study needs your input', href: '/review?item=r-sentinel-nwosu', read: false },
  { id: 'n-3', at: ago(4), userId: 'u-jordan', kind: 'signal', text: 'DOE storage manufacturing program — relevant to Voltaic', href: '/signals?item=s-3', read: false },
  { id: 'n-4', at: ago(6), userId: 'u-jordan', kind: 'signal', text: 'New Okafor publication matches Voltaic interest', href: '/signals?item=s-1', read: true },
  { id: 'n-5', at: ago(5), userId: 'u-dana', kind: 'data', text: 'Reyes profile flagged as stale', href: '/data?tab=issues', read: false },
  { id: 'n-6', at: ago(3), userId: 'u-marcus', kind: 'review', text: 'Jordan requested your review: Emi Sato for Meridian', href: '/review?item=r-meridian-sato', read: false },
  { id: 'n-7', at: ago(10), userId: 'u-dana', kind: 'review', text: 'Low-confidence match assigned: Erik Larsen', href: '/review?item=r-northwind-larsen', read: false },
];

export const makeFeedback = (): Feedback[] => [
  { id: 'fb-1', at: ago(2), authorId: 'u-guest', stakeholder: 'Project team', page: '/match', kind: 'match-quality', text: 'Genomics alone matched McCarthy to a plant pathology need. Should sub-fields be distinguished?', status: 'triaged' },
  { id: 'fb-2', at: ago(1), authorId: 'u-guest', stakeholder: 'Project team', page: '/data', kind: 'missing-data', text: 'Ask OTT whether disclosure records can be shared before filing.', status: 'open' },
];

export const makeShortlists = (): Shortlist[] => [
  { id: 'sl-storage', name: 'Energy storage bench', description: 'Researchers to keep in mind for storage-related companies.', facultyIds: ['f-okafor', 'f-lindqvist', 'f-chandra', 'f-reyes'], createdAt: ago(40), createdBy: 'u-jordan' },
  { id: 'sl-ai', name: 'AI evaluation & governance', facultyIds: ['f-iyer', 'f-whitaker'], createdAt: ago(80), createdBy: 'u-jordan' },
];
