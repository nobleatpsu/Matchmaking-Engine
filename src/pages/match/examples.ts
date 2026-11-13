import type { MatchRequest } from '@shared/types';

export const emptyRequest = (): MatchRequest => ({
  text: '', engagementType: 'research', topics: [], excludedTopics: [], disciplines: [], constraints: {},
});

export const EXAMPLES: { id: string; label: string; company: string; request: MatchRequest }[] = [
  {
    id: 'voltaic', label: 'Energy storage research', company: 'Voltaic Ridge Energy',
    request: {
      ...emptyRequest(),
      text: 'We are an energy company looking to collaborate with researchers working on solid-state batteries, energy storage, and sustainable manufacturing.',
      companyId: 'c-voltaic', interestId: 'ci-voltaic-1',
      outcome: 'A sponsored research project that de-risks solid-state cells for 8-hour stationary storage.',
      timeline: 'Start within 6 months', budget: 'Not yet known',
    },
  },
  {
    id: 'tessellate', label: 'AI evaluation research', company: 'Tessellate AI',
    request: { ...emptyRequest(), text: 'Sponsor research on evaluating large language models and keeping humans in the loop for responsible AI deployment.', companyId: 'c-tessellate' },
  },
  {
    id: 'corvane', label: 'Recruit GaN engineers', company: 'Corvane Semiconductor',
    request: { ...emptyRequest(), text: 'Recruit graduate students with experience in gallium nitride devices and power electronics.', engagementType: 'talent', companyId: 'c-corvane', interestId: 'ci-corvane-2' },
  },
  {
    id: 'clearwater', label: 'License PFAS technology', company: 'Clearwater Utilities',
    request: { ...emptyRequest(), text: 'License or pilot a technology that destroys PFAS in drinking water.', engagementType: 'licensing', companyId: 'c-clearwater', interestId: 'ci-clear-1' },
  },
  {
    id: 'arbor', label: 'Drone crop scouting', company: 'Arbor Fields AgTech',
    request: { ...emptyRequest(), text: 'Field trials for autonomous drones and robots that scout crops for disease and nutrient stress.', companyId: 'c-arbor', interestId: 'ci-arbor-1' },
  },
];
