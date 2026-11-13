import type { Company, CompanyInterest, Relationship } from '../types';
import { ago, src } from './util';

type C = Omit<Company, 'notes' | 'createdAt' | 'sources' | 'lastTouch'> & { touched?: number; created?: number; notes?: [string, string, number][] };

const co = (x: C): Company => ({
  ...x,
  notes: (x.notes ?? []).map(([authorId, text, d], i) => ({ id: `${x.id}-n${i}`, authorId, text, at: ago(d) })),
  createdAt: ago(x.created ?? 400),
  lastTouch: x.touched === undefined ? undefined : ago(x.touched),
  sources: [src('src-company', 'Company website (fictional company)', 30), src('src-manual', 'CEC staff entry', x.created ?? 400)],
});

export const makeCompanies = (): Company[] => [
  co({
    id: 'c-voltaic', name: 'Voltaic Ridge Energy', industry: 'Energy storage', website: 'voltaic-ridge.example.com', hq: 'Pittsburgh, PA', size: 'mid-size',
    description: 'Develops and operates utility-scale battery storage projects in the Mid-Atlantic. Exploring in-house cell technology for longer-duration storage.',
    objectives: ['De-risk a move to solid-state cells for stationary storage', 'Lower the carbon footprint of cell manufacturing', 'Hire battery engineers from the region'],
    relationship: 'dormant', ownerId: 'u-jordan', touched: 9, created: 1600,
    notes: [
      ['u-jordan', 'Their new CTO (joined summer 2026) asked whether the university still works on solid electrolytes. Previous project with Lindqvist ended 2023 on good terms.', 9],
      ['u-marcus', 'Check whether the 2023 project left any IP obligations before we propose anything new.', 7],
    ],
  }),
  co({
    id: 'c-northwind', name: 'Northwind Grid Services', industry: 'Electric utility', website: 'northwind-grid.example.com', hq: 'Harrisburg, PA', size: 'enterprise',
    description: 'Regional transmission and distribution utility investing in grid resilience and storage.',
    objectives: ['Quantify climate risk to grid assets', 'Plan storage siting', 'Strengthen cybersecurity of operations'],
    relationship: 'active', ownerId: 'u-marcus', touched: 21, created: 900,
  }),
  co({
    id: 'c-meridian', name: 'Meridian Biologics', industry: 'Biotechnology', website: 'meridian-bio.example.com', hq: 'Philadelphia, PA', size: 'mid-size',
    description: 'Clinical-stage company developing mRNA therapeutics for rare diseases.',
    objectives: ['Access next-generation delivery chemistry', 'Evaluate licensing of targeted lipids', 'Build relationships with immunology labs'],
    relationship: 'active', ownerId: 'u-jordan', touched: 4, created: 300,
    notes: [['u-leah', 'Meridian legal asked about field-of-use exclusivity. Any IP discussion goes through OTT.', 12]],
  }),
  co({
    id: 'c-corvane', name: 'Corvane Semiconductor', industry: 'Semiconductors', website: 'corvane.example.com', hq: 'Austin, TX', size: 'enterprise',
    description: 'Designs low-power AI chips for edge devices; expanding a power-device line.',
    objectives: ['Sponsor edge-AI accelerator research', 'Recruit GaN device engineers', 'Raise campus visibility with students'],
    relationship: 'active', ownerId: 'u-marcus', touched: 2, created: 700,
  }),
  co({
    id: 'c-halcyon', name: 'Halcyon Aerospace', industry: 'Aerospace & defense', website: 'halcyon-aero.example.com', hq: 'Huntsville, AL', size: 'mid-size',
    description: 'Builds hypersonic test vehicles and thermal protection systems.',
    objectives: ['Advance ceramic thermal protection', 'Qualify printed metal parts'],
    relationship: 'active', ownerId: 'u-jordan', touched: 6, created: 500,
  }),
  co({
    id: 'c-arbor', name: 'Arbor Fields AgTech', industry: 'Agriculture technology', website: 'arborfields.example.com', hq: 'Lancaster, PA', size: 'startup',
    description: 'Robotic crop scouting service for specialty and row crops.',
    objectives: ['Field-test autonomous scouting', 'Improve disease detection models'],
    relationship: 'active', ownerId: 'u-jordan', touched: 15, created: 420,
  }),
  co({
    id: 'c-lumen', name: 'Lumenfold Photonics', industry: 'Photonics', website: 'lumenfold.example.com', hq: 'Rochester, NY', size: 'startup',
    description: 'Silicon photonics startup building optical interconnects for AI clusters.',
    objectives: ['Join a photonics research consortium', 'Recruit photonics PhDs'],
    relationship: 'prospect', ownerId: 'u-marcus', touched: 30, created: 120,
  }),
  co({
    id: 'c-tessellate', name: 'Tessellate AI', industry: 'Artificial intelligence', website: 'tessellate.example.ai', hq: 'New York, NY', size: 'startup',
    description: 'Builds evaluation tooling for enterprise language-model deployments.',
    objectives: ['Co-develop LLM evaluation methods', 'Hire research interns'],
    relationship: 'active', ownerId: 'u-jordan', touched: 11, created: 260,
  }),
  co({
    id: 'c-keyline', name: 'Keyline Logistics', industry: 'Logistics', website: 'keyline.example.com', hq: 'Allentown, PA', size: 'enterprise',
    description: 'Third-party logistics provider operating 40 distribution centers.',
    objectives: ['Network resilience modeling', 'Warehouse automation'],
    relationship: 'former', ownerId: 'u-marcus', touched: 160, created: 800,
  }),
  co({
    id: 'c-fairmount', name: 'Fairmount Foods', industry: 'Food & beverage', website: 'fairmountfoods.example.com', hq: 'Hershey, PA', size: 'enterprise',
    description: 'Packaged food manufacturer pursuing plastic-free packaging by 2030.',
    objectives: ['Compostable packaging', 'Nutrition research partnerships'],
    relationship: 'active', ownerId: 'u-jordan', touched: 25, created: 1000,
  }),
  co({
    id: 'c-sentinel', name: 'Sentinel Health Systems', industry: 'Health technology', website: 'sentinelhealth.example.com', hq: 'Pittsburgh, PA', size: 'mid-size',
    description: 'Remote patient monitoring platform for cardiology practices.',
    objectives: ['Validate wearable sensors', 'Clinical analytics methods'],
    relationship: 'active', ownerId: 'u-marcus', touched: 40, created: 350,
  }),
  co({
    id: 'c-ridgeway', name: 'Ridgeway Materials', industry: 'Specialty chemicals', website: 'ridgeway-materials.example.com', hq: 'Wilmington, DE', size: 'enterprise',
    description: 'Specialty polymer producer moving into recycled-content resins.',
    objectives: ['License recyclable polymer chemistry', 'Sponsor depolymerization catalysis'],
    relationship: 'active', ownerId: 'u-leah', touched: 8, created: 230,
  }),
  co({
    id: 'c-atlas', name: 'Atlas Built Environments', industry: 'Construction & buildings', website: 'atlasbuilt.example.com', hq: 'Philadelphia, PA', size: 'mid-size',
    description: 'Design-build firm specializing in high-performance commercial buildings.',
    objectives: ['Build brand with architectural engineering students', 'Explore grid-interactive building controls'],
    relationship: 'prospect', ownerId: 'u-jordan', touched: 19, created: 60,
  }),
  co({
    id: 'c-clearwater', name: 'Clearwater Utilities Authority', industry: 'Water utility', website: 'clearwater-ua.example.org', hq: 'State College, PA', size: 'mid-size',
    description: 'Municipal water authority facing new PFAS limits.',
    objectives: ['Pilot PFAS treatment technology', 'Monitoring program design'],
    relationship: 'prospect', ownerId: 'u-marcus', touched: 5, created: 45,
  }),
  co({
    id: 'c-summit', name: 'Summit Motors', industry: 'Automotive', website: 'summitmotors.example.com', hq: 'Detroit, MI', size: 'enterprise',
    description: 'EV maker developing next-generation pack architecture.',
    objectives: ['Battery pack thermal safety', 'Power electronics for charging', 'Recruit battery engineers'],
    relationship: 'prospect', ownerId: 'u-jordan', touched: 3, created: 14,
  }),
  co({
    id: 'c-carbonloop', name: 'CarbonLoop', industry: 'Climate technology', website: 'carbonloop.example.com', hq: 'Boston, MA', size: 'startup',
    description: 'Direct air capture startup scaling modular capture units.',
    objectives: ['Independent sorbent testing', 'CO₂ utilization pathways'],
    relationship: 'active', ownerId: 'u-marcus', touched: 13, created: 200,
  }),
];

