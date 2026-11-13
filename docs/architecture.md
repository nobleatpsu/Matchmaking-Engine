# Architecture

## One picture

```
             Browser (React SPA)                                  Scripts / scrapers / pipelines
   ┌────────────────────────────────────────┐                ┌──────────────────────────────────┐
   │ pages/      screens                     │                │ curl / Python / Node              │
   │ lib/store   in-memory copy of workspace │                │   Authorization: Bearer <key>     │
   │ lib/actions domain operations → ops[]   │                └───────────────┬──────────────────┘
   └──────────────┬─────────────────────────┘                                │
                  │ GET state · POST tx · POST match                         │ POST ingest
                  ▼                                                          ▼
   ┌──────────────────────────────────── server/api.ts ───────────────────────────────────────────┐
   │  /api/w/{live|demo}/…   auth.ts (who?) → validate.ts (allowed? well-formed? follows rules?)    │
   │                                                                                               │
   │  matchers/          ingest.ts (sync engine)          data-providers/          db.ts           │
   │  baseline · http ·  match · merge · provenance ·     openalex · json-files ·  SQLite per      │
   │  your provider      conflicts · signals              your provider            workspace +     │
   │                                                                               audit + keys    │
   └───────────────────────────────────────────────────────────────────────────────────────────────┘
                  ▲
                  │ imported by both sides
   ┌──────────────┴──────────────────────────── shared/ ───────────────────────────────────────────┐
   │ types.ts · schemas.ts (zod) · roles.ts · rules.ts (workflow) · ingest.ts (contract) ·          │
   │ taxonomy.ts · matching/ (baseline, contract, eval, requests) · seed/ (demo + reference data)   │
   └───────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Layers

### `shared/`: the domain, used by client and server
Pure TypeScript with no I/O. Everything with a rule in it lives here so the UI and the server can't disagree.

| File | Responsibility |
|---|---|
| `types.ts` | Domain model: every record type and the `Database` shape |
| `schemas.ts` | Runtime validation for every collection (zod). The server rejects anything invalid |
| `roles.ts` | Roles and the permission matrix |
| `rules.ts` | Opportunity stage workflows, transition guards, review and draft rules |
| `ingest.ts` | The ingestion contract (`IngestBatch`, `IngestFaculty`, …) |
| `taxonomy.ts` | Research concept taxonomy and text→concept extraction |
| `matching/` | Matcher interface, baseline matcher, response contract, evaluation, request builders |
| `seed/` | Fictional demo dataset; reference data (departments, sources) for a new live workspace |
| `brand.ts` | Product name and institution strings |

### `server/`: HTTP, persistence, integrations
| Path | Responsibility |
|---|---|
| `api.ts` | Every HTTP route ([api.md](api.md)) |
| `auth.ts` | Identifies the caller: SSO header, development user, demo persona or API key |
| `validate.ts` | Permission → schema → workflow checks for every write |
| `db.ts` | SQLite files, transactions, audit log, API keys, backups |
| `migrations.ts` | JSON-document migrations for the live workspace |
| `ingest.ts` | Sync engine: matching, merge, provenance, conflicts, signals |
| `matchers/` | Matcher registry, HTTP adapter, template |
| `data-providers/` | Data provider registry, OpenAlex, JSON files |
| `cli/` | Command-line tools |
| `standalone.ts` | Production server (static files + API, security headers) |
| `vite-plugin.ts` | Mounts the API inside the dev server |

### `src/`: the React app
See [frontend.md](frontend.md).

## How a change flows

1. A user acts, e.g. *Approve for introduction*.
2. `src/lib/actions.ts` builds **ops** — `[{op:'put', collection:'reviews', record}, {op:'put', collection:'activities', …}]` — and checks the shared rules locally for instant feedback.
3. `store.commit(ops)` applies them optimistically, then `POST /api/w/{ws}/tx`.
4. The server identifies the user, then `validate.ts`:
   - **permission:** may this role write this collection? (`roles.ts`)
   - **schema:** is every record well-formed? Unknown fields are stripped (`schemas.ts`)
   - **workflow:** does it respect stage and review rules, looking at the whole transaction? (`rules.ts`)
5. `db.applyOps` writes everything in **one SQLite transaction** and appends one **audit** entry.
6. If anything fails, the client rolls back and shows the server's message.

Ingestion follows the same idea through a different door. `POST ingest` → `ingest.planIngest` turns loose records into validated ops (with conflict issues and signals) → `applyOps`.

## Design principles

- **One rulebook.** Workflow rules live in `shared/` and run on both sides. The server is the authority.
- **Documents now, tables later.** Records are JSON documents keyed by `(collection, id)`. The shapes use ids and small arrays, so moving to PostgreSQL tables is mechanical ([deployment.md](deployment.md#postgresql)).
- **Replaceable parts behind narrow contracts.** Matchers implement `MatchProvider`. Data sources implement `DataProvider` or speak `IngestBatch`. Identity comes from `auth.ts`. Each can be swapped without touching the UI.
- **Provenance everywhere.** `sources[]`/`source` on records, `provenance` per field, `audit` per write.
- **Nothing outbound.** The only outbound calls are to matchers and data providers that *you* configure. No messaging code exists.
