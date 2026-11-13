# Testing

```bash
npm test              # all unit tests (vitest)
npm run test:watch
npm run typecheck
npm run matcher:check # contract check for the default matcher (or --provider=…)
npm run check         # all of the above. Run this in CI
```

## What's covered

| File | Covers |
|---|---|
| `shared/matching/baseline.test.ts` | Concept extraction, rankings, determinism, score = f(components), eligibility without patents, quality vs. confidence for sparse records, hard constraints, availability penalty, licensing fit, ranking explanations |
| `shared/rules.test.ts` | Stage guards (intro gating, recorded-as-sent, type-specific workflows, outcome/close requirements, backward moves), review decisions (checklist, comments, no bulk outreach approvals, viewer restrictions), draft rules |
| `shared/platform.test.ts` | Every demo and live seed record passes its schema; role permissions; the baseline satisfies the matcher contract; the contract catches invented researchers and bad ordering; label building and metric bounds in evaluation |
| `server/validate.test.ts` | Server enforcement: stage jumps, approval + move in one transaction, staff can't approve, unapproved drafts, viewer and admin-only writes, schema errors, unknown-field stripping, unauthenticated writes |
| `server/ingest.test.ts` | Sync engine: creation with department resolution, unknown departments, same-source updates, cross-source conflicts (and no duplicates), protection of staff edits, faculty linking by ORCID/email/name, DOI dedupe and array merge, signals only for recent records, company name normalization, source registration, dry runs |

## Writing tests

- Test **pure functions** in `shared/` and `server/ingest.ts`/`validate.ts`. Build a database with `buildSeed(new Date(fixed))` or `buildLiveSeed()`, then apply ops with `applyLocalOps`.
- Always pin dates (`new Date('2026-10-19T12:00:00Z')`) so freshness-dependent results don't drift.
- When you change matching behavior on purpose, update the expectations in `baseline.test.ts` and explain why in the commit message.

## Suggested CI (GitHub Actions)

```yaml
name: check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run check
      - run: npm run build
```
