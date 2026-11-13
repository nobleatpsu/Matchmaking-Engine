import type { Database } from '../types';
import { makeCompanies, makeInterests, makeRelationships } from './companies';
import { departments, makeFaculty, users } from './people';
import { makeIP, makeProjects, makePublications } from './research';
import { setSeedNow } from './util';
import {
  makeActivities, makeDrafts, makeFeedback, makeIssues, makeNotifications, makeOpportunities, makeReviews,
  makeShortlists, makeSignals, makeSources, makeTasks,
} from './workflow';

const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x])) as Record<string, T>;

/** Build the full demo database. Dates are relative to `now`. */
export function buildSeed(now = new Date()): Database {
  setSeedNow(now);
  return {
    users: byId(users),
    departments: byId(departments),
    faculty: byId(makeFaculty()),
    companies: byId(makeCompanies()),
    interests: byId(makeInterests()),
    relationships: byId(makeRelationships()),
    projects: byId(makeProjects()),
    publications: byId(makePublications()),
    ip: byId(makeIP()),
    searches: {},
    opportunities: byId(makeOpportunities()),
    reviews: byId(makeReviews()),
    drafts: byId(makeDrafts()),
    activities: byId(makeActivities()),
    tasks: byId(makeTasks()),
    signals: byId(makeSignals()),
    sources: byId(makeSources()),
    issues: byId(makeIssues()),
    imports: {},
    feedback: byId(makeFeedback()),
    shortlists: byId(makeShortlists()),
    notifications: byId(makeNotifications()),
  };
}
