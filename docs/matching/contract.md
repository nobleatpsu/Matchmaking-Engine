# Matcher contract reference

TypeScript definitions: `shared/matching/types.ts`. Runtime schema and invariants: `shared/matching/contract.ts`.

## Input

### `MatchRequest`
| Field | Type | Notes |
|---|---|---|
| `text` | string | The need in plain language. May be empty when `topics` are given |
| `topics` | string[] | Taxonomy concept ids the user chose |
| `excludedTopics` | string[]? | Concepts detected in `text` that the user removed |
| `engagementType` | `research` · `talent` · `engagement` · `licensing` | |
| `companyId`, `interestId` | string? | Context; look them up if useful |
| `disciplines` | string[] | Preferred **college names**. A soft preference, never a filter |
| `outcome`, `budget`, `timeline`, `location`, `notes` | string? | Free text |
| `constraints.requireIP` | boolean? | Hard filter: only researchers with related IP |
| `constraints.activeResearchOnly` | boolean? | Hard filter: only researchers with a related active project |
| `constraints.requireVerifiedContact` | boolean? | Hard filter |
| `constraints.excludeFacultyIds` | string[]? | Hard filter |

Respect the hard constraints, and report the researchers you exclude in `excluded` with a reason.

### `MatchCorpus`
`{ faculty: Faculty[], departments: Record<id, Department>, projects: Project[], publications: Publication[], ip: IPRecord[] }`. Field details: [../data-model.md](../data-model.md).

## Output: `MatchResponse`

| Field | Type | Notes |
|---|---|---|
| `providerId`, `providerVersion` | string | Identify yourself. Version changes should be meaningful |
| `generatedAt` | ISO string | |
| `method` | string | One sentence a staff member could read |
| `requestConcepts` | string[] | Concepts you matched on (shown as chips) |
| `inferredConcepts` | string[] | Subset that you detected yourself |
| `results` | `MatchResult[]` | Sorted by score, rank 1..n |
| `excluded` | `{ facultyId, reason }[]` | Removed by hard constraints |
| `considered` | number | How many researchers you looked at |

### `MatchResult`
| Field | Type | Notes |
|---|---|---|
| `facultyId` | string | Must exist in the corpus |
| `rank` | int ≥ 1 | Position, 1-based |
| `score` | 0–100 | Match quality. **Not** availability or confidence |
| `band` | `strong` · `good` · `possible` · `weak` | Use `bandFor(score)` for consistency |
| `components` | `ScoreComponent[]` | ≥ 1, at least one assessed. Keys: `topic`, `expertise`, `active`, `evidence`, `pathway`. `score: null` = not assessed |
| `adjustments` | `{ label, points, explanation }[]` | Added after the weighted average |
| `concepts` | `{ concept, strength 0–1, direct, via[] }[]` | Per requested concept |
| `evidence` | `EvidenceItem[]` | `type` (`project`/`publication`/`ip`/`expertise`/`keyword`/`summary`), `id` (must exist when given), `title`, `concepts`, `strength 0–1`, `active?` |
| `unknowns` | string[] | What a reviewer must confirm |
| `concerns` | string[] | Reasons for caution |
| `confidence` | `{ score 0–100, level, factors[] }` | Trust in the *record*, separate from the score |
| `summary` | string | One plain-language sentence. Required |
| `pathways` | string[] | Suggested collaboration formats |
| `relatedProjectIds`, `relatedIpIds` | string[] | |

The UI degrades gracefully: you can leave `concepts`, `pathways` and `factors` empty. A good `summary` and honest `unknowns` matter most to reviewers.

## Errors

Return a non-2xx status with a short text or JSON body. The user sees *"<id> returned HTTP 500: …"*. Responses that violate the contract are rejected with HTTP 502 and the list of violations, and logged on the server.