type I = [id: string, companyId: string, pathway: CompanyInterest['pathway'], title: string, description: string, topics: string[], status: CompanyInterest['status'], created: number];
const ci = (...[id, companyId, pathway, title, description, topics, status, created]: I): CompanyInterest => ({ id, companyId, pathway, title, description, topics, status, createdAt: ago(created) });

export const makeInterests = (): CompanyInterest[] => [
  ci('ci-voltaic-1', 'c-voltaic', 'research', 'Solid-state cells for long-duration storage', 'Evaluate whether solid electrolytes can extend cycle life and safety for 8-hour stationary storage.', ['solid-state-batteries', 'energy-storage', 'electrochemistry'], 'open', 9),
  ci('ci-voltaic-2', 'c-voltaic', 'research', 'Lower-carbon cell manufacturing', 'Reduce energy and solvent use in electrode production; interest in recycling partnerships.', ['advanced-manufacturing', 'sustainable-materials', 'battery-materials'], 'exploring', 60),
  ci('ci-voltaic-3', 'c-voltaic', 'talent', 'Battery engineering interns', 'Summer interns with electrochemistry lab experience.', ['battery-materials', 'workforce'], 'open', 30),
  ci('ci-northwind-1', 'c-northwind', 'research', 'Climate risk to transmission assets', 'Probabilistic risk scores for storms and heat.', ['climate', 'power-systems', 'data-science'], 'open', 70),
  ci('ci-northwind-2', 'c-northwind', 'research', 'Storage siting study', 'Where to place grid batteries for maximum reliability value.', ['energy-storage', 'power-systems'], 'exploring', 20),
  ci('ci-northwind-3', 'c-northwind', 'research', 'OT network security', 'Intrusion detection for substations.', ['cybersecurity', 'power-systems'], 'paused', 300),
  ci('ci-meridian-1', 'c-meridian', 'research', 'Tissue-targeted mRNA delivery', 'Delivery beyond the liver for rare-disease therapies.', ['drug-delivery', 'nanomaterials'], 'open', 40),
  ci('ci-meridian-2', 'c-meridian', 'research', 'License targeted lipid chemistry', 'Field-of-use license for ionizable lipids.', ['drug-delivery'], 'exploring', 25),
  ci('ci-corvane-1', 'c-corvane', 'research', 'Sparse inference accelerators', 'Hardware–software co-design for transformer inference at the edge.', ['machine-learning', 'edge-computing', 'semiconductors'], 'open', 120),
  ci('ci-corvane-2', 'c-corvane', 'talent', 'GaN device engineers', 'Full-time hires and co-ops in power devices.', ['semiconductors', 'workforce'], 'open', 90),
  ci('ci-corvane-3', 'c-corvane', 'engagement', 'Career fair and tech talks', 'Visibility with engineering students.', ['workforce'], 'fulfilled', 200),
  ci('ci-halcyon-1', 'c-halcyon', 'research', 'Thermal protection materials', 'Ceramic composites for leading edges.', ['aerostructures', 'ceramics', 'composites'], 'open', 150),
  ci('ci-halcyon-2', 'c-halcyon', 'research', 'Printed metal part qualification', 'Qualify AM superalloy brackets.', ['additive-manufacturing', 'aerostructures'], 'open', 40),
  ci('ci-arbor-1', 'c-arbor', 'research', 'Autonomous scouting field trials', 'Robot and drone trials in orchards and row crops.', ['precision-agriculture', 'autonomy'], 'open', 100),
  ci('ci-arbor-2', 'c-arbor', 'research', 'Crop disease genomics', 'Genetic markers for disease resistance.', ['genomics', 'plant-science'], 'paused', 260),
  ci('ci-lumen-1', 'c-lumen', 'engagement', 'Photonics consortium membership', 'Join an industry consortium for precompetitive research.', ['photonics'], 'open', 60),
  ci('ci-tess-1', 'c-tessellate', 'research', 'LLM evaluation methods', 'Rigorous human evaluation protocols.', ['nlp', 'responsible-ai'], 'fulfilled', 200),
  ci('ci-tess-2', 'c-tessellate', 'talent', 'AI research interns', 'Graduate interns for summer 2027.', ['machine-learning', 'nlp', 'workforce'], 'open', 20),
  ci('ci-keyline-1', 'c-keyline', 'research', 'Freight network resilience', 'Model port and weather disruptions.', ['supply-chain', 'optimization'], 'paused', 400),
  ci('ci-fair-1', 'c-fairmount', 'research', 'Compostable packaging', 'Replace multilayer plastic films.', ['food-science', 'sustainable-materials'], 'fulfilled', 500),
  ci('ci-fair-2', 'c-fairmount', 'research', 'Nutrition science', 'Effects of reformulated products.', ['nutrition'], 'exploring', 50),
  ci('ci-sent-1', 'c-sentinel', 'research', 'Wearable sensor validation', 'Clinical validation of patch sensors.', ['digital-health', 'sensors'], 'open', 80),
  ci('ci-ridge-1', 'c-ridgeway', 'research', 'Recyclable polymer chemistry', 'License and co-develop recyclable polyesters.', ['polymers', 'sustainable-materials'], 'open', 150),
  ci('ci-atlas-1', 'c-atlas', 'engagement', 'Student engagement & seminars', 'Sponsor a seminar series and studio reviews.', ['smart-buildings', 'workforce'], 'open', 50),
  ci('ci-clear-1', 'c-clearwater', 'research', 'PFAS treatment pilot', 'Pilot a destructive PFAS technology at one plant.', ['environmental-remediation', 'soil-water'], 'open', 40),
  ci('ci-summit-1', 'c-summit', 'research', 'Pack thermal safety', 'Early warning and cooling for large packs.', ['energy-storage', 'transportation', 'sensors'], 'open', 10),
  ci('ci-summit-2', 'c-summit', 'talent', 'Battery engineer recruiting', 'Hire MS/PhD battery engineers.', ['battery-materials', 'workforce'], 'open', 10),
  ci('ci-carbon-1', 'c-carbonloop', 'research', 'Sorbent testing', 'Independent sorbent performance testing.', ['carbon-capture'], 'open', 90),
];

