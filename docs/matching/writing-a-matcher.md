# Writing a matcher

Two options. Both end up behind the same interface, so the UI, review flow and evaluation work unchanged.

| | In-process (TypeScript) | HTTP service (any language) |
|---|---|---|
| Best for | Tweaks to the baseline, lightweight models | Python / ML stacks, GPUs, separate deploys |
| Lives in | `server/matchers/your-matcher.ts` | Anywhere reachable from the server |
| Register | Add to `LOCAL` in `server/matchers/index.ts` | `MATCHERS_HTTP="yourid=http://host:port/match"` |

## Option A: TypeScript

```bash
cp server/matchers/_template.ts server/matchers/embedding.ts
```

```ts
// server/matchers/embedding.ts
import type { MatchProvider } from '../../shared/matching/types';
import { requestConcepts, runBaseline, bandFor } from '../../shared/matching/baseline';

export const embeddingMatcher: MatchProvider = {
  id: 'embedding',
  name: 'Embedding matcher',
  version: '0.1.0',
  description: 'Topic relevance from sentence embeddings; everything else from the baseline.',
  async match(request, corpus, opts) {
    const base = runBaseline(request, corpus, opts?.now);   // reuse explanations, confidence, unknowns
    // …compute your own scores, then re-rank:
    const results = base.results
      .map((r) => ({ ...r, score: /* your score */ r.score }))
      .map((r) => ({ ...r, band: bandFor(r.score) }))
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    return { ...base, providerId: 'embedding', providerVersion: '0.1.0', method: 'Embedding cosine similarity for topic relevance', results };
  },
};
```

Register it:
```ts
// server/matchers/index.ts
import { embeddingMatcher } from './embedding';
const LOCAL: MatchProvider[] = [baselineProvider, embeddingMatcher];
```

It now appears in Match Studio's matcher picker and in Admin → Matchers & evaluation.

## Option B: HTTP service (Python example included)

The platform sends:
```http
POST /match
Content-Type: application/json
Authorization: Bearer <MATCHER_TOKEN>        (only if MATCHER_TOKEN is set)

{ "request": MatchRequest, "corpus": MatchCorpus }
```
and expects `200` with a `MatchResponse`. Field reference: [contract.md](contract.md).

A complete, dependency-free example lives at `examples/python-matcher/server.py`:

```bash
python3 examples/python-matcher/server.py                       # serves :8000/match
MATCHERS_HTTP="python=http://localhost:8000/match" npm run dev  # register it
MATCHERS_HTTP="python=http://localhost:8000/match" npm run matcher:check -- --provider=python
MATCHERS_HTTP="python=http://localhost:8000/match" npm run eval -- --provider=baseline --provider2=python
```

Several services: `MATCHERS_HTTP="ian=http://a:8000/match;exp=http://b:9000/match"`.
Timeout: `MATCHER_TIMEOUT_MS` (default 15 s). A slow or failing service returns a clear error to the user. It never breaks the rest of the app.

### About the corpus

The whole workspace corpus (faculty, departments, projects, publications, IP) is sent with every request. That's simple and stateless, and fine for thousands of researchers. If it becomes too large:
- cache it in your service and compare a hash, or
- pull it once via `GET /api/w/{ws}/export/corpus` (staff key) and refresh on a schedule.

Either way, return only ids that exist in the corpus you were given.

## Make it pass the contract

```bash
npm run matcher:check -- --provider=<id> [--workspace=demo]
```

This runs six fixture requests (research, talent, licensing, a constraint, a nonsense query, a topic-only query) and validates every response. Fix every ✗ before using the matcher. The server runs the same check on every live response and rejects violations with HTTP 502, listing the problems.

What gets checked:
- shape and types of every field
- ranks are `1..n` in order, sorted by score, no duplicates
- every `facultyId` and evidence `id` exists in the corpus
- every result has a summary and at least one assessed component

## Make it the default

```bash
MATCHER_DEFAULT=embedding npm start
```
Searches record which matcher produced them (`MatchSearch.providerId`), so you can compare old and new runs later.

## Checklist before shipping a matcher

- [ ] `npm run matcher:check` passes
- [ ] `npm run eval` is no worse than the baseline on the live workspace's labelled decisions
- [ ] Explanations still make sense to a non-technical reviewer: open a few results in Match Studio
- [ ] Researchers with sparse records aren't buried. Their confidence is low, not their score
- [ ] Latency is acceptable (the check prints milliseconds per request)
