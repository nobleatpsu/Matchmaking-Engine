import type { Department, Faculty, User } from '../types';
import { ago, src } from './util';

export const users: User[] = [
  { id: 'u-jordan', name: 'Jordan Ellis', email: 'jordan.ellis@demo.example', initials: 'JE', title: 'Engagement Lead · CEC', team: 'CEC', role: 'reviewer', active: true },
  { id: 'u-marcus', name: 'Marcus Hale', email: 'marcus.hale@demo.example', initials: 'MH', title: 'Associate Director · CEC', team: 'CEC', role: 'admin', active: true },
  { id: 'u-leah', name: 'Leah Brandt', email: 'leah.brandt@demo.example', initials: 'LB', title: 'Licensing Manager · OTT', team: 'OTT', role: 'reviewer', active: true },
  { id: 'u-dana', name: 'Dana Whitfield', email: 'dana.whitfield@demo.example', initials: 'DW', title: 'Research Data Steward', team: 'Research Office', role: 'reviewer', active: true },
  { id: 'u-sam', name: 'Sam Ortiz', email: 'sam.ortiz@demo.example', initials: 'SO', title: 'Engagement Coordinator · CEC', team: 'CEC', role: 'staff', active: true },
  { id: 'u-guest', name: 'Project Team (viewer)', email: 'viewer@demo.example', initials: 'PT', title: 'Nittany AI project team', team: 'Project Team', role: 'viewer', active: true },
];

const ENG = 'College of Engineering';
const EMS = 'College of Earth and Mineral Sciences';
const SCI = 'Eberly College of Science';
const AG = 'College of Agricultural Sciences';
const IST = 'College of Information Sciences and Technology';
const MED = 'College of Medicine';
const HHD = 'College of Health and Human Development';
const BUS = 'Smeal College of Business';

export const COLLEGES = [ENG, EMS, SCI, AG, IST, MED, HHD, BUS];

export const departments: Department[] = [
  { id: 'd-mse', name: 'Materials Science and Engineering', college: EMS },
  { id: 'd-eme', name: 'Energy and Mineral Engineering', college: EMS },
  { id: 'd-meteo', name: 'Meteorology and Atmospheric Science', college: EMS },
  { id: 'd-geo', name: 'Geosciences', college: EMS },
  { id: 'd-chme', name: 'Chemical Engineering', college: ENG },
  { id: 'd-me', name: 'Mechanical Engineering', college: ENG },
  { id: 'd-ee', name: 'Electrical Engineering', college: ENG },
  { id: 'd-cse', name: 'Computer Science and Engineering', college: ENG },
  { id: 'd-bme', name: 'Biomedical Engineering', college: ENG },
  { id: 'd-ae', name: 'Architectural Engineering', college: ENG },
  { id: 'd-ie', name: 'Industrial and Manufacturing Engineering', college: ENG },
  { id: 'd-aero', name: 'Aerospace Engineering', college: ENG },
  { id: 'd-cee', name: 'Civil and Environmental Engineering', college: ENG },
  { id: 'd-nuc', name: 'Nuclear Engineering', college: ENG },
  { id: 'd-chem', name: 'Chemistry', college: SCI },
  { id: 'd-phys', name: 'Physics', college: SCI },
  { id: 'd-stat', name: 'Statistics', college: SCI },
  { id: 'd-ist', name: 'Information Sciences and Technology', college: IST },
  { id: 'd-micro', name: 'Microbiology and Immunology', college: MED },
  { id: 'd-nutr', name: 'Nutritional Sciences', college: HHD },
  { id: 'd-abe', name: 'Agricultural and Biological Engineering', college: AG },
  { id: 'd-plant', name: 'Plant Science', college: AG },
  { id: 'd-food', name: 'Food Science', college: AG },
  { id: 'd-scm', name: 'Supply Chain and Information Systems', college: BUS },
];

type F = Omit<Faculty, 'sources' | 'lastVerified' | 'emailVerified' | 'interests' | 'coverageNotes' | 'availability' | 'email' | 'profileUrl'> & {
  verifiedDaysAgo?: number;
  emailVerified?: boolean;
  nSources?: number;
  interests?: Faculty['interests'];
  coverageNotes?: string[];
  availability?: Faculty['availability'];
};