type Rel = [id: string, companyId: string, kind: Relationship['kind'], title: string, description: string, since: number, until: number | null, facultyIds: string[], departmentIds: string[], status: Relationship['status']];
const rel = (...[id, companyId, kind, title, description, since, until, facultyIds, departmentIds, status]: Rel): Relationship => ({
  id, companyId, kind, title, description, since: ago(since), until: until === null ? undefined : ago(until), facultyIds, departmentIds, status,
  source: src('src-records', 'Sponsored projects / CEC records (demo snapshot)', 60),
});

export const makeRelationships = (): Relationship[] => [
  rel('rel-1', 'c-voltaic', 'sponsored-project', 'Electrode calendering study', 'One-year sponsored study with the Electrode Manufacturing Group.', 1500, 1100, ['f-lindqvist'], ['d-chme'], 'ended'),
  rel('rel-2', 'c-voltaic', 'recruiting', 'Career fair participant (2022–2023)', 'Attended two engineering career fairs.', 1400, 900, [], ['d-chme', 'd-mse'], 'ended'),
  rel('rel-3', 'c-northwind', 'membership', 'Energy institute affiliate member', 'Annual affiliate membership.', 900, null, [], ['d-eme'], 'active'),
  rel('rel-4', 'c-corvane', 'recruiting', 'Engineering co-op employer', 'Hosts 4–6 co-ops per year.', 700, null, [], ['d-ee', 'd-cse'], 'active'),
  rel('rel-5', 'c-corvane', 'sponsored-project', 'Edge AI benchmark study', 'Small gift-funded benchmark study.', 600, 300, ['f-whitaker'], ['d-cse'], 'ended'),
  rel('rel-6', 'c-halcyon', 'sponsored-project', 'CMC oxidation testing', 'Test campaign for leading-edge coupons.', 500, null, ['f-volkova'], ['d-aero'], 'active'),
  rel('rel-7', 'c-fairmount', 'sponsored-project', 'Compostable barrier films', 'Sponsor of active packaging project.', 240, null, ['f-dubois'], ['d-food'], 'active'),
  rel('rel-8', 'c-fairmount', 'event', 'Food science day sponsor', 'Annual sponsorship.', 1000, null, [], ['d-food'], 'active'),
  rel('rel-9', 'c-keyline', 'advisory', 'Supply chain advisory board seat', 'Executive served on advisory board until 2025.', 1500, 400, [], ['d-scm'], 'ended'),
  rel('rel-10', 'c-ridgeway', 'license', 'Option on recyclable polyester', 'Six-month evaluation option (demo record).', 120, null, ['f-haddad'], ['d-chem'], 'active'),
  rel('rel-11', 'c-tessellate', 'sponsored-project', 'LLM evaluation pilot', 'Three-month pilot with the IST lab.', 200, 40, ['f-iyer'], ['d-ist'], 'ended'),
  rel('rel-12', 'c-carbonloop', 'sponsored-project', 'Sorbent test campaign', 'Fee-for-service testing.', 150, null, ['f-ferreira'], ['d-eme'], 'active'),
];
