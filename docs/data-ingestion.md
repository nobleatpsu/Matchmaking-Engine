# Data ingestion

There are four ways to get records in. All of them go through **one sync engine** (`server/ingest.ts`), so matching, merging, provenance and conflict rules are always the same.

| Way in | Best for | How |
|---|---|---|
| **Ingestion API** | Scrapers, scheduled scripts, other systems | `POST /api/w/live/ingest` with an API key |
| **CLI** | One-off loads, testing a batch | `npm run ingest -- --file=batch.json` |
| **Data provider** | A source the platform pulls from itself | Code in `server/data-providers/`, run with `npm run sync` |
| **CSV import** | Staff with spreadsheets | Data Health → CSV import (preview, then import) |

Staff can also add and edit records by hand. Those edits are marked `src-manual` and are protected (see [Conflicts](#conflicts-and-provenance)).

---

## The batch format

```jsonc
{
  "entity": "faculty",                       // departments | faculty | companies | interests | projects | publications | ip | signals
  "source": { "sourceId": "src-directory",   // which source this is (auto-registered if new)
              "label": "Engineering directory scrape", "url": "https://…" },
  "records": [ { … }, { … } ],                // up to INGEST_MAX_RECORDS (default 5000)
  "options": { "dryRun": false,               // true = report only, write nothing
               "emitSignals": true }          // default true except for src-import (CSV)
}
```

Types: `shared/ingest.ts`. Import them in TypeScript, or mirror them in Python.

### Record shapes (send what you know, omit the rest)

**faculty**: `name` required. For a *new* researcher, `department` is required (a department id or exact name; add `college` to create an unknown department).
```json
{ "name": "Ada Okafor", "title": "Associate Professor", "department": "Materials Science and Engineering",
  "email": "abc123@psu.edu", "externalIds": { "orcid": "0000-0002-…", "psu": "abc123" },
  "summary": "…", "keywords": ["solid electrolytes"], "expertise": ["solid-state-batteries"],
  "labName": "…", "labSize": 9, "availability": "open", "profileUrl": "https://…",
  "verifiedAt": "2026-10-01T00:00:00Z" }
```
`expertise` accepts taxonomy concept ids **or** labels/phrases ("Solid-state batteries", "machine learning"). If you omit it, it is derived from `summary` and `keywords`. Faculty created without `verifiedAt` get the coverage note *"Imported from … not yet verified"*.

**projects** / **publications** / **ip**: linked to faculty with `faculty: FacultyRef[]`.
```json
{ "title": "…", "description": "…", "faculty": [{ "email": "abc123@psu.edu" }],
  "topics": ["energy storage"], "start": "2026-01-15T00:00:00Z", "status": "active", "sponsor": "DOE",
  "externalIds": { "award": "DE-SC-…" }, "url": "https://…" }
```
```json
{ "title": "…", "year": 2026, "venue": "…", "doi": "10.1234/abc", "faculty": [{ "externalIds": { "orcid": "…" } }] }
```
```json
{ "title": "…", "reference": "PSU-2026-0042", "status": "patent-pending", "licensing": "available",
  "summary": "…", "applications": ["…"], "faculty": [{ "name": "Ada Okafor" }], "verified": true }
```
Only set `verified: true` on IP when the data comes from OTT.

**FacultyRef**: any of `id`, `externalIds`, `email`, `name`, tried in that order. `name` must match exactly one researcher.

**companies**: `name` required. Optional: `industry`, `website`, `hq`, `size`, `description`, `objectives[]`, `relationship`, `externalIds`.

**interests** (a company's distinct need): `company` (id or exact name), `pathway`, `title` required. Optional: `description`, `topics`, `status`.

**signals**: `kind`, `title` required. Optional: `detail`, `date`, `faculty[]`, `companies[{id|name}]`, `topics`, `suggestedAction`, `url`.

**departments**: `name`, `college`.

### The report

Every call returns an `IngestReport`:
```json
{ "entity": "faculty", "sourceId": "src-directory", "dryRun": false,
  "created": 12, "updated": 3, "unchanged": 40, "conflicts": 1, "errors": 2, "signals": 0,
  "results": [ { "index": 0, "status": "created", "id": "f-…", "name": "…" },
               { "index": 7, "status": "conflict", "id": "f-…", "conflicts": [{ "field": "title", "existing": "Associate Professor", "incoming": "Professor" }] },
               { "index": 9, "status": "error", "message": "Unknown department “Nope” — send `college` to create it" } ] }
```
Records with errors are skipped. The rest of the batch still applies, in one transaction. **Always dry-run a new scraper first.**

---

## How matching to existing records works

| Entity | Tried in order |
|---|---|
| faculty | `id` → any `externalIds` value → `email` → normalized name (+ department) |
| companies | `id` → `externalIds` → website domain → normalized name (*"ACME Corp."* = *"Acme"*) |
| projects | `id` → `externalIds` → same title + shared researcher |
| publications | `id` → `externalIds` → DOI (with or without `https://doi.org/`) → title |
| ip | `id` → `externalIds` → `reference` → title |
| interests | `id` → same company + title |

Send **stable external ids** whenever you have them. They make re-runs idempotent.

## Conflicts and provenance

For each field you send on an existing record:

| Situation | Result |
|---|---|
| Same value | nothing (`unchanged`) |
| Existing value is empty | set it, provenance → your source |
| Array field (`keywords`, `expertise`, `topics`, `facultyIds`, `applications`, `objectives`) | union of both |
| Different value, last set by **your** source | overwrite (`updated`) |
| Different value, set by **another source or a person** | **keep existing**, open a `conflict` DataIssue with both values (`conflict`) |

Staff resolve conflicts in **Data Health → Issues**. Picking a value writes it back and records which source won. Re-sending the same disagreement does not create duplicate issues.

Edits made in the UI set provenance to `src-manual`, so a scraper can never silently undo a correction a person made.

## Signals

When a sync **creates** a recent project (started within a year), a publication from this year or last, or any IP record, the engine also creates a `Signal` for staff to triage, unless `options.emitSignals` is `false`. CSV imports don't emit signals, and backfills of old records don't either.

---

## Using the API

1. An admin creates a key: **Admin → API keys** (or `npm run apikey -- --create --name="Directory scraper"`). The key is shown once. Keys act with the **staff** role.
2. Send batches:

```bash
curl -X POST https://partnerships.example.psu.edu/api/w/live/ingest \
  -H "Authorization: Bearer $PSRP_KEY" -H "Content-Type: application/json" \
  --data @faculty-batch.json
```

```python
import json, os, urllib.request
batch = {"entity": "publications", "source": {"sourceId": "src-scholar", "label": "Scholar scrape"},
         "records": [{"title": "…", "year": 2026, "faculty": [{"email": "abc123@psu.edu"}]}],
         "options": {"dryRun": True}}
req = urllib.request.Request("http://localhost:5180/api/w/live/ingest", data=json.dumps(batch).encode(),
      headers={"Authorization": f"Bearer {os.environ['PSRP_KEY']}", "Content-Type": "application/json"})
print(json.load(urllib.request.urlopen(req)))
```

Limits: `INGEST_MAX_RECORDS` per request (default 5000) and `MAX_BODY_BYTES` (default 10 MB). Split larger loads.

## Writing a data provider

Use a provider when the platform should *pull* from a source itself (and an admin can run it from **Admin → Data sync**).

```ts
// server/data-providers/my-directory.ts
import type { DataProvider } from './types';

export const myDirectory: DataProvider = {
  id: 'my-directory',
  name: 'Engineering faculty directory',
  description: 'Scrapes department pages listed in options.urls',
  sourceId: 'src-eng-directory',
  entities: ['faculty'],
  async pull({ db, since, options, log }) {
    const records = [];            // fetch + parse here (read-only against the source)
    log(`found ${records.length} people`);
    return [{ entity: 'faculty', source: { sourceId: 'src-eng-directory', label: 'Engineering directory' }, records }];
  },
};
```

Register it in `server/data-providers/index.ts`, then:

```bash
npm run sync -- --provider=my-directory --opt dryRun=1
npm run sync -- --provider=my-directory --workspace=live
```

Rules: providers **never write to the database directly**. Return batches and let the engine do the matching, merging and conflict handling. `pull` may also be an `async function*` that yields batches (for paging through big sources). `since` is the last successful run, so use it for incremental fetches.

### Built-in providers

| id | What it does |
|---|---|
| `openalex` | For faculty with `externalIds.orcid` or `externalIds.openalex`, fetches recent works from the public OpenAlex API as publications. Options: `since` (year, default 5 years back), `perAuthor` (default 25). Set `OPENALEX_MAILTO`. |
| `json-files` | Loads every `*.json` batch file in `IMPORT_DIR` (default `./imports`). `--opt move=1` moves processed files to `imports/done/`. The simplest bridge for scrapers that write files. |

### Scheduling

Use cron, a systemd timer or your CI scheduler:
```cron
0 3 * * *  cd /srv/psrp && npm run -s sync -- --provider=openalex --workspace=live >> logs/sync.log 2>&1
```
Exit code is `0` on success and `3` when some records errored.

## CSV import (staff)

Data Health → CSV import supports companies, faculty, projects, publications and IP. Columns are auto-mapped and can be adjusted. **Preview** runs the batch as a dry run and shows each row's outcome. **Import** runs it for real. Research rows link to faculty by email (preferred) or exact name, so import faculty first.

For the client's *OSVPR Industry Research Leads* workbook (~1,450 company names), export each sheet to CSV and import it as Companies.
