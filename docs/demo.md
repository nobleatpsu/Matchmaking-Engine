# Demo workspace

The demo workspace is a complete, connected, **fictional** dataset: 37 researchers across 8 colleges, 16 companies, about 55 projects, 44 publications, 14 IP records, 25 opportunities in every stage, reviews, drafts, signals, data issues and outcomes. It exists for training, stakeholder presentations and algorithm development.

Departments and colleges use real Penn State names. Every person, company, project, citation, DOI, URL and outcome is invented. The UI labels it *Demo workspace* everywhere.

## Personas (account menu)

| Persona | Role | Use to show |
|---|---|---|
| Jordan Ellis | reviewer · CEC engagement lead | Day-to-day work |
| Marcus Hale | admin · CEC associate director | Approving reviews, Admin |
| Leah Brandt | reviewer · OTT licensing | IP reviews |
| Dana Whitfield | reviewer · data steward | Data Health, verification |
| Sam Ortiz | staff | Someone who **can't** approve |
| Project Team | viewer | Read-only access |

## Presenting

1. Account menu → **Reset demo data**.
2. Account menu → **Presentation mode**. This hides setup controls and opens a **Demo script**: 13 steps, each with a *Go* link.
3. Core story: Command Center → Match Studio (energy-storage example) → explanation → profile → compare → shortlist → opportunity + review → switch to Marcus → approve → draft → record as sent → pipeline → analytics.

## Changing the demo data

The data lives in `shared/seed/*.ts`, with dates relative to the moment of seeding so it always looks current. After editing, run `npm test` (the schema test validates every seed record), then reset the demo workspace.
