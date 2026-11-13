import type { SourceRef } from '../types';

/** Seed dates are relative to the moment the database is seeded. */
let NOW = Date.now();
export function setSeedNow(d: Date) { NOW = d.getTime(); }
export const ago = (days: number, hours = 0) => new Date(NOW - days * 86_400_000 - hours * 3_600_000).toISOString();
export const ahead = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

export const src = (sourceId: string, label: string, daysAgo: number, url?: string): SourceRef => ({
  sourceId, label, url, retrievedAt: ago(daysAgo),
});