const handle = (name: string) => name.toLowerCase().replace(/^dr\.?\s+/, '').split(' ').slice(-1)[0].replace(/[^a-z]/g, '');

function fac(x: F): Faculty {
  const h = handle(x.name);
  const v = x.verifiedDaysAgo;
  const sources = [src('src-directory', 'Department faculty page (demo snapshot)', v ?? 500, `https://directory.example.edu/faculty/${h}`)];
  if ((x.nSources ?? 2) >= 2) sources.push(src('src-pubs', 'Publication index (demo snapshot)', Math.max(5, (v ?? 300) - 20)));
  if ((x.nSources ?? 2) >= 3) sources.push(src('src-ott', 'OTT technology portfolio (demo snapshot)', Math.max(5, (v ?? 300) - 40)));
  return {
    id: x.id, name: x.name, title: x.title, departmentId: x.departmentId, summary: x.summary,
    expertise: x.expertise, keywords: x.keywords, labName: x.labName, labSize: x.labSize,
    email: `${h}@example.edu`, emailVerified: x.emailVerified ?? true,
    profileUrl: `https://directory.example.edu/faculty/${h}`,
    interests: x.interests ?? [], availability: x.availability ?? 'unknown',
    lastVerified: v === undefined ? undefined : ago(v), sources, coverageNotes: x.coverageNotes ?? [],
  };
}

const R = (note: string, verified = true) => ({ pathway: 'research' as const, note, verified });
const T = (note: string, verified = true) => ({ pathway: 'talent' as const, note, verified });
const E = (note: string, verified = true) => ({ pathway: 'engagement' as const, note, verified });

