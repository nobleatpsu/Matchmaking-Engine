# Evaluating matchers

A high match score is a *prediction*. Evaluation checks predictions against what people actually decided.

## Where the labels come from

`shared/matching/eval.ts → buildLabels(db)` groups labels into **queries** (one per opportunity, or per standalone search):

| Signal | Positive | Negative |
|---|---|---|
| Opportunity outcome with a researcher | successful collaboration, agreement signed, productive introduction | **wrong expertise** |
| Review decision (match / introduction / low-confidence) | approved | rejected |
| Match Studio shortlist | saved, promising, in review | dismissed with reason *"Wrong expertise"* |

Outcomes like *budget mismatch*, *no response* or *faculty unavailable* are **not** counted against the matcher. The match may have been right; something else went wrong.

Each query's request is reconstructed with `requestForOpportunity()`: the saved search's request if there is one, otherwise the opportunity's title, description and interest topics.

## Metrics

For queries with at least one positive:

| Metric | Meaning |
|---|---|
| **hit@1 / hit@3 / hit@5** | Share of queries where a positive appears in the top 1 / 3 / 5 |
| **MRR** | Mean of 1 / (rank of the best-placed positive) |
| **recall** | Share of positives returned at all |
| **pairwise accuracy** | For queries with positives *and* negatives: how often a positive is ranked above a negative (a missing result counts as last) |

## Running it

```bash
npm run eval -- --workspace=demo                                  # every registered matcher
npm run eval -- --workspace=live --provider=baseline --provider2=embedding
npm run eval -- --workspace=live --verbose                         # per-query ranks
npm run eval -- --workspace=live --out=reports/                    # also writes JSON (labels + results)
```

In the UI: **Admin → Matchers & evaluation → Evaluate**.

Get the raw data for offline work:
- `GET /api/w/{ws}/export/labels`: labelled queries (`request`, `positives`, `negatives`, `sources`)
- `GET /api/w/{ws}/export/corpus`: the corpus

## Reading the numbers honestly

- **The demo dataset is small and hand-made.** Its numbers are near-perfect by construction and only show that the plumbing works. Real evaluation needs the **live** workspace after months of use.
- With a few dozen labels, differences of 0.05 are noise. Look at the per-query list (`--verbose`) and at actual results in Match Studio.
- Labels are biased toward what the *current* matcher surfaced, because people only review what they're shown. A new matcher that finds good people the old one never showed will look *worse* on recall until reviewers see those results. Run side-by-side reviews before switching defaults.
- Never optimize the score alone. Keep explanations, unknowns and confidence honest. Reviewers depend on them.

## Growing the label set

The product collects labels as a by-product of normal work:
- **Dismiss with a reason** in Match Studio. "Wrong expertise" becomes a negative.
- **Record outcomes** on opportunities. The outcome menu is mandatory before moving to *Outcome*.
- **Review decisions** with comments.

If CEC or OTT can share historical successful matches, load them as opportunities with outcomes through the ingestion API, or ask the frontend team to add an `opportunities` ingest entity.
