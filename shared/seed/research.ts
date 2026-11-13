import type { IPRecord, Project, Publication } from '../types';
import { ago, src } from './util';

type PArgs = [id: string, title: string, facultyIds: string[], topics: string[], status: Project['status'], startDaysAgo: number | null, endDaysAgo: number | null, sponsor: string | null, description: string];

const P = (...[id, title, facultyIds, topics, status, s, e, sponsor, description]: PArgs): Project => ({
  id, title, facultyIds, topics, status, description,
  start: s === null ? undefined : ago(s),
  end: e === null ? undefined : ago(e),
  sponsor: sponsor ?? undefined,
  source: sponsor
    ? src('src-records', 'Sponsored projects records (demo snapshot)', 60)
    : src('src-directory', 'Lab website / faculty page (demo snapshot)', 90),
});

export const makeProjects = (): Project[] => [
  // Okafor
  P('p-okafor-1', 'Interfacial stability in sulfide solid electrolytes', ['f-okafor'], ['solid-state-batteries', 'electrochemistry', 'materials-characterization'], 'active', 420, null, 'DOE Office of Science', 'Uses in-situ electron microscopy to watch how sulfide electrolytes decompose against lithium metal, and tests interlayers that slow degradation.'),
  P('p-okafor-2', 'Scalable processing of garnet ceramic electrolytes', ['f-okafor', 'f-lindqvist'], ['solid-state-batteries', 'ceramics', 'advanced-manufacturing'], 'active', 200, null, 'Industry consortium (members not disclosed)', 'Develops lower-temperature sintering so ceramic electrolyte sheets can be made on roll-to-roll lines.'),
  P('p-okafor-3', 'Dendrite suppression in lithium-metal anodes', ['f-okafor'], ['battery-materials', 'electrochemistry'], 'completed', 1600, 500, 'NSF', 'Explored pressure and interlayer strategies to suppress lithium dendrites.'),
  // Lindqvist
  P('p-lind-1', 'Dry electrode manufacturing for lithium-ion cells', ['f-lindqvist'], ['battery-materials', 'advanced-manufacturing', 'sustainable-materials'], 'active', 380, null, 'DOE Vehicle Technologies Office', 'Removes toxic solvents and drying ovens from electrode production, cutting energy use.'),
  P('p-lind-2', 'Direct recycling of NMC cathode materials', ['f-lindqvist'], ['battery-materials', 'sustainable-materials', 'chemical-processes'], 'active', 150, null, null, 'Restores spent cathode particles without breaking them down to raw metals.'),
  P('p-lind-3', 'Electrode calendering study with Voltaic Ridge', ['f-lindqvist'], ['battery-materials', 'advanced-manufacturing'], 'completed', 1500, 1100, 'Voltaic Ridge Energy', 'A one-year sponsored study on calendering effects. Completed 2023.'),
  // Reyes (only one listed)
  P('p-reyes-1', 'Co-optimizing storage and solar siting for regional utilities', ['f-reyes'], ['energy-storage', 'renewables', 'power-systems'], 'active', 300, null, null, 'Techno-economic model for where to place batteries next to solar farms.'),
  // Chandra
  P('p-chandra-1', 'Machine-learned interatomic potentials for solid electrolytes', ['f-chandra'], ['computational-materials', 'machine-learning', 'solid-state-batteries'], 'active', 250, null, 'NSF DMREF', 'Trains ML potentials to simulate ion transport at electrolyte interfaces at scale.'),
  P('p-chandra-2', 'Phase-field models of cathode cracking', ['f-chandra'], ['computational-materials', 'battery-materials'], 'active', 500, null, 'Army Research Lab', 'Predicts how cathode particles fracture during fast charging.'),
  P('p-chandra-3', 'Open battery materials database', ['f-chandra'], ['data-science', 'battery-materials'], 'completed', 1300, 400, null, 'Public database of computed properties for 40,000 candidate materials.'),
  // Tanaka
  P('p-tanaka-1', 'Earth-abundant catalysts for PEM electrolyzers', ['f-tanaka'], ['fuel-cells', 'catalysis'], 'active', 280, null, 'DOE Hydrogen Program', 'Replaces iridium with abundant metals in oxygen-evolution catalysts.'),
  P('p-tanaka-2', 'Durability testing of fuel cell membranes', ['f-tanaka'], ['fuel-cells', 'electrochemistry'], 'completed', 1200, 300, null, 'Accelerated stress tests for membrane electrode assemblies.'),
  // Ndlovu
  P('p-ndlovu-1', 'Bidirectional SiC chargers for vehicle-to-grid', ['f-ndlovu'], ['power-systems', 'transportation', 'semiconductors'], 'active', 190, null, 'NSF CAREER', 'Compact chargers that let EVs feed power back to the grid.'),
  // Brennan
  P('p-brennan-1', 'Early detection of thermal runaway in large battery packs', ['f-brennan'], ['energy-storage', 'sensors', 'transportation'], 'active', 400, null, 'Industry sponsor (confidential)', 'Gas and strain sensors that warn minutes before a cell fails.'),
  P('p-brennan-2', 'Immersion cooling for fast-charging EV packs', ['f-brennan'], ['transportation', 'energy-storage'], 'completed', 1400, 600, null, 'Evaluated dielectric fluids for pack cooling.'),
  // Haddad
  P('p-haddad-1', 'Chemically recyclable polyesters for packaging', ['f-haddad'], ['polymers', 'sustainable-materials'], 'active', 600, null, 'NSF Center for Sustainable Polymers', 'Polyesters that depolymerize cleanly back to monomer.'),
  P('p-haddad-2', 'Catalysts for low-temperature depolymerization', ['f-haddad'], ['catalysis', 'polymers'], 'active', 220, null, null, 'Selective catalysts to recover monomers at lower energy.'),
  // Novak
  P('p-novak-1', 'Wafer-scale growth of 2D semiconductors', ['f-novak'], ['2d-materials', 'semiconductors'], 'active', 350, null, 'NSF', 'Uniform TMD films on 200 mm wafers.'),
  // Osei
  P('p-osei-1', 'Qualification of printed nickel superalloys', ['f-osei'], ['additive-manufacturing', 'aerostructures', 'materials-characterization'], 'active', 260, null, 'Air Force Research Lab', 'Links print parameters to fatigue life for flight hardware.'),
  // Park
  P('p-park-1', 'Radiation-tolerant ceramic cladding', ['f-park'], ['nuclear', 'ceramics'], 'completed', 2000, 700, 'DOE NEUP', 'Tested SiC cladding under irradiation.'),
  // Castillo
  P('p-castillo-1', 'Electrochemical destruction of PFAS in drinking water', ['f-castillo'], ['environmental-remediation', 'electrochemistry', 'soil-water'], 'active', 330, null, 'EPA', 'Electrode-based reactors that break carbon–fluorine bonds.'),
  P('p-castillo-2', 'PFAS occurrence survey in rural wells', ['f-castillo'], ['environmental-remediation', 'soil-water'], 'completed', 900, 200, 'State environmental agency', 'Sampling across 300 private wells.'),
  // Ferreira
  P('p-ferreira-1', 'Amine-functionalized sorbents for direct air capture', ['f-ferreira'], ['carbon-capture', 'sustainable-materials'], 'active', 410, null, 'DOE Carbon Management', 'Sorbents with lower regeneration energy.'),
  P('p-ferreira-2', 'Converting captured CO₂ to building materials', ['f-ferreira'], ['carbon-capture', 'catalysis', 'advanced-manufacturing'], 'active', 120, null, null, 'Mineralization routes for low-carbon concrete additives.'),
  // Whitaker
  P('p-whit-1', 'Sparse neural network accelerators for edge devices', ['f-whitaker'], ['machine-learning', 'edge-computing', 'semiconductors'], 'active', 300, null, 'DARPA', 'Hardware that skips zero-valued computations.'),
  P('p-whit-2', 'Compressing vision transformers for drones', ['f-whitaker', 'f-bennett'], ['machine-learning', 'computer-vision', 'autonomy'], 'active', 150, null, null, 'Shrinks perception models to fit on small aircraft.'),
  // Iyer
  P('p-iyer-1', 'Human-in-the-loop evaluation of language models', ['f-iyer'], ['nlp', 'responsible-ai', 'hci'], 'active', 280, null, 'NSF', 'Structured protocols for humans to audit LLM outputs.'),
  P('p-iyer-2', 'Bias audits of AI hiring tools', ['f-iyer'], ['responsible-ai', 'workforce'], 'completed', 1000, 300, null, 'Audit framework adopted by two state agencies.'),
  // Kowalski
  P('p-kow-1', 'Robot perception for mixed-SKU warehouses', ['f-kowalski'], ['computer-vision', 'industrial-automation'], 'active', 200, null, null, 'Picks unfamiliar objects from cluttered bins.'),
  // Adeyemi
  P('p-ade-1', 'Privacy-preserving anomaly detection for smart grids', ['f-adeyemi'], ['cybersecurity', 'power-systems', 'data-science'], 'active', 360, null, 'DOE CESER', 'Detects intrusions without exposing customer data.'),
  // Greenberg
  P('p-green-1', 'Adaptive designs for pragmatic clinical trials', ['f-greenberg'], ['data-science', 'digital-health'], 'active', 500, null, 'NIH', 'Bayesian methods that adapt trial arms over time.'),
  // Zhou
  P('p-zhou-1', 'Integrated sensing and communication for factories', ['f-zhou'], ['networks', 'sensors', 'industrial-automation'], 'active', 240, null, null, '6G signals that also track machine motion.'),
  // Hollis
  P('p-hollis-1', 'Resilient freight network design', ['f-hollis'], ['supply-chain', 'optimization'], 'active', 180, null, null, 'Optimization models that hedge against port disruption.'),
  // Romero
  P('p-rom-1', 'Digital twins for collaborative robot cells', ['f-romero'], ['industrial-automation', 'advanced-manufacturing'], 'active', 420, null, 'NIST', 'Live models of robot cells to plan safe human–robot work.'),
  P('p-rom-2', 'Industry capstone: line balancing with AI', ['f-romero'], ['optimization', 'advanced-manufacturing', 'workforce'], 'completed', 600, 250, 'Industry capstone sponsors', 'Student teams worked on sponsor production lines.'),
  // Sato
  P('p-sato-1', 'Tissue-targeted lipid nanoparticles for mRNA therapies', ['f-sato'], ['drug-delivery', 'nanomaterials'], 'active', 330, null, 'NIH NIBIB', 'Lipid libraries that steer mRNA to lung and spleen.'),
  P('p-sato-2', 'Thermostable mRNA vaccine formulations', ['f-sato', 'f-abernathy'], ['drug-delivery', 'immunology'], 'active', 160, null, null, 'Formulations stable at refrigerator temperature.'),
  // Abernathy
  P('p-aber-1', 'Mucosal immunity to respiratory viruses', ['f-abernathy'], ['immunology', 'infectious-disease'], 'active', 700, null, 'NIH NIAID', 'How nasal vaccines build local protection.'),
  // Nwosu (only one)
  P('p-nwosu-1', 'Skin-mounted sensors for heart-failure monitoring', ['f-nwosu'], ['digital-health', 'sensors'], 'active', 220, null, null, 'Continuous monitoring after hospital discharge.'),
  // Weiss
  P('p-weiss-1', 'Handheld ultrasound with AI guidance', ['f-weiss'], ['medical-imaging', 'computer-vision', 'acoustics'], 'active', 380, null, 'NIH', 'Guides non-experts to capture diagnostic images.'),
  // Patel
  P('p-patel-1', 'Controlled feeding study on ultra-processed foods', ['f-patel'], ['nutrition', 'food-science'], 'active', 260, null, 'USDA', 'Measures metabolic effects of processing level.'),
  // McCarthy
  P('p-mcc-1', 'Genomic selection for heat-tolerant wheat', ['f-mccarthy'], ['plant-science', 'genomics', 'climate'], 'active', 700, null, 'USDA NIFA', 'Breeding pipeline for hotter summers.'),
  // Yilmaz
  P('p-yil-1', 'Autonomous scouting for specialty crops', ['f-yilmaz'], ['precision-agriculture', 'autonomy', 'computer-vision'], 'active', 300, null, 'USDA', 'Ground robots that map disease in orchards.'),
  P('p-yil-2', 'Drone-based nitrogen stress mapping', ['f-yilmaz', 'f-bennett'], ['precision-agriculture', 'autonomy', 'sensors'], 'active', 90, null, null, 'Multispectral drone flights for row crops.'),
  // Dubois
  P('p-dub-1', 'Compostable barrier films for fresh produce', ['f-dubois'], ['food-science', 'sustainable-materials', 'polymers'], 'active', 240, null, 'Fairmount Foods', 'Bio-based films that match plastic shelf life.'),
  // Larsen
  P('p-lars-1', 'Extreme weather risk forecasts for grid assets', ['f-larsen'], ['climate', 'power-systems', 'data-science'], 'completed', 1100, 420, null, 'Probabilistic outage risk from storm forecasts.'),
  // Delgado
  P('p-del-1', 'Grid-interactive campus buildings', ['f-delgado'], ['smart-buildings', 'power-systems'], 'active', 210, null, 'DOE Building Technologies Office', 'Shifts HVAC load to support grid peaks.'),
  // Hughes
  P('p-hug-1', 'Lithium resources in Appalachian brines', ['f-hughes'], ['geosciences', 'battery-materials'], 'active', 540, null, 'USGS', 'Assesses lithium concentrations in produced waters.'),
  // Volkova
  P('p-volk-1', 'Ceramic matrix composites for hypersonic leading edges', ['f-volkova'], ['aerostructures', 'composites', 'ceramics'], 'active', 450, null, 'Office of Naval Research', 'Materials that survive 2,000 °C flight.'),
  P('p-volk-2', 'Additively manufactured thermal protection tiles', ['f-volkova', 'f-osei'], ['aerostructures', 'additive-manufacturing', 'ceramics'], 'active', 130, null, null, 'Printed ceramic tiles with internal cooling.'),
  // Bennett
  P('p-ben-1', 'Coordinated planning for drone swarms', ['f-bennett'], ['autonomy', 'machine-learning'], 'active', 330, null, 'NASA', 'Decentralized planning for 50+ drones.'),
  // Moreau
  P('p-mor-1', 'Silicon photonic interconnects for AI data centers', ['f-moreau'], ['photonics', 'semiconductors'], 'active', 300, null, 'Photonics industry consortium', 'Low-power optical links between accelerators.'),
  // Cho
  P('p-cho-1', 'Defect reduction in GaN power devices', ['f-cho'], ['semiconductors', 'power-systems', 'materials-characterization'], 'active', 260, null, 'NSF', 'Epitaxy methods that cut killer defects.'),
  // Shah
  P('p-shah-1', 'What makes university–industry partnerships last?', ['f-shah'], ['entrepreneurship'], 'active', 180, null, null, 'Interview study of 60 sponsored research relationships.'),
];

