# Workflows & rules

All rules live in `shared/rules.ts`. They are checked in the browser for instant feedback and **enforced on the server** (`server/validate.ts`).

## Opportunity stages

| Stage | Meaning |
|---|---|
| New opportunity | Logged, not yet scoped |
| Needs discovery | Clarifying what the company actually needs |
| Matching | Identifying faculty, programs or technologies |
| Internal review | A person is checking the recommendation and evidence |
| Introduction prepared | A draft exists. **Nothing has been sent** |
| Introduction recorded | Staff recorded that *they* sent an introduction outside the platform |
| Discussion underway | The parties are talking |
| Agreement / outcome | An outcome has been recorded |
| Closed or archived | No further action, with a reason |

### Workflows by type

| Type | Stages used |
|---|---|
| Sponsored research, Faculty collaboration, Technology licensing | all |
| Recruiting partnership | skips both *Introduction* stages |
| Research center engagement | skips both *Introduction* stages |
| Event / brand engagement | skips *Matching* and both *Introduction* stages |

On the board, columns a card's type doesn't use are disabled while you drag it.

### Transition guards (`canTransition`)

| Moving to | Requirement |
|---|---|
| A stage the type doesn't use | blocked |
| Introduction prepared | an **approved** match or introduction review for this opportunity. Asks for confirmation ("does not send anything") |
| Introduction recorded | approved review **and** a draft recorded as sent |
| Agreement / outcome (forward) | an outcome recorded on the way in |
| Closed | a close reason |
| Internal review with no researchers (research types) | allowed, with a warning |
| Any earlier stage | allowed, with confirmation. History keeps the earlier entry |

A new opportunity cannot be *created* at an introduction stage.

## Reviews

Kinds: match recommendation, proposed introduction, low-confidence match, faculty verification, company information, data conflict, incomplete opportunity, IP review (OTT).

| Rule | Where |
|---|---|
| Only **reviewer** or **admin** roles decide | `canDecide` + `roles.ts` |
| **Approve** requires every checklist item ticked | `canDecide` |
| **Reject** and **Request changes** require a comment | `canDecide` |
| Outreach-related kinds (match, introduction, low-confidence) are **never bulk-approved** | `OUTREACH_REVIEW_KINDS` |
| Decided items must be reopened before deciding again | `canDecide` |
| New review items must start as pending | `validate.ts` |
| Approving your own outreach request asks for confirmation (two-person rule recommended) | UI |

Approving a faculty-verification review stamps the profile as verified. Approving a data-conflict review resolves the linked issue. Approving an IP review clears the IP's review flag.

## Introduction drafts

| Rule | Where |
|---|---|
| A draft can be created only for a researcher with an approved review on that opportunity | `canCreateDraft` |
| *Record as sent* requires a non-empty draft and a channel ("Email from my Outlook") | `canRecordSent` |
| A recorded draft can't go back to draft | `validate.ts` |
| Creating the first draft moves the opportunity to *Introduction prepared*. Recording it moves it to *Introduction recorded* | `actions.ts` |

The draft text is a template filled from the match evidence and the open unknowns. It is not AI-generated. Staff edit it, copy it into their own email client, and send it themselves.

## Outcomes

Recorded by staff on an opportunity (`OUTCOME_LABELS`). They feed analytics and [matcher evaluation](matching/evaluation.md), and are always kept separate from match scores.

## Changing the rules

1. Edit `shared/rules.ts`.
2. Add or adjust tests in `shared/rules.test.ts` and `server/validate.test.ts`.
3. The UI picks up the change automatically: buttons are disabled with the rule's own reason as a tooltip.

Open process questions (e.g. where the Bursar fits) are tracked in [open-questions.md](open-questions.md). Add a stage for an administrative handoff only once the process is confirmed.