export const makeFaculty = (): Faculty[] => [
  // ---- Energy storage cluster ------------------------------------------
  fac({
    id: 'f-okafor', name: 'Adaeze Okafor', title: 'Associate Professor', departmentId: 'd-mse', labName: 'Solid Ionics Lab', labSize: 9,
    summary: 'Studies how ions move across solid–solid interfaces in ceramic and sulfide electrolytes, with the goal of making solid-state batteries that survive thousands of cycles. Combines electrochemical testing with in-situ electron microscopy.',
    expertise: ['solid-state-batteries', 'electrochemistry', 'ceramics', 'materials-characterization'],
    keywords: ['solid electrolytes', 'electrochemical interfaces', 'lithium metal anode', 'in-situ TEM'],
    verifiedDaysAgo: 38, nSources: 3, availability: 'open',
    interests: [R('Open to sponsored projects on electrolyte scale-up (confirmed with CEC, spring 2026).'), T('Hosts summer industry interns.', false)],
  }),
  fac({
    id: 'f-lindqvist', name: 'Henrik Lindqvist', title: 'Professor', departmentId: 'd-chme', labName: 'Electrode Manufacturing Group', labSize: 12,
    summary: 'Develops low-energy manufacturing routes for lithium-ion and next-generation battery electrodes, including dry processing and direct recycling of cathode materials.',
    expertise: ['battery-materials', 'advanced-manufacturing', 'sustainable-materials', 'chemical-processes'],
    keywords: ['dry electrode processing', 'cathode recycling', 'sustainable manufacturing', 'scale-up'],
    verifiedDaysAgo: 122, nSources: 3, availability: 'limited',
    interests: [R('Prefers multi-year consortium projects.'), T('Strong placement record with cell manufacturers.')],
  }),
  fac({
    id: 'f-reyes', name: 'Marisol Reyes', title: 'Assistant Professor', departmentId: 'd-eme', labSize: 4,
    summary: 'Models how grid-scale energy storage and renewables can be sited and operated together, with a focus on techno-economic analysis for utilities.',
    expertise: ['energy-storage', 'power-systems', 'renewables', 'data-science'],
    keywords: ['grid storage', 'techno-economic analysis', 'capacity expansion'],
    verifiedDaysAgo: 412, emailVerified: false, nSources: 1,
    coverageNotes: ['Only one project is listed in the department directory; publication record suggests more active work.'],
  }),
  fac({
    id: 'f-chandra', name: 'Vikram Chandra', title: 'Professor', departmentId: 'd-mse', labName: 'Computational Materials Design Group', labSize: 14,
    summary: 'Uses phase-field modeling, first-principles calculations and machine learning to predict how battery and structural materials degrade over time.',
    expertise: ['computational-materials', 'battery-materials', 'hpc', 'machine-learning'],
    keywords: ['phase-field', 'DFT', 'battery degradation', 'materials informatics'],
    verifiedDaysAgo: 64, availability: 'open',
    interests: [R('Interested in data-sharing partnerships with cell makers.'), T('Places many PhDs in industry R&D.')],
  }),
  fac({
    id: 'f-tanaka', name: 'Keiko Tanaka', title: 'Associate Professor', departmentId: 'd-chme', labSize: 7,
    summary: 'Designs earth-abundant catalysts for water electrolyzers and fuel cells to make green hydrogen cheaper.',
    expertise: ['fuel-cells', 'catalysis', 'electrochemistry'],
    keywords: ['electrolyzer', 'green hydrogen', 'oxygen evolution'],
    verifiedDaysAgo: 150, interests: [R('Open to industry-sponsored catalyst testing.')],
  }),
  fac({
    id: 'f-ndlovu', name: 'Sipho Ndlovu', title: 'Assistant Professor', departmentId: 'd-ee', labSize: 5,
    summary: 'Builds wide-bandgap power electronics for EV charging and grid-connected storage.',
    expertise: ['power-systems', 'semiconductors', 'transportation'],
    keywords: ['power electronics', 'EV charging', 'silicon carbide', 'grid integration'],
    verifiedDaysAgo: 90,
  }),
  fac({
    id: 'f-brennan', name: 'Claire Brennan', title: 'Professor', departmentId: 'd-me', labSize: 10,
    summary: 'Works on thermal management and safety of battery packs for electric vehicles and stationary storage, including thermal runaway detection.',
    expertise: ['transportation', 'energy-storage', 'sensors'],
    keywords: ['battery thermal management', 'thermal runaway', 'electric vehicles'],
    verifiedDaysAgo: 210, availability: 'limited',
    interests: [R('Currently at capacity until fall 2027 per department chair.', false)],
  }),

  // ---- Materials & environment -----------------------------------------
  fac({
    id: 'f-haddad', name: 'Omar Haddad', title: 'Professor', departmentId: 'd-chem', labSize: 11,
    summary: 'Synthesizes polymers that can be chemically recycled back to monomer, closing the loop for packaging plastics.',
    expertise: ['polymers', 'sustainable-materials', 'catalysis'],
    keywords: ['chemical recycling', 'circular economy', 'polyesters'],
    verifiedDaysAgo: 75, nSources: 3, availability: 'open',
    interests: [R('Actively seeking licensees and sponsors.')],
  }),
  fac({
    id: 'f-novak', name: 'Petra Novak', title: 'Associate Professor', departmentId: 'd-phys', labSize: 6,
    summary: 'Grows and characterizes atomically thin semiconductors for energy-efficient electronics and quantum devices.',
    expertise: ['2d-materials', 'semiconductors', 'materials-characterization'],
    keywords: ['graphene', 'TMDs', 'quantum materials'],
    verifiedDaysAgo: 300,
  }),
  fac({
    id: 'f-osei', name: 'Kwame Osei', title: 'Assistant Professor', departmentId: 'd-mse', labSize: 5,
    summary: 'Studies microstructure and qualification of additively manufactured metal parts for aerospace and energy applications.',
    expertise: ['additive-manufacturing', 'aerostructures', 'materials-characterization'],
    keywords: ['powder bed fusion', 'qualification', 'nickel superalloys'],
    verifiedDaysAgo: 45, interests: [R('Interested in qualification partnerships.')],
  }),
  fac({
    id: 'f-park', name: 'Ji-woo Park', title: 'Professor', departmentId: 'd-nuc', labSize: 8,
    summary: 'Develops radiation-tolerant ceramics and cladding materials for advanced reactors.',
    expertise: ['nuclear', 'ceramics', 'materials-characterization'],
    keywords: ['accident tolerant fuel', 'irradiation testing'],
    verifiedDaysAgo: 520, nSources: 1,
  }),
  fac({
    id: 'f-castillo', name: 'Diego Castillo', title: 'Associate Professor', departmentId: 'd-cee', labSize: 7,
    summary: 'Develops treatment processes that destroy PFAS and other persistent contaminants in drinking water.',
    expertise: ['environmental-remediation', 'soil-water', 'catalysis'],
    keywords: ['PFAS', 'water treatment', 'electrochemical oxidation'],
    verifiedDaysAgo: 30, availability: 'open',
    interests: [R('Seeking utility partners for pilot-scale testing.')],
  }),
  fac({
    id: 'f-ferreira', name: 'Ana Ferreira', title: 'Professor', departmentId: 'd-eme', labSize: 9,
    summary: 'Designs sorbents and processes for direct air capture and converts captured CO₂ into useful products.',
    expertise: ['carbon-capture', 'catalysis', 'subsurface-energy'],
    keywords: ['direct air capture', 'sorbents', 'CO2 utilization', 'sustainable manufacturing'],
    verifiedDaysAgo: 58, interests: [R('Runs an industry testing program for sorbents.')],
  }),

  // ---- Computing & AI --------------------------------------------------
  fac({
    id: 'f-whitaker', name: 'Samuel Whitaker', title: 'Professor', departmentId: 'd-cse', labSize: 16,
    summary: 'Co-designs machine-learning algorithms and hardware so AI models run efficiently on edge devices and custom accelerators.',
    expertise: ['machine-learning', 'edge-computing', 'semiconductors', 'hpc'],
    keywords: ['edge AI', 'hardware accelerators', 'model compression'],
    verifiedDaysAgo: 20, nSources: 3, availability: 'open',
    interests: [R('Open to sponsored research.'), T('Runs an industry-affiliates student program.')],
  }),
  fac({
    id: 'f-iyer', name: 'Ananya Iyer', title: 'Associate Professor', departmentId: 'd-ist', labSize: 8,
    summary: 'Studies how to evaluate and govern large language models, including bias audits, red-teaming and human oversight of AI systems.',
    expertise: ['responsible-ai', 'nlp', 'hci'],
    keywords: ['LLM evaluation', 'AI governance', 'human oversight'],
    verifiedDaysAgo: 33, availability: 'open',
    interests: [R('Interested in evaluation partnerships with AI companies.'), T('Students available for summer research internships.')],
  }),
  fac({
    id: 'f-kowalski', name: 'Tomasz Kowalski', title: 'Assistant Professor', departmentId: 'd-cse', labSize: 6,
    summary: 'Builds perception systems that let robots understand cluttered, changing environments such as warehouses and farms.',
    expertise: ['computer-vision', 'industrial-automation', 'autonomy', 'machine-learning'],
    keywords: ['robot perception', '3D vision', 'object detection'],
    verifiedDaysAgo: 140,
  }),
  fac({
    id: 'f-adeyemi', name: 'Funmilayo Adeyemi', title: 'Professor', departmentId: 'd-ist', labSize: 10,
    summary: 'Researches privacy-preserving analytics and intrusion detection for critical infrastructure networks.',
    expertise: ['cybersecurity', 'networks', 'data-science'],
    keywords: ['privacy', 'intrusion detection', 'critical infrastructure'],
    verifiedDaysAgo: 95, interests: [E('Regular speaker at industry security forums.')],
  }),
  fac({
    id: 'f-greenberg', name: 'Rachel Greenberg', title: 'Professor', departmentId: 'd-stat', labSize: 7,
    summary: 'Develops statistical machine-learning methods for clinical trials and real-world health data.',
    expertise: ['data-science', 'machine-learning', 'digital-health'],
    keywords: ['clinical trials', 'causal inference', 'real-world evidence'],
    verifiedDaysAgo: 260, availability: 'unavailable',
    interests: [R('On sabbatical through summer 2027.', true)],
  }),
  fac({
    id: 'f-zhou', name: 'Lin Zhou', title: 'Associate Professor', departmentId: 'd-ee', labSize: 9,
    summary: 'Designs wireless systems that double as sensors, for 6G networks and industrial IoT.',
    expertise: ['networks', 'sensors', 'edge-computing'],
    keywords: ['6G', 'integrated sensing and communication', 'IoT'],
    verifiedDaysAgo: 110,
  }),
  fac({
    id: 'f-hollis', name: 'Grace Hollis', title: 'Assistant Professor', departmentId: 'd-scm', labSize: 3,
    summary: 'Uses optimization and machine learning to make freight and last-mile logistics networks more resilient.',
    expertise: ['supply-chain', 'optimization', 'data-science'],
    keywords: ['freight networks', 'resilience', 'last-mile'],
    verifiedDaysAgo: 70, interests: [R('Interested in data partnerships with shippers.')],
  }),
  fac({
    id: 'f-romero', name: 'Luis Romero', title: 'Professor', departmentId: 'd-ie', labSize: 12,
    summary: 'Designs human–robot collaborative work cells and digital twins for smart factories.',
    expertise: ['industrial-automation', 'advanced-manufacturing', 'optimization'],
    keywords: ['digital twin', 'collaborative robots', 'smart manufacturing'],
    verifiedDaysAgo: 160, interests: [T('Capstone design program sponsor-friendly.')],
  }),

  // ---- Health ----------------------------------------------------------
  fac({
    id: 'f-sato', name: 'Emi Sato', title: 'Associate Professor', departmentId: 'd-bme', labSize: 8,
    summary: 'Engineers lipid nanoparticles that deliver mRNA to specific tissues, aiming at vaccines and gene therapies with fewer side effects.',
    expertise: ['drug-delivery', 'nanomaterials', 'immunology'],
    keywords: ['lipid nanoparticles', 'mRNA delivery', 'targeted delivery'],
    verifiedDaysAgo: 52, nSources: 3, availability: 'open',
    interests: [R('Open to sponsored research and material transfer agreements.')],
  }),
  fac({
    id: 'f-abernathy', name: 'James Abernathy', title: 'Professor', departmentId: 'd-micro', labSize: 13,
    summary: 'Studies immune responses to respiratory viruses and evaluates next-generation vaccine candidates in preclinical models.',
    expertise: ['immunology', 'infectious-disease'],
    keywords: ['vaccines', 'respiratory viruses', 'preclinical models'],
    verifiedDaysAgo: 180,
  }),
  fac({
    id: 'f-nwosu', name: 'Chiamaka Nwosu', title: 'Assistant Professor', departmentId: 'd-bme', labSize: 4,
    summary: 'Builds soft, skin-mounted sensors and analytics for continuous remote patient monitoring.',
    expertise: ['digital-health', 'sensors', 'machine-learning'],
    keywords: ['wearables', 'remote monitoring', 'flexible electronics'],
    verifiedDaysAgo: 240, emailVerified: false, nSources: 1,
    coverageNotes: ['Joined 2025; directory lists only one project so far.'],
  }),
  fac({
    id: 'f-weiss', name: 'Daniel Weiss', title: 'Professor', departmentId: 'd-bme', labSize: 9,
    summary: 'Develops low-cost ultrasound imaging hardware and AI-assisted image interpretation.',
    expertise: ['medical-imaging', 'acoustics', 'computer-vision'],
    keywords: ['ultrasound', 'point-of-care imaging'],
    verifiedDaysAgo: 85, nSources: 3,
  }),
  fac({
    id: 'f-patel', name: 'Meera Patel', title: 'Associate Professor', departmentId: 'd-nutr', labSize: 5,
    summary: 'Studies how food formulation affects metabolic health, including controlled feeding studies.',
    expertise: ['nutrition', 'food-science', 'digital-health'],
    keywords: ['metabolism', 'feeding studies', 'dietary intervention'],
    verifiedDaysAgo: 130,
  }),

  // ---- Agriculture & food ---------------------------------------------
  fac({
    id: 'f-mccarthy', name: 'Sean McCarthy', title: 'Professor', departmentId: 'd-plant', labSize: 10,
    summary: 'Uses genomics to breed crops that tolerate heat and drought.',
    expertise: ['plant-science', 'genomics', 'climate'],
    keywords: ['crop resilience', 'drought tolerance', 'breeding'],
    verifiedDaysAgo: 200,
  }),
  fac({
    id: 'f-yilmaz', name: 'Deniz Yilmaz', title: 'Assistant Professor', departmentId: 'd-abe', labSize: 6,
    summary: 'Builds autonomous ground and aerial robots that scout fields for pests, disease and nutrient stress.',
    expertise: ['precision-agriculture', 'autonomy', 'sensors', 'computer-vision'],
    keywords: ['agricultural robotics', 'drones', 'crop scouting'],
    verifiedDaysAgo: 28, availability: 'open', interests: [R('Seeking field-trial partners.')],
  }),
  fac({
    id: 'f-dubois', name: 'Camille Dubois', title: 'Associate Professor', departmentId: 'd-food', labSize: 6,
    summary: 'Develops compostable and bio-based food packaging that extends shelf life.',
    expertise: ['food-science', 'sustainable-materials', 'polymers'],
    keywords: ['food packaging', 'shelf life', 'bio-based films'],
    verifiedDaysAgo: 60, interests: [R('Active industry sponsor portfolio.')],
  }),

  // ---- Climate, buildings, geo ----------------------------------------
  fac({
    id: 'f-larsen', name: 'Erik Larsen', title: 'Professor', departmentId: 'd-meteo', labSize: 8,
    summary: 'Turns weather and climate model output into risk forecasts for utilities, insurers and renewable operators.',
    expertise: ['climate', 'data-science', 'renewables', 'machine-learning'],
    keywords: ['climate risk', 'forecasting', 'extreme weather'],
    verifiedDaysAgo: 380, nSources: 1,
  }),
  fac({
    id: 'f-delgado', name: 'Rosa Delgado', title: 'Assistant Professor', departmentId: 'd-ae', labSize: 4,
    summary: 'Designs control systems that let buildings shift their energy use to support the grid.',
    expertise: ['smart-buildings', 'power-systems', 'sensors'],
    keywords: ['HVAC controls', 'grid-interactive buildings', 'demand response'],
    verifiedDaysAgo: 100, interests: [E('Organizes a building-energy seminar series.')],
  }),
  fac({
    id: 'f-hughes', name: 'Bradley Hughes', title: 'Professor', departmentId: 'd-geo', labSize: 7,
    summary: 'Maps and characterizes critical mineral deposits, including lithium brines and rare earths.',
    expertise: ['geosciences', 'subsurface-energy'],
    keywords: ['critical minerals', 'lithium brines', 'rare earth elements'],
    verifiedDaysAgo: 460, nSources: 1,
  }),

  // ---- Aerospace -------------------------------------------------------
  fac({
    id: 'f-volkova', name: 'Irina Volkova', title: 'Professor', departmentId: 'd-aero', labSize: 11,
    summary: 'Develops ceramic-matrix composites and thermal protection systems for hypersonic flight.',
    expertise: ['aerostructures', 'composites', 'ceramics'],
    keywords: ['hypersonic', 'thermal protection', 'ceramic matrix composites'],
    verifiedDaysAgo: 42, nSources: 3, availability: 'open',
    interests: [R('Long-standing aerospace sponsor relationships.')],
  }),
  fac({
    id: 'f-bennett', name: 'Owen Bennett', title: 'Associate Professor', departmentId: 'd-aero', labSize: 7,
    summary: 'Develops guidance and planning algorithms for teams of autonomous drones.',
    expertise: ['autonomy', 'aerostructures', 'machine-learning'],
    keywords: ['UAV swarms', 'path planning', 'drones'],
    verifiedDaysAgo: 115,
  }),

  // ---- Electronics & business -----------------------------------------
  fac({
    id: 'f-moreau', name: 'Julien Moreau', title: 'Professor', departmentId: 'd-ee', labSize: 12,
    summary: 'Designs silicon photonic chips for data-center interconnects and optical sensing.',
    expertise: ['photonics', 'semiconductors', 'sensors'],
    keywords: ['silicon photonics', 'optical interconnects', 'lidar'],
    verifiedDaysAgo: 140, nSources: 3, interests: [R('Directs a photonics industry consortium.')],
  }),
  fac({
    id: 'f-cho', name: 'Hana Cho', title: 'Associate Professor', departmentId: 'd-mse', labSize: 8,
    summary: 'Grows gallium nitride and silicon carbide materials for high-power and high-frequency devices.',
    expertise: ['semiconductors', 'materials-characterization', 'power-systems'],
    keywords: ['gallium nitride', 'wide bandgap', 'epitaxy'],
    verifiedDaysAgo: 80, interests: [T('Many students placed in semiconductor fabs.')],
  }),
  fac({
    id: 'f-shah', name: 'Nikhil Shah', title: 'Assistant Professor', departmentId: 'd-scm', labSize: 2,
    summary: 'Studies how university technologies become startups and what makes industry partnerships last.',
    expertise: ['entrepreneurship', 'supply-chain'],
    keywords: ['technology commercialization', 'university–industry partnerships'],
    verifiedDaysAgo: 55,
  }),
];
