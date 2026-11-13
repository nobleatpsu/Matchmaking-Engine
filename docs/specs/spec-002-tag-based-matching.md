# Spec 002: Matching on topic-tagged data (scoring, fuzzy topics, ranking, evaluation)

|                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                       | **v0.3 APPROVED 2026-10-28** (relayed by Ian; no Tech Lead assigned). Interim rule added the same day for the first real files (section 3, "Interim provenance").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Revision                     | v0.3, 2026-10-27, after Atharv's answers (section 12) and his real company file: faculty weights are shares of works so they are saturated before use (5.2, A16), missing values drop out of the score and never count as zero (5.4 to 5.6), the company score is remapped from 1-10 (5.5, A14), backtest replay rows never count as current needs (section 3), a signal may carry no topic, and the topic-hierarchy option now has a source (section 6). v0.2, 2026-10-26, after Noble's feedback: each match gets a one-line `headline`, the result file gets a `run_id` and a stable-pair rule for save/dismiss/flag, reasons are ordered by importance, source references become links only when they are URLs, the number is called the match score, and the checks that score, breakdown and band agree and that no candidate repeats (added in PR #2) are listed. |
| Author                       | Ian (algorithms/matchmaking)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Approver                     | Tech Lead (not yet assigned). Until then: Atharv and Noble on the shapes they own, Andy on scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Reviewers                    | Atharv Mitthal (input format, section 3), Sherman Noble (output changes, section 4), then the Tech Lead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Drafted                      | 2026-10-24                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Amends                       | Spec 001 (approved 2026-10-22). Replaces its input contracts, stages 1 to 3, and slices 2 to 6. Keeps its result file, uncertainty rules and guardrails.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Data level                   | 1 (synthetic and public sources only: company documents and OpenAlex for faculty, no CV text; the real company file arrived 2026-10-27, the real faculty file is pending)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Issue title (client's words) | "CEC staff see the best-matched researchers for a company's current needs, and the best-matched companies for a researcher, and why"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Spec 001 assumed profiles with free text (CV sentences, company descriptions). Atharv's handoff of 2026-10-24 is different: faculty and company needs are **weighted tags from a shared topic list**, plus numbers (publication counts, signal strength, signal age, PSU links). This spec says how we match on that.

## 1. Decisions this spec asks the team to make

1. **Atharv's format is the input.** We do not ask him to emit spec 001's profile shapes. Our code reads his files through an adapter and turns them into the internal records and the evidence items the result file needs (section 3). His real data arrives in his shape, so this costs the least rework.
2. **Spec 001's output stays**, with additive changes only (section 4). The two sample files and the existing tests stay valid.
3. **The score is computed in code, not by the model** (section 5). Claude on Bedrock is not needed to rank. Reasons are templated from the same facts, so every citation is correct by construction. Bedrock stays in the plan for two optional jobs (section 6).

## 2. Scope

**In:** workflow 1 (company → researchers) and workflow 2 (researcher → companies) on topic-tagged data; the scoring function; fuzzy topic matching; ranking, tie-breaking and the "why"; the evaluation harness; the edge cases in section 7.

**Out:** workflow 3 (OTT technologies and facilities). Spec 001 section 2 reserved the number 002 for it, so it becomes spec 003 and spec 001 needs a one-line edit. Collecting data (Atharv), the frontend (Noble), saving, dismissing and flagging matches (frontend; it needs its own short spec from Noble, and this spec only guarantees the stable ids it needs, section 4), emails and briefs, sending anything, CRM, accounts, a hosted API. The tool still does not judge conflict of interest, export control or availability (spec 001 section 5, rule 4).

## 3. Input: Atharv's format (v0.1)

Three files, read as they are:

| File                       | One line is                          | Key fields                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faculty_profiles.jsonl` | a researcher                         | `faculty_id`, `name`, `department`, `topics[]` (`topic_id`, `label`, `weight` 0 to 1), `works_last_5y`, `h_index`, `last_pub_year`, `active_grants`, `patents`, `prior_industry_collabs`, `open_to_industry`                                                                                                             |
| `company_needs.jsonl`    | **one signal** about a company | `need_id`, `company{company_id,name,...}`, `need{kind, summary, topics[], direction, strength 1-5, event_date, age_days}`, `company_quality{score, momentum_theme, signals_last_7d}`, `psu_links{alumni_count, psu_engaged, copub_faculty_ids[]}`, `evidence[]{evidence_id, source, url, fetched, verified_by[]}`, `status`, `as_of` |
| `topics.json`            | the shared vocabulary                | `topic_id` → label                                                                                                                                                                                                                                                                                                                                |

**Adapter rules** (all enforced at load, with `record N (id).field: message` errors like the existing validator):

- `schema_version` must be one we know (`0.1`). An unknown version stops the load.
- Every topic id must be in `topics.json`. A duplicate id, or a `copub_faculty_ids` entry that is not a loaded faculty id, is an error.
- Only `status: verified` signals are used. Others are excluded and counted in the run summary.
- `age_days` is **recomputed** from `event_date` and `as_of`. A mismatch is reported, and the recomputed value wins.
- The company is built by grouping signals on `company_id`. `company_quality` and `psu_links` are taken from the most recent signal. If two signals of one company disagree, the load reports it.
- **Evidence the result file can show.** His evidence items have no text, and a faculty record has no evidence at all, but reasons must cite evidence. The adapter creates items: for a signal, `text` = the signal summary, `date` = `event_date`, provenance from `source`, `url`, `fetched`; for a researcher, small derived items (`profile_stat`) such as "3 active grants, 9 patents" and "41 works in the last 5 years, last in 2026", each with provenance pointing at the faculty record.
- **Provenance.** Real faculty records come only from OpenAlex (no CV text, answer Q2): `source_ref` is the OpenAlex author URL and `retrieved_at` the pull date. Synthetic data gets `synthetic:<file>#<id>` and the file date. A real faculty record without both is a load error.
- **Interim provenance (Ian, 2026-10-28).** To build on the first real files as delivered, a real faculty record without `source_ref` or `retrieved_at` is not rejected. The adapter builds `source_ref` from the OpenAlex author id (`https://openalex.org/<id>`) and uses the run date for `retrieved_at`, and marks the record "provenance derived" (counted in the run summary). Evidence items with no usable retrieval date get the run date the same way. The record also accepts the extra `openalex_topics` list (OpenAlex id, label, subfield, works). Unknown extra fields are reported, not rejected. Tighten this back to an error once Atharv's export carries real values.
- **Real source names.** Beyond the sample's sources, the first real file uses `catalyst` (maps to `market_data`), `openalex` (new `openalex`), `news_rss` (maps to `news`) and `linkedin_company_employees` (new `linkedin`).
- **Faculty fields that will be null.** `active_grants`, `patents`, `prior_industry_collabs` and `open_to_industry` are not collected from OpenAlex and ship as `null`. Null means unknown, never zero (5.4 to 5.6). The adapter treats `works_last_5y`, `h_index`, `last_pub_year` and the topic shares as the researcher's data.
- **Backtest replays are not current needs.** Atharv's pipeline replays past announcements to test itself, so most rows in the first real file (49 of 57) carry an old `as_of` such as 2019 to 2023. Rows must be marked as replays (requested, not yet in the file). Replay rows are excluded from live matching and may be used only to evaluate the company side. Until the marker exists, the adapter treats any row whose `as_of` is more than 30 days before the run date as a replay and counts it in the run summary.
- **Age is measured from the run date,** never from the record's own `as_of`. A missing, year-only or unreadable `event_date` (the real file has "2000", "November 7" and "July 23, 2") is kept as far as it is known, its signal recency is then unknown, and it is counted in the run summary.
- **A signal may have no topic.** The tagger must be allowed to say "no topic" when nothing in the list fits (requested). Such a signal cannot be matched on topic. It is kept, shown as an unmatched need, and counted. If one topic tags more than a quarter of a company file's signals, the load warns, because that is how the first real file ended up with 24 of 57 signals under photonics.
- **Field text.** The company's investment field text (today inside `summary`) is kept with the signal and shown on the screen, so the CEC reads the real need, not a topic label.
- **Dates on evidence.** In his evidence, `fetched` for OpenAlex items is the publication year. It is stored as the item's `date`. Until a real retrieval date is exported, `retrieved_at` is the run date and the item says so.
- **Pseudo-links.** `market:...` and `linkedin:...` references are kept as plain text, never as links (section 4).

**Small additions to spec 001's enums** (additive): `SourceType` += `sec_filing`, `job_posting`, `social_post`, `news`, `market_data`, `profile`; `EvidenceKind` += `company_signal`, `profile_stat`. His source names map as: `edgar_10k`, `edgar_8k` → `sec_filing`; `uspto` → `patent_db` (existing); `linkedin_jobs` → `job_posting`; `linkedin_post` → `social_post`; `market_data`, `news` as they are. An unmapped source name is a load error, so a new source forces a deliberate decision.

## 4. Output changes (for Noble)

The result file keeps its shape. Additive changes only:

- `breakdown` gains two optional components, `company_quality` and `psu_link` (0 to 100), and `weights` gains the matching two optional weights. Spec 001 matches leave them null and stay valid. The screen shows whichever are present.
- `FlagCode` += `NEGATIVE_SIGNAL`, `CONFLICTING_SIGNALS`, `NOT_OPEN_TO_INDUSTRY`.
- `query.summary` and `candidate.detail` carry the one-line context (the matched signal for a company; department and last publication year for a researcher).
- `match.headline` (new, optional): one templated sentence for the collapsed view, for example "Strong match: hiring in glass strengthening 12 days ago, published in 2026." The screen does not have to build an overview from the reasons.
- `reasons` are ordered by importance, most important first. The screen shows the top three and keeps the rest behind the expand, together with the breakdown and the evidence.
- **Name and meaning of the number.** The 0 to 100 value is the **match score**, shown with its band and its uncertainty flags next to it, not hidden in the expanded view. It is not called confidence: it comes from hand-picked weights, it has not been validated, and it must not read as a probability.
- **Source links.** Every evidence item already carries `source_ref`, `source_type` and `retrieved_at`. The screen shows `source_ref` as a link only when it is an http or https URL, with the retrieved date beside it so a stale link is visible. Anything else (a document id, for example) is shown as plain text, never as a file path (the validator rejects local paths). Links may need a login or may have moved, which is why the date is shown.
- **Stable pairs and `run_id` (for save, dismiss and flag).** A match is identified by `(query_id, candidate_id)`, which stays the same across runs for the same pair. The result file gets a `run_id` (new, optional) so a saved decision can say which run it was made on. Decisions are stored by the frontend, separately, and are never written into result files. Re-running the matcher must not bring back a dismissed pair or lose a note, and that is the frontend's rule to apply using these ids.
- **Checks in the contract (already in PR #2).** The score must be the weighted sum of the breakdown, rounded, and the fit gate may only lower it. The band must fit the cut-offs (strong 75+, moderate 50+, weak below, and weak whenever topical fit is under 40), and a weak match scores under 50. A candidate cannot be listed twice in a result file, and a profile file cannot repeat an id. Slice 2c extends the score check to the new components in section 5 and to the caps for conflicting signals.
- Nothing else moves. A change to this list is announced to Noble before it lands.

## 5. Scoring

A **pair** is one researcher and one company. Both workflows score pairs and differ only in which side is ranked. Every number below is a starting value in config (hypotheses, section 9), so CEC answers and the evaluation change values, not code.

**5.1 Which signals count.** Per company signal: effective weight `w = (strength / 5) × 0.5^(age_days / 45)`.

- `direction: positive`: counts fully. `neutral`: counts at half. `negative`: never creates a match (5.6).

**5.2 Topical fit (0 to 100).** For one signal `s` with topic weights `t` and a researcher with topic weights `f`:

`cover(s, f) = Σ_a t_a × max_b ( f'_b × S[a][b] ) / Σ_a t_a`

`S` is the topic similarity, 1 on the diagonal and 0 to 1 elsewhere (section 6). **Two weights need care.**

- **Researcher weights are shares of works** (answer Q3), so a researcher who splits their work over several topics has small shares. Using shares directly would put broad researchers under the fit gate. They are saturated first: `f'_b = min(1, share_b / 0.25)`, so 25% of someone's work in a topic counts as full expertise (A16).
- **Company weights are stubs** (`0.9` on every signal today, answer Q3). Until Atharv derives them from the evidence, every company topic counts as `t_a = 1` (A17), and the real values are ignored.

A researcher with only a small share in a matching topic therefore gets a lower fit, as they should. **The company's fit is the best single eligible signal**, not the average, so a company with five unrelated needs is not diluted: the match rests on the signal that fits, and the reason names it. `topical_fit = round(100 × cover)`.

**5.3 Recency (0 to 100).** Mean of `signal_recency = 100 × 0.5^(age_days / 45)` for the matched signal and `faculty_recency = max(0, 100 − 20 × (as_of year − last_pub_year))`.

**5.4 Evidence strength (0 to 100).** Mean of:

- `signal_support = 60 × strength/5 + 20 × [two or more verifiers] + 20 × min(1, (n_corroborating − 1) / 2)`, where `n_corroborating` is the number of eligible signals of that company with `cover ≥ 0.4`;
- `track_record = 100 × (0.35·min(1, works_last_5y/30) + 0.25·min(1, active_grants/3) + 0.20·min(1, patents/5) + 0.20·min(1, prior_industry_collabs/5))`, **using only the inputs that are known**: a null input drops out and the remaining weights are scaled up to add to 1. With the OpenAlex data only `works_last_5y` is known today, so `track_record` rests on that alone. Every match then lists, in `not_checked`, "grants, patents and prior industry collaborations were not collected".

If `strength` or `verified_by` is missing (the first real file has `verified_by` absent on every item), `signal_support` uses only the parts that exist, scaled the same way, and the strength of the real file (4 on every signal) is treated as unrated, not as information.

**5.5 Company quality and PSU link.** `company_quality` comes from Atharv's company opportunity score, which runs 1 to 10 with a floor of 1 (live range 2.3 to 8.4, answer Q4), so `company_quality = round((score − 1) / 9 × 100)` (A14). Null means unknown and the component drops out. `psu_link = 100` if the researcher is in `copub_faculty_ids` of an eligible signal, otherwise it is built only from what is positively known: `min(100, 30 × [psu_engaged is true] + 8 × min(alumni_count, 5))` when `psu_engaged` is true or `alumni_count` is above 0. If both are false, zero or null, the component is **unknown and drops out**, because in the first real file `psu_engaged` is false on every row and `alumni_count` is mostly null, which means "not checked", not "no link".

**5.6 Combining.** `score = round(0.50·fit + 0.15·recency + 0.15·evidence + 0.10·company_quality + 0.10·psu_link)`, using only the components that are known: an unknown component is left out and the other weights are scaled to add to 1. **The breakdown records the weights actually used,** and the unknown components are null, so the screen shows what the score rests on. Topical fit is always known for a match, and a match with no known recency and no known evidence strength is `insufficient`. Then:

- **Fit gate (from spec 001):** `topical_fit < 40` → band `weak` and score capped at 49. Nothing else rescues an off-topic match.
- **Direction:** a negative signal is never used as the matched signal. If a company's only signals near the researcher's topics are negative (`cover ≥ 0.4`), the company is **not ranked**. It is listed unranked as `insufficient` with `NEGATIVE_SIGNAL` ("we saw this and are not flagging it") so nobody wonders why it is absent. If positive and negative signals sit on the same topics with `min(w) / max(w) > 0.5`, the pair gets `CONFLICTING_SIGNALS` and its score is capped at 74 (never `strong`).
- **Stale profiles (added 2026-10-28 after the first run on real data):** a researcher whose last publication is more than 3 years before `as_of` is capped at 59, so a perfect topic fit cannot rate `strong` or outrank a current researcher with a decent fit (A20). The first real faculty file had two authors whose last work was in 1974 and 1978 and who scored 76 without a cap, and still ranked first at a cap of 74.
- **Bands:** strong 75+, moderate 50 to 74, weak under 50 (spec 001, A6). `insufficient` has a null score and rank.
- **Flags** (spec 001 section 5 list plus section 4 additions): `STALE_PROFILE` when the last publication is more than 3 years before `as_of` (A4), `NO_RECENT_ACTIVITY`, `THIN_EVIDENCE` when the researcher's `works_last_5y` is under 5 or the signal has one verifier and no corroboration, `NOT_OPEN_TO_INDUSTRY` when `open_to_industry` is false (a flag only, score unchanged, because availability is a human call, A5), `SYNTHETIC_DATA`.

**5.7 Ranking and the "why".** Sort by the shown (rounded) score, descending, because that is the number staff see. Equal scores break in this order: `topical_fit`, then `psu_link`, then `evidence_strength`, then `recency`, then the unrounded score, then id, so the same input always gives the same order. Default list length is 10 (A3). **The list is not padded:** it holds the matches that are `moderate` or better, up to 10. Weak matches appear only when fewer than 3 are `moderate` or better, and then only enough to reach 3, each labelled weak. (With 60 researchers over 40 topics most companies have only a handful of real candidates, so a full list of 10 would be mostly weak matches shown to fill space, which spec 001 section 5 rule 1 forbids.) Each reason is a template filled from the facts, cites the evidence ids it uses, and is listed most important first (the matched signal, then the researcher's activity, then PSU links), for example "Hiring signal 12 days ago concerns *Glass science and strengthening*; this researcher lists the same topic at weight 0.9 and published in 2026." The match also says how many of the company's other signals it does **not** rest on.

## 6. Fuzzy topic matching (`S`)

`S` sits behind one interface, `similarity(topic_a, topic_b) → 0..1`, with three possible sources. We build the interface and the first, and compare the rest on the evaluation (section 8):

1. **`exact` (v1 baseline):** identity matrix. A topic matches only itself.
2. **`matrix` file (v2):** a versioned JSON matrix of all topic pairs, reviewable by a human line by line. Its origin is a decision (Q1): (a) embeddings of the topic labels through Bedrock once the sandbox exists; (b) one offline Claude-on-Bedrock rating job over the label pairs (780 pairs for 40 topics; labels are public, data level 1); (c) the real topic hierarchy: his topics are his own 40, but an OpenAlex mapping exists for 35 of them (answer Q1), so topics that share an OpenAlex subfield or field can count as close, and the 5 unmapped topics match only themselves until mapped (requested: the mapping file). Until the sandbox exists, v2 can be tested with a small hand-written matrix whose entries are reviewed by a second person.
3. **Co-occurrence learned from the data (not used for scoring):** shown only as a diagnostic. In the synthetic data it would recover the generator's hidden neighbour table and look better than it is.

**Rule:** the matcher never imports `make_samples.py` or its `NEIGHBORS` table. If it did, the synthetic evaluation would be circular.

## 7. Edge cases (each is a test)

| Case                                                                     | Required behaviour                                                                            |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Company with several unrelated needs                                     | Fit uses the best signal; the others are not averaged in; the reason names the matched signal |
| Researcher with stale publications                                       | `STALE_PROFILE`, low recency, fit unaffected                                                |
| Positive and negative signals on one topic                               | `CONFLICTING_SIGNALS`, never `strong`                                                     |
| Only negative signals near the researcher's topics                       | Unranked, `insufficient`, `NEGATIVE_SIGNAL`, no score                                     |
| Topic nobody covers (T020, T034 in the sample)                           | Candidates are weak or `insufficient`; the list may be short; nothing is padded             |
| Researcher with no topics, or company with no eligible signal            | `insufficient`, null score                                                                  |
| Five researchers who look equally good                                   | Deterministic tie-break (5.7); same input, same order                                         |
| Unknown topic, duplicate id, dangling co-publication id, unmapped source | Load error naming the record and field                                                        |
| `age_days` disagrees with `event_date`                               | Recomputed value used; mismatch reported                                                      |
| Signal not `verified`                                                  | Excluded and counted                                                                          |
| `open_to_industry` false                                               | Flag only                                                                                     |

## 8. Evaluation harness

Purpose: tell us whether version 2 beats version 1, and catch regressions on the edge cases.

- **Versions compared on the same cases:** v0 = exact topic overlap only (no signals); v1 = full score with `exact` similarity; v2 = full score with the `matrix` similarity. The harness takes a config and writes a results file stamped with the config, the data file hashes and the date.
- **Cases from the data.** The only labelled links are the 29 needs with `copub_faculty_ids`; 7 of them sit on negative signals, which must not be ranked, so 22 are usable for recall. **The `psu_link` component is masked for these cases**, because the answer is one of its inputs. Metrics: recall@10 and mean reciprocal rank, reported as counts ("21 of 29 in the top 10") and as paired wins, losses and ties against the previous version, since 29 cases is too few for percentages to mean much.
- **Invariant checks** (pass or fail, from section 7): negative-only companies are never ranked; the gate holds; ties are stable; no reason cites an id that is not in the file; synthetic input yields `synthetic: true`.
- **What it does not prove.** On synthetic data the labelled links come from the generator, so recall here shows the pipeline works, not that matches are good. Real accuracy needs the CEC's known past matches (spec 001, N2), with profiles built from information dated before the collaboration.
- Cost and time per run are logged. No call to Bedrock is needed for v0 to v2 with a hand-written or pre-built matrix.

## 9. Assumptions the data and the CEC will test

Set in config, changed without code changes. They supersede spec 001's A1 where noted.

| #      | Assumption                                                                                                                        | Resolved by                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| A1'    | Weights 0.50 fit, 0.15 recency, 0.15 evidence, 0.10 company quality, 0.10 PSU link (supersedes A1)                                | CEC F1, F4, F11; evaluation         |
| A10    | Signal half-life of 45 days                                                                                                       | Atharv (how fresh is "fresh"), CEC  |
| A11    | Neutral signals count at half weight                                                                                              | Evaluation, CEC                     |
| A12    | Company fit is the single best signal, not an average                                                                             | Evaluation, CEC                     |
| A13    | `open_to_industry` is a flag, not a score input                                                                                 | CEC L1, F6                          |
| A14    | `company_quality.score` runs 1 to 10 with a floor of 1, so it is remapped as (score − 1) / 9 (answered, Q4)                    | Atharv (Q4)                         |
| A15    | A list holds only `moderate` or better matches, with up to 3 weak ones when fewer than 3 exist                                  | CEC F12, N5                         |
| A16    | A researcher's share of works in a topic is saturated at 25% (`min(1, share / 0.25)`) before it is used                         | Evaluation on the real faculty file |
| A17    | Company topic weights count as present or absent (1) until Atharv derives real ones from the evidence                             | Atharv (Q3)                         |
| A18    | `momentum_theme` (expanding, steady, contracting, plus a driver) is shown on the screen as context and is not part of the score | CEC F1, evaluation                  |
| A19    | Missing values drop out of the score and the other weights are scaled up, instead of counting as zero                             | Evaluation, CEC                     |
| A20    | A stale profile (last publication over 3 years old) is capped at 59, so it can appear but not lead | Evaluation, CEC F8 |
| A4, A6 | Stale after 3 years; band cut-offs 75 and 50 (unchanged from spec 001)                                                            | CEC F8, F4, G8                      |

## 10. Acceptance criteria

1. Atharv's sample files load through the adapter. Every error case in section 3 has a test and a readable message.
2. Spec 001's two sample result files and its 50 tests still pass after the enum and breakdown additions.
3. Both workflows run end to end offline on the sample data and write result files that validate against the (extended) schema.
4. Every edge case in section 7 has a test that fails if the behaviour changes.
5. The score and the order are identical across two runs of the same input.
6. No reason cites an evidence id that is not in the result file, and a test proves it.
7. The harness runs v0, v1 and v2 on the same cases, masks `psu_link` for the labelled cases, and writes a stamped results file.
8. Every match lists `not_checked`. No code path sends a message.
9. Every match has a `headline`, every result file has a `run_id`, reasons come most important first, and the same pair has the same `(query_id, candidate_id)` on every run, with a test for each.
10. Replay rows never appear in a live ranking, and a test proves it. Age comes from the run date, and a test proves it with a record whose own `as_of` is years old.
11. A missing value is never counted as zero: with a null `company_quality`, `psu_link` or `active_grants`, the score is the same as if that component did not exist, the breakdown shows it as null, and the weights used add to 1. A test proves it.
12. A broad researcher (several topics, none above 25% share) is not put under the fit gate by their spread alone, and a test proves it.
13. A signal with no topic is kept, counted, and never matched. A topic over a quarter of a company file's signals produces a load warning.
14. Each slice passes `pytest` and `ruff`, and a person other than the author reviews its PR.

## 11. Slices (each becomes a board issue)

Sizes are Intern Hub sizes (S 2 to 3 h, M 4 to 6 h).

| Slice | Issue title (client's words)                                                                                                          | Size | Replaces (spec 001)       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------- |
| 2a    | "The team's real data loads and bad records are caught" (adapter, enum additions, load errors, evidence items)                        | M    | part of slice 1 follow-up |
| 2b    | "Related topics count as partial matches" (similarity interface, `exact`, `matrix` loader)                                        | S    | slice 2                   |
| 2c    | "Each match shows a score, a breakdown, flags and reasons" (pair scorer, direction, gate, bands, templated reasons, output additions) | M    | slices 3 and 4            |
| 2d    | "Staff can run a match and get a ranked list" (ranking, tie-break, CLI, result files for both workflows)                              | S    | slice 5                   |
| 2e    | "The team can measure whether a change made matches better" (harness, invariants, stamped results)                                    | M    | slice 6                   |

About 20 hours in total, in the order 2a, 2b, 2c, 2d, 2e. Real build capacity is 13 to 14 hours a week for the whole team, so this is more than a week. Dates are Andy's to confirm and are not assumed here.

## 12. Risks and open questions

**Answers from Atharv (2026-10-27) and what each changed**

| Q  | Answer                                                                                                                                                                                                                        | Effect on this spec                                                                                          |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Q1 | His own 40-topic list, and 40 is the real size. An OpenAlex mapping exists for 35 of the 40.                                                                                                                                  | The hierarchy option now has a source (section 6). The mapping file is requested.                            |
| Q2 | All faculty fields come from OpenAlex, with the author URL and a retrieval date. No CV text. Grants, patents, prior collaborations and `open_to_industry` ship null.                                                        | Provenance rule and null handling (section 3, 5.4). The real-CV clearance question does not block this path. |
| Q3 | Faculty weights are real shares of works. Company weights are stubs (0.9 on every signal) until derived from the evidence.                                                                                                    | Saturation (5.2, A16) and presence-only company topics (A17).                                                |
| Q4 | The company score runs 1 to 10 with a floor of 1 (live range 2.3 to 8.4). `momentum_theme` is expanding, steady or contracting plus a driver.                                                                               | Remap (5.5, A14). Momentum is shown, not scored (A18).                                                       |
| Q5 | One signal per line. No free text beyond `summary`, which already carries any spend note.                                                                                                                                   | Confirms the input shape. Field text is kept (section 3).                                                    |
| Q6 | `open_to_industry` ships null. `verified_by` holds real verifier records from groq, gemini, nvidia, openrouter and ollama. Public-source data goes through public LLM APIs today, and Bedrock can swap in through config. | The flag-only rule is confirmed. The platform question goes to Andy (below).                                 |

**Still open**

- **The faculty file.** Promised, not delivered (`build_faculty.py` is not in the repo). Which researchers it covers is not stated, and OpenAlex can merge or split people.
- **Requested from Atharv, not yet in the data:** a replay marker, a "no topic" option, the field text as its own field, the OpenAlex mapping for the topics, a real fetched date, the excerpt, `verified_by`, the opportunity score, the momentum read and the Penn State co-author ids.
- **Answered by Andy (2026-10-28):** the pipeline may send company documents to outside LLM services as long as the documents were found publicly online, and LinkedIn use is allowed. Nothing non-public goes to those services. Faculty and CEC data stay out of them until the Bedrock sandbox exists and the data is cleared.

Risks:

- **Synthetic labels are circular.** Section 6 and section 8 guard against it, but only real labels fix it.
- **Real data does not look like the sample.** The first real company file differs in several ways (section 3). Expect the real faculty file to differ too, and revise the adapter and the numbers in section 5 once it arrives.
- **Hand-picked weights.** All of section 5 is a starting guess. Nothing here is validated, and the output must say so (`method.note`).
- **No Tech Lead yet** for approval. **AWS sandbox not provisioned**, so the topic matrix has no Bedrock source yet.

## 13. Approval

- [ ] Atharv: the input format and adapter rules (section 3) match what he will deliver
- [ ] Noble: the output additions (section 4) work for the frontend
- [ ] Andy: scope and dates (sections 2 and 11) acknowledged
- [ ] Tech Lead: spec approved (none assigned yet)
