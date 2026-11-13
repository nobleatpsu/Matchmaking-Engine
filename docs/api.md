# API reference

Base URL: the app's own origin (`http://localhost:5180` in development, `:4180` for `npm start`). All bodies are JSON. Errors look like `{ "error": "message", …extra }` with a meaningful status code.

## Authentication

| Caller | How |
|---|---|
| Browser, production | SSO proxy header (`AUTH_HEADER`), see [auth-and-roles.md](auth-and-roles.md) |
| Browser, development | `x-dev-user: <userId>` (live) or `x-demo-persona: <userId>` (demo), set by the app |
| Scripts | `Authorization: Bearer <api key>` |

`401` bodies include `reason`: `not-signed-in`, `not-provisioned` or `bootstrap`.

## Unscoped

| Method & path | Auth | Returns |
|---|---|---|
| `GET /api/health` | none | `{ ok, version, workspaces }` (for load balancers) |
| `GET /api/config` | none | `{ workspaces, authMode, version }` |

## Workspace-scoped: `/api/w/{workspace}/…`

`{workspace}` is `live` or `demo` (only those enabled by `WORKSPACES`).

| Method & path | Min role | Body → Response |
|---|---|---|
| `GET state` | viewer | → `{ db: Database, meta }`. The whole workspace, loaded once by the UI. `meta` includes `me`, `providers`, `dataProviders`, `schemaVersion` |
| `POST tx` | depends on collection | `{ ops: Op[] }` → `{ ok: true }`. Atomic write. Each op is `{op:'put', collection, record}` or `{op:'delete', collection, id}`, validated for permission, schema and workflow. Max 2000 ops |
| `POST match` | viewer | `{ request: MatchRequest, providerId? }` → `MatchResponse`. `502` with `violations` if a matcher breaks the contract |
| `GET providers` | viewer | → `{ providers, dataProviders }` |
| `POST ingest` | staff (user or API key) | `IngestBatch` → `IngestReport`. See [data-ingestion.md](data-ingestion.md) |
| `POST sync` | admin | `{ provider, options? }` → `{ reports, log }`. Runs a data provider |
| `POST eval` | staff | `{ providerId? }` → `EvalResult` |
| `GET export/corpus` | staff | → `MatchCorpus` |
| `GET export/labels` | staff | → `{ labels: LabeledQuery[] }` |
| `GET export/db` | admin | → whole workspace as JSON (attachment) |
| `GET audit?limit=&before=` | admin | → `{ entries }`, newest first |
| `GET apikeys` | admin | → `{ keys }` (hashes are never returned) |
| `POST apikeys` | admin | `{ name, role? }` → `{ id, key }`. The key is only returned here |
| `DELETE apikeys/{id}` | admin | → `{ ok }` |
| `POST reset` | any (demo only) | Re-seeds the demo workspace. `403` on live |
| `POST bootstrap` | none (live, dev auth, no users) | `{ name, email }` → creates the first admin |

## Examples

```bash
# Who am I / what's here (dev mode)
curl -s localhost:5180/api/w/live/state -H 'x-dev-user: u-abc' | jq '.meta'

# Run a match
curl -s -X POST localhost:5180/api/w/demo/match -H 'content-type: application/json' -d '{
  "request": { "text": "solid-state batteries for grid storage", "engagementType": "research",
               "topics": [], "disciplines": [], "constraints": {} } }' | jq '.results[] | {facultyId, score, summary}'

# Push data with a key
curl -s -X POST localhost:5180/api/w/live/ingest -H "authorization: Bearer $PSRP_KEY" \
  -H 'content-type: application/json' --data @examples/ingest/01-faculty.json
```

## Writing through `tx` from a script

Prefer `ingest` for data loads, because it handles matching, provenance and conflicts. `tx` is the low-level path the UI uses. If you use it, send complete records that pass `shared/schemas.ts`, and expect workflow rules to apply.

## Limits

`MAX_BODY_BYTES` (10 MB), `INGEST_MAX_RECORDS` (5000 per ingest call), 2000 ops per `tx`. The server sets `cache-control: no-store` on API responses.
