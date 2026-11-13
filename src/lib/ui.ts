import { create } from 'zustand';
import type { Opportunity } from '@shared/types';
import type { MatchResult } from '@shared/matching/types';

export type OppPrefill = Partial<Opportunity> & { requestReviewFor?: string[]; reviewContext?: Record<string, MatchResult>; onCreated?: (id: string) => void };

interface UI {
  palette: boolean;
  newOpp: OppPrefill | null;
  newCompany: boolean;
  feedback: boolean;
  guide: boolean;
  setPalette: (v: boolean) => void;
  openNewOpp: (p?: OppPrefill) => void;
  closeNewOpp: () => void;
  setNewCompany: (v: boolean) => void;
  setFeedback: (v: boolean) => void;
  setGuide: (v: boolean) => void;
}

export const useUI = create<UI>((set) => ({
  palette: false,
  newOpp: null,
  newCompany: false,
  feedback: false,
  guide: false,
  setPalette: (palette) => set({ palette }),
  openNewOpp: (p = {}) => set({ newOpp: p }),
  closeNewOpp: () => set({ newOpp: null }),
  setNewCompany: (newCompany) => set({ newCompany }),
  setFeedback: (feedback) => set({ feedback }),
  setGuide: (guide) => set({ guide }),
}));