type PubArgs = [id: string, title: string, venue: string, year: number, facultyIds: string[], topics: string[]];
const Pub = (...[id, title, venue, year, facultyIds, topics]: PubArgs): Publication => ({
  id, title, venue, year, facultyIds, topics,
  doi: `10.0000/demo.${id}`,
  source: src('src-pubs', 'Publication index (demo snapshot)', 40),
});

export const makePublications = (): Publication[] => [
  Pub('pub-1', 'Interphase formation between Li₆PS₅Cl and lithium metal observed in situ', 'Nature Energy', 2025, ['f-okafor'], ['solid-state-batteries', 'electrochemistry']),
  Pub('pub-2', 'Low-temperature densification of garnet electrolytes', 'J. Electrochemical Society', 2024, ['f-okafor', 'f-lindqvist'], ['solid-state-batteries', 'ceramics']),
  Pub('pub-3', 'Stack pressure and dendrite growth in solid-state cells', 'ACS Energy Letters', 2022, ['f-okafor'], ['solid-state-batteries']),
  Pub('pub-4', 'Energy accounting of dry versus wet electrode processing', 'Joule', 2025, ['f-lindqvist'], ['battery-materials', 'advanced-manufacturing', 'sustainable-materials']),
  Pub('pub-5', 'Direct regeneration of degraded NMC cathodes', 'Green Chemistry', 2024, ['f-lindqvist'], ['battery-materials', 'sustainable-materials']),
  Pub('pub-6', 'Siting co-located solar and storage under uncertainty', 'Applied Energy', 2024, ['f-reyes'], ['energy-storage', 'renewables']),
  Pub('pub-7', 'Valuing long-duration storage in capacity markets', 'Energy Policy', 2025, ['f-reyes'], ['energy-storage', 'power-systems']),
  Pub('pub-8', 'Machine-learned potentials for ion transport in sulfide electrolytes', 'npj Computational Materials', 2025, ['f-chandra'], ['computational-materials', 'solid-state-batteries', 'machine-learning']),
  Pub('pub-9', 'Fracture of cathode secondary particles during fast charge', 'Acta Materialia', 2023, ['f-chandra'], ['computational-materials', 'battery-materials']),
  Pub('pub-10', 'Iridium-free oxygen evolution catalysts', 'Nature Catalysis', 2025, ['f-tanaka'], ['catalysis', 'fuel-cells']),
  Pub('pub-11', 'Vehicle-to-grid charger topologies using SiC', 'IEEE Trans. Power Electronics', 2025, ['f-ndlovu'], ['power-systems', 'transportation']),
  Pub('pub-12', 'Gas sensing for early thermal runaway warning', 'J. Power Sources', 2024, ['f-brennan'], ['energy-storage', 'sensors']),
  Pub('pub-13', 'Closed-loop recyclable polyesters', 'Science', 2024, ['f-haddad'], ['polymers', 'sustainable-materials']),
  Pub('pub-14', 'Wafer-scale MoS₂ transistors', 'Nano Letters', 2023, ['f-novak'], ['2d-materials', 'semiconductors']),
  Pub('pub-15', 'Fatigue of laser powder bed fusion IN718', 'Additive Manufacturing', 2025, ['f-osei'], ['additive-manufacturing', 'aerostructures']),
  Pub('pub-16', 'Electrochemical oxidation of PFAS at boron-doped diamond', 'Env. Sci. & Tech.', 2025, ['f-castillo'], ['environmental-remediation', 'electrochemistry']),
  Pub('pub-17', 'Low-energy regeneration of DAC sorbents', 'Energy & Env. Science', 2024, ['f-ferreira'], ['carbon-capture']),
  Pub('pub-18', 'Sparse accelerators for transformer inference', 'ISCA', 2025, ['f-whitaker'], ['machine-learning', 'edge-computing', 'semiconductors']),
  Pub('pub-19', 'Human oversight protocols for LLM evaluation', 'FAccT', 2025, ['f-iyer'], ['responsible-ai', 'nlp']),
  Pub('pub-20', 'Auditing automated hiring systems', 'CHI', 2023, ['f-iyer'], ['responsible-ai', 'hci']),
  Pub('pub-21', 'Grasp detection in clutter', 'ICRA', 2024, ['f-kowalski'], ['computer-vision', 'industrial-automation']),
  Pub('pub-22', 'Federated intrusion detection for utilities', 'IEEE S&P Workshops', 2024, ['f-adeyemi'], ['cybersecurity', 'power-systems']),
  Pub('pub-23', 'Bayesian adaptive pragmatic trials', 'Biometrics', 2023, ['f-greenberg'], ['data-science', 'digital-health']),
  Pub('pub-24', 'Joint sensing and communication in industrial 6G', 'IEEE JSAC', 2025, ['f-zhou'], ['networks', 'sensors']),
  Pub('pub-25', 'Port disruption and freight network resilience', 'Transportation Science', 2025, ['f-hollis'], ['supply-chain', 'optimization']),
  Pub('pub-26', 'Digital twins for human–robot collaboration', 'J. Manufacturing Systems', 2024, ['f-romero'], ['industrial-automation', 'advanced-manufacturing']),
  Pub('pub-27', 'Ionizable lipids that target the spleen', 'Nature Biomedical Eng.', 2025, ['f-sato'], ['drug-delivery', 'nanomaterials']),
  Pub('pub-28', 'Refrigerator-stable mRNA–LNP formulations', 'J. Controlled Release', 2024, ['f-sato', 'f-abernathy'], ['drug-delivery', 'immunology']),
  Pub('pub-29', 'Nasal vaccination and tissue-resident memory', 'Immunity', 2024, ['f-abernathy'], ['immunology', 'infectious-disease']),
  Pub('pub-30', 'Point-of-care ultrasound guidance with deep learning', 'IEEE TMI', 2025, ['f-weiss'], ['medical-imaging', 'computer-vision']),
  Pub('pub-31', 'Food processing level and energy intake', 'Am. J. Clinical Nutrition', 2025, ['f-patel'], ['nutrition', 'food-science']),
  Pub('pub-32', 'Genomic prediction of heat tolerance in wheat', 'Plant Cell', 2024, ['f-mccarthy'], ['plant-science', 'genomics']),
  Pub('pub-33', 'Orchard disease mapping with ground robots', 'Computers & Electronics in Agriculture', 2025, ['f-yilmaz'], ['precision-agriculture', 'computer-vision']),
  Pub('pub-34', 'Bio-based barrier films for produce', 'Food Packaging & Shelf Life', 2025, ['f-dubois'], ['food-science', 'sustainable-materials']),
  Pub('pub-35', 'Probabilistic outage forecasting from storm ensembles', 'Weather & Forecasting', 2022, ['f-larsen'], ['climate', 'power-systems']),
  Pub('pub-36', 'Demand flexibility of campus HVAC', 'Energy & Buildings', 2025, ['f-delgado'], ['smart-buildings', 'power-systems']),
  Pub('pub-37', 'Lithium in Appalachian produced waters', 'Economic Geology', 2023, ['f-hughes'], ['geosciences', 'battery-materials']),
  Pub('pub-38', 'Oxidation of UHTC composites at 2,000 °C', 'J. American Ceramic Society', 2025, ['f-volkova'], ['ceramics', 'aerostructures']),
  Pub('pub-39', 'Decentralized planning for drone swarms', 'IEEE T-RO', 2024, ['f-bennett'], ['autonomy']),
  Pub('pub-40', 'Microring modulators for AI interconnects', 'Optica', 2025, ['f-moreau'], ['photonics', 'semiconductors']),
  Pub('pub-41', 'Threading dislocations in GaN-on-GaN', 'Applied Physics Letters', 2024, ['f-cho'], ['semiconductors']),
  Pub('pub-42', 'Longevity of university–industry research ties', 'Research Policy', 2025, ['f-shah'], ['entrepreneurship']),
  Pub('pub-43', 'Wearable sensing after heart-failure discharge', 'npj Digital Medicine', 2025, ['f-nwosu'], ['digital-health', 'sensors']),
  Pub('pub-44', 'Grid storage and wind curtailment', 'IEEE Trans. Sustainable Energy', 2023, ['f-reyes'], ['energy-storage', 'renewables']),
];

