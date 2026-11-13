# Spec 001: Matching core (Phase 1)

|                              |                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                       | **APPROVED** by Andy, Noble, and Atharv on 2026-10-22, with no changes. Tech Lead approval is pending because none is assigned yet.                                                               |
| Author                       | Ian (algorithms/matchmaking)                                                                                             |
| Approver                     | Tech Lead (not yet assigned; sits above the intern cohort and works with the team and Andy Gatto)                                                  |
| Reviewers                    | Atharv Mitthal (data shapes/collection), Sherman Noble (output shapes/front-end), then the Tech Lead                                               |
| Revision                     | v0.2, 2026-10-19, after Noble's feedback: added the result file and how the frontend gets it (section 3), `reasons[]` now carries `evidence_ids` and the separate `citations[]` is gone, and sample outputs are in `docs/samples/`. |
| Drafted                      | 2026-10-19                                                                                                                                         |
| Data level                   | 1 (public or synthetic data only for everything in this spec). Real faculty CVs stay local and are not used until cleared (CLAUDE.md guardrail 5). |
| Issue title (client's words) | "CEC staff can see ranked researchers for a company's need, and ranked companies for a researcher, with the reasons and evidence"                  |

This is the parent spec for the matching workstream. It is deliberately split into small slices (section 9) so that each issue stays S or M and gets its own review. Each slice becomes a board issue that links back here.

## 1. Problem and user

CEC has about 3 staff who find company–researcher matches by hand, using personal knowledge and manual research. The matching core takes a profile (a company's need, or a researcher) and returns a short ranked list of candidates on the other side, each with a score, a breakdown, the reasons, the evidence it rests on, and an honest statement of what is unknown.

The user is a CEC or research-partnership staff member who will decide what to do with each suggestion. The tool suggests, and a person decides.

## 2. Scope

**In scope**

- Workflow 1: company need → ranked researchers.
- Workflow 2: researcher → ranked companies.
- Shared data contracts for profiles, evidence, and match results (section 3).
- A baseline retriever, deterministic signals, and a Claude-on-Bedrock scorer and explainer (section 4).
- An evaluation harness (section 6).
- A command-line entry point that reads profile files and writes match JSON. Noble's frontend consumes that JSON.

**Out of scope here**

- Workflow 3 (technology or facility → company), including the OTT/Flintbox data: separate spec 002, after the OTT access question is settled.
- Draft emails and one-page briefs: separate spec. This spec stops at the ranked, explained match.
- Collecting or scraping data (Atharv), the frontend (Noble).
- Sending anything. Nothing in this spec sends, and nothing may be added that does.
- CRM integration, authentication, user accounts, and a hosted API. Phase 2.
- Conflict-of-interest, export-control, and faculty-availability checks. The tool does not judge these. It says they were not checked (section 5).

## 3. Data contracts

Every fact carries provenance. A fact without a source and a retrieval date is rejected at load time. Field names are a proposal for Atharv and Noble to push back on.

**Provenance** (on every evidence item and every profile)

| Field            | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `source_type`  | `cv`, `company_site`, `grant_db`, `patent_db`, `ott`, `cec_list`, `synthetic` |
| `source_ref`   | URL or document id (never a local path containing a person's name)                          |
| `retrieved_at` | date the data was pulled                                                                    |
| `as_of`        | date the information describes, if known (for a CV, the CV's own date)                      |

**Evidence** (one cited fact)

| Field          | Meaning                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| `id`         | stable id, cited by matches                                                          |
| `kind`       | `publication`, `grant`, `patent`, `sbir_sttr`, `statement`, `engagement` |
| `text`       | the fact in the source's own words (title, grant title, interest statement)          |
| `date`       | when it happened, nullable                                                           |
| `status`     | for grants and patents: `active`, `completed`, `pending`, `granted`, or null |
| `provenance` | as above                                                                             |

**ResearcherProfile:** `id`, `display_name`, `unit` (department/college), `research_areas[]` (short phrases), `evidence[]`, `provenance`.
**CompanyProfile:** `id`, `name`, `focus_areas[]`, `relationship` (`existing`, `prospect`, `unknown`), `evidence[]`, `provenance`. For the Outbound/Inbound lists, `relationship` comes from the sheet only if CEC confirms what the sheets mean (K5). Until then it is `unknown`.
**CompanyNeed** (workflow 1 query): `id`, `text` (the need in free text), optional `company_id`, `provenance`.

**Match** (the output)

| Field                          | Meaning                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `query_id`, `candidate_id` | the pair                                                                                |
| `score`                      | 0–100, or null when the band is `insufficient`                                       |
| `band`                       | `strong`, `moderate`, `weak`, or `insufficient`                                 |
| `breakdown`                  | `topical_fit`, `recency`, `evidence_strength`, each 0–100, plus the weights used |
| `reasons[]`                  | plain-language sentences, each with `text` and `evidence_ids[]` (every id must exist on the candidate or query) |
| `uncertainty[]`              | flags with a plain-language note (section 5)                                            |
| `not_checked[]`              | the practical checks the tool did not make                                              |
| `method`                     | scorer name and version, model id, prompt version                                       |
| `generated_at`               | timestamp                                                                               |
| `synthetic`                  | true if any input was synthetic, so the UI can label it                                 |

The Match is a JSON document with a published schema, generated from the Python models, so Noble can build against it before the scorer exists.

**Result file (what the frontend actually loads).** One file per query. A Match alone is not enough to draw a screen, because it carries only ids. The file wraps the ranked matches with what the screen needs:

| Field | Meaning |
| --- | --- |
| `schema_version`, `workflow`, `generated_at`, `synthetic` | file-level metadata (`workflow` is `researcher_to_companies` or `company_need_to_researchers`) |
| `query` | what was asked: `id`, `kind`, `display_name`, `summary` |
| `results[]` | in rank order: `rank` (null when the band is `insufficient`), `candidate` (`id`, `display_name`, `kind`, `detail`), and the `match` |
| `evidence` | a lookup from evidence id to the full evidence item (text, date, status, provenance), so a cited id can be shown as its source |

`match.score`, the `breakdown` values, and `rank` can be null for an `insufficient` band, and the screen must handle that. Two hand-written examples are in `docs/samples/` (illustrative, built only from the fictional sample data): `sample-researcher-to-companies.json` covers all four bands, and `sample-need-to-researchers.json` covers the other direction.

**How the frontend gets the file.**
- *Phase 1 (this spec):* the command-line tool writes the result files to an output folder, and the frontend loads them as static JSON. No server is needed.
- *Phase 2 (not in this spec):* the same JSON is returned by a hosted endpoint (the AWS Lambda backend described in the handoff guide). The frontend changes where it fetches from, not what it reads.
- Until slice 1 publishes the JSON schema, the samples are the working contract. A change to the shape is announced to Noble before it lands.

## 4. Approach

Three stages. The first two run today with no AWS access. Only stage 3 needs Bedrock.

**Stage 1: baseline retrieval (offline).** Build a text for each candidate from `research_areas` and evidence text. Rank by TF-IDF cosine similarity (scikit-learn), take the top K (default 30). This is both the shortlist and the baseline we compare the LLM against. If a later step cannot beat it on the evaluation, we do not pay for it. An embedding model is optional and later. It needs Bedrock access we do not have, and the sandbox checklist asks for it.

**Stage 2: deterministic signals (offline, in our code, not the model).**

- `recency`: how recent the candidate's relevant evidence is, from evidence dates. The curve is a config value (assumption A4).
- `evidence_strength`: how much and what kind of evidence backs the match, for example an active grant counts more than a past statement (assumption A1).
- Flags from the data itself (section 5).

Computing these in code keeps them reproducible and testable, and keeps the model from inventing dates.

**Stage 3: LLM judgment and explanation (Claude on Amazon Bedrock).** For each shortlisted pair the model receives the query and the candidate's evidence, each item with its id. It returns `topical_fit` (0–100, using a written rubric) and `reasons`, each with the evidence ids it rests on.

- Model: `anthropic.claude-sonnet-5` through `AnthropicBedrockMantle` in `us-east-1`, per `matching/src/fime_matching/config.py`. Changing the model is a cost decision for Andy, not an engineering default.
- The model sees only the evidence we pass it. The prompt tells it to answer `insufficient` rather than guess, never to state anything not in the evidence, and to cite ids.
- Rubric anchors for `topical_fit`: 80+ the same specific problem or method; 60–79 clearly overlapping area; 40–59 adjacent; under 40 weak.
- The Bedrock endpoint has no structured-outputs feature. We ask for JSON, validate it with pydantic, and retry up to twice. After that the pair is marked `insufficient` with a flag, never silently dropped.
- **Citation check in code:** every cited id must exist in the evidence we sent. A reason with an unknown citation is rejected.
- Cost control: K is capped, token usage is logged per run, and the AWS budget alert is set before the first call (CLAUDE.md guardrail 8).
- Until AWS access exists, stage 3 sits behind a small interface with a fake scorer for tests, so slices 1–3 and 5 are not blocked.

**Combining.** `score = round(w_fit × topical_fit + w_rec × recency + w_ev × evidence_strength)`. Starting weights are 0.6 / 0.2 / 0.2 (assumption A1). One gate applies: if `topical_fit` is under 40 the band is `weak` no matter how recent or well-evidenced the candidate is. Recency and strength never rescue an off-topic match.

## 5. Uncertainty rules (hard requirements)

1. A weak match is shown as weak. The tool never inflates a score to fill a list.
2. If the evidence is too thin to judge, the band is `insufficient` and the score is null. It is not shown as a low score.
3. Flags are computed from the data and shown with every match: `STALE_PROFILE` (source older than a configured age, for example CVs from 2018), `THIN_EVIDENCE`, `NO_RECENT_ACTIVITY`, `SINGLE_PROJECT`, `BASELINE_DISAGREES` (the baseline rank and the model's judgment differ a lot), `SYNTHETIC_DATA`.
4. `not_checked` always lists the checks the tool does not do: conflict of interest, export control, faculty availability and interest, IP ownership. The tool does not infer any of these.
5. The tool never states or implies that a researcher is willing or available. At most it says the evidence shows past or current work in the area.
6. Output with synthetic inputs carries `synthetic: true`.

## 6. Evaluation

**Smoke test (synthetic, available now).** Two synthetic CVs (Morgan Ellis, materials/additive manufacturing; Jordan Rivera, biomedical/mRNA) against the eight sample partners. Expected: Ellis ranks Boeing, GE Aerospace, Lockheed Martin, and Corning high. Rivera ranks Pfizer and Merck high. Neither matches NVIDIA or Dow well, which are negative controls. This only checks that the pipeline behaves sensibly. **It is not validation evidence.** The data is fictional and written to match.

**Real evaluation (blocked on CEC).** It needs the 10–20 known past matches (N2) and two or three CEC reviewers (N1).

- *Retrieval:* for each known match, build the profiles from information dated **before** the collaboration, then check whether the partner appears in the top 10 (recall@10). Using later information would leak the answer.
- *Quality:* reviewers rate a sample of matches for usefulness and for whether the explanation and evidence earn their trust.
- *Comparison:* baseline alone against baseline plus LLM, on the same cases.
- *Cost:* tokens, dollars, and seconds per query.

Phase 1 does not claim accuracy. It claims a working pipeline, a defined evaluation, and an honest first look at the results.

## 7. Acceptance criteria

1. Profiles, evidence, and matches validate against the models. A record without provenance is rejected with a clear error.
2. The JSON schema for the Match and the result file is published, and Noble confirms it is usable.
3. With the fake scorer, the full pipeline runs end to end offline on the synthetic data and produces Match JSON for both workflows.
4. The synthetic smoke expectations in section 6 hold, including both negative controls.
5. Any cited evidence id not present in the input is rejected, and a test proves it.
6. A candidate with too little evidence returns `insufficient` and a null score, and a test proves it.
7. Invalid model JSON is retried twice, then marked `insufficient`. Nothing crashes and nothing is dropped silently.
8. Every Match lists `not_checked`. No code path sends a message.
9. With Bedrock access: one real run on synthetic data completes, logs token usage, and stays under a cost cap we set first.
10. Each slice passes `pytest` and `ruff`, and a person other than the author reviews its PR.

## 8. Assumptions the CEC meetings will test

Everything below is a hypothesis. They are set in config, not hard-coded, so CEC answers change values rather than structure. The full question list ID that resolves each is in the last column. The third column letter and integer combinations each map to a question on a separate document, these questions should answer what are currently assumptions.

| #  | Assumption                                                                              | Resolved by Questions: |
| -- | --------------------------------------------------------------------------------------- | ---------------------- |
| A1 | Weights 0.6 topical fit / 0.2 recency / 0.2 evidence strength, and which evidence kinds count most | F1, F4, F11 |
| A2 | "Success" will be measured as a known past match found in the top 10                    | G1, G2                 |
| A3 | A list of about 10 candidates is useful; top 5 may be better                            | F12                    |
| A4 | Evidence older than about 3 years counts as stale                                       | F8, H6                 |
| A5 | Practical checks (COI, export control, availability) are done by people, not scored     | F6, L1                 |
| A6 | Band cut-offs (strong 75+, moderate 50–74, weak under 50)                              | F4, G8, N5             |
| A7 | One researcher per suggestion, not a team                                               | F7                     |
| A8 | Reasons plus cited evidence is what builds trust                                        | F11, M6                |
| A9 | The company lists can be used as company profiles only once their markers are explained | K5, K6                 |

## 9. Slices (each becomes a board issue)

Sizes are Intern Hub sizes: S is 2–3 hours, M is 4–6 hours. Dependencies are in brackets.

| Slice | Issue title (client's words)                                                                                                    | Size | Needs AWS             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------- |
| 1     | "Profiles and matches have a clear, checked data format" (models, JSON schema, synthetic fixtures; agree with Atharv and Noble) | M    | No                    |
| 2     | "Staff get a shortlist of likely candidates" (baseline retriever) [1]                                                           | M    | No                    |
| 3     | "Each match shows how recent and well-evidenced it is, and warns about gaps" (signals and flags) [1]                            | S    | No                    |
| 4     | "Each match comes with reasons and cited evidence" (Bedrock scorer, citation check, retries; fake scorer first) [1, 2]          | M    | Yes, for the real run |
| 5     | "Staff can run a match and get a ranked list" (assembler, band and gate, CLI, Match JSON) [1, 2, 3, 4]                          | S    | No                    |
| 6     | "The team can measure how good the matches are" (smoke tests, evaluation harness) [1–5]                                        | M    | No                    |

Estimated total: about 25 hours, with Ian's share around 8 hours a week. The team's real build capacity is about 13–14 hours a week, shared with Atharv's and Noble's work. **This will not finish inside the Oct 15–22 Phase 1 window.** Slices 1, 2, 3 and 5 are realistic to start immediately, and slice 4's real run waits on the sandbox. Phase 1 scope and dates are Andy's to confirm, and I will not assume them.

## 10. Risks and open questions

- **No Tech Lead yet.** Approval waits for that person. Until then the review is Atharv and Noble on data shapes, and Andy on scope.
- **Data shapes depend on Atharv.** What can his CV extraction produce reliably? The 20 real CVs vary widely in format and age. The fields in section 3 may need trimming.
- **AWS sandbox not provisioned.** Slice 4's real run and any embeddings work wait on it. The sandbox checklist is in `docs/aws-sandbox-needs.md`.
- **Real-CV clearance is unresolved.** Until it is, only synthetic and public data feed anything cloud-bound.
- **No real ground truth yet.** Without CEC's past matches (N2), results show that the pipeline works, not that the matches are good.
- **The CEC may reshape the workflow.** Assumptions A1–A9 are the places most likely to change.
- **Company data is thin.** The lead lists are bare names. Useful company profiles need focus areas from public sources, which is Atharv's side. Without them workflow 2 has little to match on.

## 11. Approval

- [x] Atharv: data contracts (section 3) are producible
- [x] Noble: Match output (section 3) is usable for the frontend
- [x] Andy: scope and dates (sections 2 and 9) acknowledged
- [ ] Tech Lead: spec approved (none assigned yet)

Once approved, each slice gets a board issue, a branch (`feat/<issue>-short-name`), and a draft PR that links this spec.
