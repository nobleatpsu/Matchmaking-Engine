# How the baseline matcher works

`shared/matching/baseline.ts`. It is deterministic, makes no network or AI calls, and runs in about 1 ms per researcher. It is designed to be **explainable first**, so it's a good reference implementation and a good comparison point.

## 1. Understand the request

`requestConcepts(request)` builds the set of **concepts** (taxonomy ids, see [taxonomy.md](taxonomy.md)):

- `request.topics`: concepts the user picked, plus
- concepts detected in `text`, `outcome` and `notes` by `extractConcepts()` (phrase matching, longest phrase first), minus
- `request.excludedTopics`: detected concepts the user removed in the UI.

If no concepts are found, the response has no results. The UI then asks the user to add topics.

## 2. Gather evidence for each researcher

| Source | Weight |
|---|---|
| Listed `expertise` | 1.0 |
| `keywords` | 0.9 |
| `summary` (+ department name) | 0.7 |
| Project, active | 1.0 |
| Project, completed | 0.8 |
| Project, status unknown | 0.7 |
| Publication ≤ 3 years old | 0.85 |
| Publication 4–6 years old | 0.7 |
| Publication older than 6 years | 0.55 |
| IP record | 0.8 |

Each source's concepts come from its explicit `topics` plus concepts extracted from its title and description.

## 3. Concept coverage

For each requested concept *q* and each source:
- **direct** (the source has *q*) → 1.0
- **adjacent** (the source has a concept related to *q*, or *q* is related to one of the source's concepts) → 0.5 (or 0.45 for the reverse direction)

…times the source weight. The best value across sources is that concept's **strength** (0–1). Every project, publication or IP record that contributes becomes an **evidence item**, tagged with the concepts it supports.

`relevance` = mean strength across requested concepts. Researchers below `RELEVANCE_FLOOR = 0.2` are not returned.

## 4. Components (0–100 each)

| Component | Weight | Computed as | `null` (not assessed) when |
|---|---|---|---|
| Topic relevance | 35% | `soft(relevance)` | never |
| Stated expertise | 20% | `soft(mean coverage using expertise + keywords only)` | never |
| Active research | 20% | `soft(best coverage by a single active project)` | the researcher has **no project records at all** |
| Supporting evidence | 15% | `1 − e^(−n/2.2)`, n = evidence items with strength ≥ 0.4 | no projects, publications or IP on file |
| Engagement fit | 10% | Depends on engagement type (below) | nothing relevant is known |

`soft(x) = 1 − (1 − x)^1.5`. Missing one of three requested topics should cost less than missing the only topic.

**Engagement fit**
- *research*: confirmed research interest → 100. Relevant sponsored project → 85. Any sponsored project → 65. Otherwise not assessed.
- *talent*: confirmed talent interest → 100. Otherwise `min(1, labSize/10)`. Not assessed if group size is unknown.
- *licensing*: related IP available → 100. Related IP with unknown or optioned licensing → 70. Related IP already licensed → 35. Unrelated IP only → 25. No IP → 10.
- *engagement*: confirmed engagement interest → 100. Otherwise not assessed.

## 5. Score

```
score = Σ(weightᵢ × componentᵢ) / Σ(weightᵢ for assessed components)  +  adjustments
```

Components that aren't assessed **drop out and their weight is redistributed**. Missing data lowers *confidence* (step 6), not the match score.

Adjustments: preferred college +4, availability `limited` −5, `unavailable` −15. The result is clamped to 0–100.

Bands: **strong** ≥ 75, **good** ≥ 60, **possible** ≥ 45, otherwise **weak**.

Ties are broken by confidence, then by name, so the ranking is fully deterministic.

## 6. Evidence confidence (separate from the score)

| Factor | Weight | Value |
|---|---|---|
| Freshness (`lastVerified`) | 30 | ≤ 180 days 1.0 · ≤ 365 days 0.6 · older 0.25 · never 0 |
| Record coverage (projects + publications) | 25 | ≥ 4 → 1.0 · 2–3 → 0.6 · 1 → 0.35 · 0 → 0 |
| Contact verified | 15 | 1 or 0 |
| Independent sources | 15 | ≥ 2 → 1.0 · 1 → 0.6 · 0 → 0 |
| Known gaps (`coverageNotes`) | 15 | none → 1.0 · some → 0.5 |

Levels: **high** ≥ 75, **medium** ≥ 50, otherwise **low**. In the UI, a low-confidence match sent to review becomes a *low-confidence* review item.

## 7. Unknowns, concerns, pathways

- **Unknowns**: availability not confirmed, interest in this engagement type not confirmed, funding preferences (research requests), unverified contact, every not-assessed component, and every coverage note.
- **Concerns**: never verified or verified more than a year ago, limited or unavailable, related IP already licensed (licensing requests), and requested topics with no evidence at all.
- **Pathways**: suggested collaboration formats derived from the evidence (sponsored project, OTT licensing discussion, student pipeline, …).

## 8. Explaining a ranking

`explainRanking(a, b)` returns each component's weighted contribution difference. The UI shows it as *"Why A ranks above B"*.

## Known limitations (good places to improve)

- Phrase-based concept extraction misses synonyms the taxonomy doesn't list. Embeddings are an obvious upgrade for topic relevance.
- Broad concepts can over-match. The demo's *crop disease genomics* case scored highly on "genomics" but needed plant pathology. That outcome is recorded as `wrong-expertise`, and evaluation counts it as a negative.
- Weights are hand-set. With enough labelled outcomes they could be learned. Evaluation tells you if that helps.