type IPArgs = Omit<IPRecord, 'source' | 'filed' | 'linkedInterestIds'> & { filedDaysAgo?: number; linkedInterestIds?: string[] };
const IP = (x: IPArgs): IPRecord => ({
  ...x,
  filed: x.filedDaysAgo === undefined ? undefined : ago(x.filedDaysAgo),
  linkedInterestIds: x.linkedInterestIds ?? [],
  source: x.verified
    ? src('src-ott', 'OTT technology portfolio (demo snapshot)', 50)
    : src('src-directory', 'Mentioned on lab website — not verified with OTT', 120),
});

export const makeIP = (): IPRecord[] => [
  IP({ id: 'ip-1', title: 'Low-temperature sintering of garnet solid electrolytes', reference: 'DEMO-2024-0113', status: 'patent-pending', licensing: 'available', facultyIds: ['f-okafor'], summary: 'Densifies garnet electrolytes at roughly 300 °C lower temperature, enabling co-firing with cathodes.', applications: ['Solid-state battery cells', 'Ceramic membranes'], topics: ['solid-state-batteries', 'ceramics'], filedDaysAgo: 520, verified: true, linkedInterestIds: ['ci-voltaic-1'] }),
  IP({ id: 'ip-2', title: 'Solvent-free electrode coating process', reference: 'DEMO-US-11,0xx,xxx', status: 'issued', licensing: 'licensed', facultyIds: ['f-lindqvist'], summary: 'Dry powder coating of battery electrodes without NMP solvent.', applications: ['Li-ion cell manufacturing'], topics: ['battery-materials', 'advanced-manufacturing'], filedDaysAgo: 1400, verified: true }),
  IP({ id: 'ip-3', title: 'Cathode particle regeneration method', status: 'disclosure', licensing: 'unknown', facultyIds: ['f-lindqvist'], summary: 'Relithiation method restoring capacity of spent cathode powders.', applications: ['Battery recycling'], topics: ['battery-materials', 'sustainable-materials'], filedDaysAgo: 120, verified: true }),
  IP({ id: 'ip-4', title: 'Chemically recyclable polyester family', reference: 'DEMO-2023-0457', status: 'issued', licensing: 'available', facultyIds: ['f-haddad'], summary: 'Polyesters that return to monomer with >95% yield.', applications: ['Packaging', 'Fibers'], topics: ['polymers', 'sustainable-materials'], filedDaysAgo: 900, verified: true, linkedInterestIds: ['ci-ridgeway-1'] }),
  IP({ id: 'ip-5', title: 'Ionizable lipid library for tissue-targeted mRNA delivery', reference: 'DEMO-2025-0032', status: 'provisional', licensing: 'unknown', facultyIds: ['f-sato'], summary: 'A family of lipids that steer nanoparticles to the spleen and lungs.', applications: ['mRNA therapeutics', 'Vaccines'], topics: ['drug-delivery', 'nanomaterials'], filedDaysAgo: 210, verified: true, linkedInterestIds: ['ci-meridian-2'] }),
  IP({ id: 'ip-6', title: 'AI-guided handheld ultrasound acquisition', reference: 'DEMO-US-11,4xx,xxx', status: 'issued', licensing: 'available', facultyIds: ['f-weiss'], summary: 'Real-time guidance that helps novices capture diagnostic views.', applications: ['Point-of-care imaging', 'Telehealth'], topics: ['medical-imaging', 'computer-vision'], filedDaysAgo: 1100, verified: true }),
  IP({ id: 'ip-7', title: 'Sparse tensor accelerator architecture', reference: 'DEMO-2024-0280', status: 'patent-pending', licensing: 'optioned', facultyIds: ['f-whitaker'], summary: 'Accelerator that skips zero-valued operations in neural networks.', applications: ['Edge AI chips'], topics: ['machine-learning', 'edge-computing', 'semiconductors'], filedDaysAgo: 400, verified: true }),
  IP({ id: 'ip-8', title: 'Boron-doped diamond reactor for PFAS destruction', status: 'patent-pending', licensing: 'available', facultyIds: ['f-castillo'], summary: 'Flow-through electrochemical reactor for PFAS-laden water.', applications: ['Drinking water treatment', 'Industrial wastewater'], topics: ['environmental-remediation', 'electrochemistry'], filedDaysAgo: 300, verified: true }),
  IP({ id: 'ip-9', title: 'Low-regeneration-energy DAC sorbent', status: 'disclosure', licensing: 'unknown', facultyIds: ['f-ferreira'], summary: 'Sorbent releasing CO₂ at 80 °C.', applications: ['Direct air capture'], topics: ['carbon-capture'], filedDaysAgo: 90, verified: false }),
  IP({ id: 'ip-10', title: 'Printed ceramic tiles with internal cooling channels', status: 'provisional', licensing: 'unknown', facultyIds: ['f-volkova', 'f-osei'], summary: 'Additively manufactured thermal protection with transpiration cooling.', applications: ['Hypersonic vehicles', 'Re-entry systems'], topics: ['aerostructures', 'additive-manufacturing', 'ceramics'], filedDaysAgo: 60, verified: true }),
  IP({ id: 'ip-11', title: 'Microring modulator with thermal stabilization', reference: 'DEMO-US-11,2xx,xxx', status: 'issued', licensing: 'licensed', facultyIds: ['f-moreau'], summary: 'Keeps optical modulators on-wavelength without heaters.', applications: ['Data-center optics'], topics: ['photonics', 'semiconductors'], filedDaysAgo: 1300, verified: true }),
  IP({ id: 'ip-12', title: 'Compostable multilayer produce film', status: 'unknown', licensing: 'unknown', facultyIds: ['f-dubois'], summary: 'Mentioned in a press release; status not confirmed with OTT.', applications: ['Food packaging'], topics: ['food-science', 'sustainable-materials'], verified: false }),
  IP({ id: 'ip-13', title: 'Gas-based thermal runaway early warning', status: 'patent-pending', licensing: 'available', facultyIds: ['f-brennan'], summary: 'Sensor fusion detects electrolyte venting before thermal runaway.', applications: ['EV battery packs', 'Grid storage'], topics: ['energy-storage', 'sensors'], filedDaysAgo: 250, verified: true }),
  IP({ id: 'ip-14', title: 'Drone-based nitrogen stress index', status: 'disclosure', licensing: 'unknown', facultyIds: ['f-yilmaz'], summary: 'Spectral index computed from low-cost drone cameras.', applications: ['Precision fertilization'], topics: ['precision-agriculture', 'sensors'], filedDaysAgo: 45, verified: true }),
];
