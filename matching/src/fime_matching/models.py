"""Data contracts for profiles, evidence, and match results (spec 001, section 3).

Every fact carries provenance. These models reject anything that breaks the contract, so bad data
fails loudly at load time instead of quietly producing a wrong match.
"""

import datetime as dt
import re
from enum import StrEnum
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)


class SourceType(StrEnum):
    CV = "cv"
    COMPANY_SITE = "company_site"
    GRANT_DB = "grant_db"
    PATENT_DB = "patent_db"
    OTT = "ott"
    CEC_LIST = "cec_list"
    SYNTHETIC = "synthetic"
    SEC_FILING = "sec_filing"
    JOB_POSTING = "job_posting"
    SOCIAL_POST = "social_post"
    NEWS = "news"
    MARKET_DATA = "market_data"
    PROFILE = "profile"
    OPENALEX = "openalex"
    LINKEDIN = "linkedin"


class EvidenceKind(StrEnum):
    PUBLICATION = "publication"
    GRANT = "grant"
    PATENT = "patent"
    SBIR_STTR = "sbir_sttr"
    STATEMENT = "statement"
    ENGAGEMENT = "engagement"
    COMPANY_SIGNAL = "company_signal"
    PROFILE_STAT = "profile_stat"


class EvidenceStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PENDING = "pending"
    GRANTED = "granted"


class Relationship(StrEnum):
    EXISTING = "existing"
    PROSPECT = "prospect"
    UNKNOWN = "unknown"


class Band(StrEnum):
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"
    INSUFFICIENT = "insufficient"


class FlagCode(StrEnum):
    STALE_PROFILE = "STALE_PROFILE"
    THIN_EVIDENCE = "THIN_EVIDENCE"
    NO_RECENT_ACTIVITY = "NO_RECENT_ACTIVITY"
    SINGLE_PROJECT = "SINGLE_PROJECT"
    BASELINE_DISAGREES = "BASELINE_DISAGREES"
    SYNTHETIC_DATA = "SYNTHETIC_DATA"
    NEGATIVE_SIGNAL = "NEGATIVE_SIGNAL"
    CONFLICTING_SIGNALS = "CONFLICTING_SIGNALS"
    NOT_OPEN_TO_INDUSTRY = "NOT_OPEN_TO_INDUSTRY"


class Workflow(StrEnum):
    RESEARCHER_TO_COMPANIES = "researcher_to_companies"
    COMPANY_NEED_TO_RESEARCHERS = "company_need_to_researchers"


class QueryKind(StrEnum):
    COMPANY_NEED = "company_need"
    RESEARCHER = "researcher"


class CandidateKind(StrEnum):
    COMPANY = "company"
    RESEARCHER = "researcher"


_PARTIAL_DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")
_LOCAL_PATH = re.compile(r"^([A-Za-z]:[\\/]|\\\\|/(Users|home)/)")


def _check_partial_date(value: str) -> str:
    if not _PARTIAL_DATE.match(value):
        raise ValueError("expected YYYY, YYYY-MM, or YYYY-MM-DD")
    year, *rest = (int(part) for part in value.split("-"))
    month = rest[0] if rest else 1
    day = rest[1] if len(rest) > 1 else 1
    dt.date(year, month, day)  # raises ValueError for month 13, Feb 30, year 0000
    return value


# CVs often give only a year, so dates are allowed at year, month, or day precision.
PartialDate = Annotated[str, AfterValidator(_check_partial_date)]
Id = Annotated[str, StringConstraints(min_length=1, pattern=r"^\S+$")]
Text = Annotated[str, StringConstraints(min_length=1)]
Score = Annotated[int, Field(ge=0, le=100)]


class Contract(BaseModel):
    """Base for every record. Unknown fields are errors so a misspelled field is caught."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Provenance(Contract):
    source_type: SourceType
    source_ref: Text
    retrieved_at: dt.date
    as_of: PartialDate | None = None

    @field_validator("source_ref")
    @classmethod
    def _not_a_local_path(cls, value: str) -> str:
        if _LOCAL_PATH.match(value):
            raise ValueError("source_ref must be a URL or document id, not a local file path")
        return value


_STATUS_KINDS = {EvidenceKind.GRANT, EvidenceKind.PATENT, EvidenceKind.SBIR_STTR}


class Evidence(Contract):
    id: Id
    kind: EvidenceKind
    text: Text
    date: PartialDate | None = None
    status: EvidenceStatus | None = None
    provenance: Provenance

    @model_validator(mode="after")
    def _status_only_where_it_applies(self) -> Self:
        if self.status is not None and self.kind not in _STATUS_KINDS:
            raise ValueError(f"status applies to grants, patents and SBIR/STTR, not {self.kind}")
        return self


def _check_unique_ids(evidence: list[Evidence]) -> None:
    seen: set[str] = set()
    for item in evidence:
        if item.id in seen:
            raise ValueError(f"duplicate evidence id: {item.id}")
        seen.add(item.id)


class ResearcherProfile(Contract):
    id: Id
    display_name: Text
    unit: Text | None = None
    research_areas: list[Text] = []
    evidence: list[Evidence] = []
    provenance: Provenance

    @model_validator(mode="after")
    def _unique_evidence_ids(self) -> Self:
        _check_unique_ids(self.evidence)
        return self


class CompanyProfile(Contract):
    id: Id
    name: Text
    focus_areas: list[Text] = []
    relationship: Relationship = Relationship.UNKNOWN
    evidence: list[Evidence] = []
    provenance: Provenance

    @model_validator(mode="after")
    def _unique_evidence_ids(self) -> Self:
        _check_unique_ids(self.evidence)
        return self


class CompanyNeed(Contract):
    id: Id
    text: Text
    company_id: Id | None = None
    provenance: Provenance


class Reason(Contract):
    text: Text
    evidence_ids: Annotated[list[Id], Field(min_length=1)]


class UncertaintyFlag(Contract):
    code: FlagCode
    note: Text


class Weights(Contract):
    """The weights actually used. A component that was unknown has weight 0."""

    topical_fit: Annotated[float, Field(ge=0, le=1)]
    recency: Annotated[float, Field(ge=0, le=1)]
    evidence_strength: Annotated[float, Field(ge=0, le=1)]
    company_quality: Annotated[float, Field(ge=0, le=1)] = 0
    psu_link: Annotated[float, Field(ge=0, le=1)] = 0

    @model_validator(mode="after")
    def _sum_to_one(self) -> Self:
        total = (
            self.topical_fit
            + self.recency
            + self.evidence_strength
            + self.company_quality
            + self.psu_link
        )
        if abs(total - 1) > 1e-6:
            raise ValueError("weights must add up to 1")
        return self


COMPONENTS = ("topical_fit", "recency", "evidence_strength", "company_quality", "psu_link")


class Breakdown(Contract):
    topical_fit: Score | None
    recency: Score | None
    evidence_strength: Score | None
    company_quality: Score | None = None
    psu_link: Score | None = None
    weights: Weights

    @model_validator(mode="after")
    def _unknown_means_no_weight(self) -> Self:
        values = {name: getattr(self, name) for name in COMPONENTS}
        if self.topical_fit is None:
            if any(v is not None for v in values.values()):
                raise ValueError("breakdown values are all null when the match has no score")
            return self
        for name, value in values.items():
            if (value is None) != (getattr(self.weights, name) == 0):
                raise ValueError(
                    f"{name} must be null exactly when its weight is 0 (an unknown value is "
                    "left out of the score, never counted as zero)"
                )
        return self


class Method(Contract):
    scorer: Text
    scorer_version: Text | None = None
    model_id: Text | None = None
    prompt_version: Text | None = None
    note: Text | None = None


# Band cut-offs and the fit gate (spec 001 section 4 and assumption A6). Change them here only.
STRONG_MIN = 75
MODERATE_MIN = 50
FIT_GATE = 40


def _expected_band(score: int, topical_fit: int) -> Band:
    if topical_fit < FIT_GATE or score < MODERATE_MIN:
        return Band.WEAK
    return Band.STRONG if score >= STRONG_MIN else Band.MODERATE


class Match(Contract):
    query_id: Id
    candidate_id: Id
    score: Score | None
    band: Band
    breakdown: Breakdown
    headline: Text | None = None
    reasons: list[Reason]
    uncertainty: list[UncertaintyFlag]
    not_checked: Annotated[list[Text], Field(min_length=1)]
    method: Method
    generated_at: dt.datetime
    synthetic: bool

    @model_validator(mode="after")
    def _insufficient_means_no_score(self) -> Self:
        if (self.band is Band.INSUFFICIENT) != (self.score is None):
            raise ValueError("score is null exactly when the band is 'insufficient'")
        if (self.breakdown.topical_fit is None) != (self.score is None):
            raise ValueError("breakdown values are null exactly when the score is null")
        if self.band is Band.INSUFFICIENT and not self.uncertainty:
            raise ValueError("an 'insufficient' match must say why in uncertainty")
        return self

    @model_validator(mode="after")
    def _score_agrees_with_breakdown_and_band(self) -> Self:
        if self.score is None:
            return self
        b, w = self.breakdown, self.breakdown.weights
        weighted = sum(getattr(w, name) * (getattr(b, name) or 0) for name in COMPONENTS)
        gated = b.topical_fit < FIT_GATE
        capping = {FlagCode.CONFLICTING_SIGNALS, FlagCode.STALE_PROFILE}
        flagged = any(f.code in capping for f in self.uncertainty)
        # The score is the weighted sum, rounded. The fit gate and the caps for conflicting
        # signals and stale profiles may only pull it down, never up.
        capped = (gated or flagged) and self.score < weighted
        if abs(self.score - weighted) > 0.5 + 1e-9 and not capped:
            raise ValueError(
                f"score {self.score} does not follow from the breakdown (weighted sum is "
                f"{weighted:.1f})"
            )
        expected = _expected_band(self.score, b.topical_fit)
        if self.band is not expected:
            raise ValueError(
                f"band '{self.band}' does not fit score {self.score} with topical fit "
                f"{b.topical_fit}: expected '{expected}' (strong {STRONG_MIN}+, moderate "
                f"{MODERATE_MIN}+, weak below, and weak whenever topical fit is under {FIT_GATE})"
            )
        if self.band is Band.WEAK and self.score >= MODERATE_MIN:
            raise ValueError(
                f"a weak match must score under {MODERATE_MIN}: the fit gate caps the score, "
                "so a weak match never ranks above a moderate one"
            )
        return self


class Candidate(Contract):
    id: Id
    display_name: Text
    kind: CandidateKind
    detail: Text | None = None


class Query(Contract):
    id: Id
    kind: QueryKind
    display_name: Text
    summary: Text
    evidence_id: Id | None = None


class ResultEntry(Contract):
    rank: Annotated[int, Field(ge=1)] | None
    candidate: Candidate
    match: Match

    @model_validator(mode="after")
    def _rank_matches_score(self) -> Self:
        if (self.rank is None) != (self.match.score is None):
            raise ValueError("rank is null exactly when the match has no score")
        if self.match.candidate_id != self.candidate.id:
            raise ValueError("match.candidate_id does not match candidate.id")
        return self


_EXPECTED_KINDS = {
    Workflow.RESEARCHER_TO_COMPANIES: (QueryKind.RESEARCHER, CandidateKind.COMPANY),
    Workflow.COMPANY_NEED_TO_RESEARCHERS: (QueryKind.COMPANY_NEED, CandidateKind.RESEARCHER),
}


class MatchResultSet(Contract):
    """One result file: the ranked matches for one query, plus what a screen needs to show them."""

    schema_version: Text
    note: Text | None = None
    workflow: Workflow
    synthetic: bool
    run_id: Text | None = None
    generated_at: dt.datetime
    query: Query
    results: list[ResultEntry]
    evidence: dict[Id, Evidence]

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        for key, item in self.evidence.items():
            if key != item.id:
                raise ValueError(f"evidence key {key} does not match its id {item.id}")

        query_kind, candidate_kind = _EXPECTED_KINDS[self.workflow]
        if self.query.kind is not query_kind:
            raise ValueError(f"workflow {self.workflow} needs a query of kind {query_kind}")
        for entry in self.results:
            if entry.candidate.kind is not candidate_kind:
                raise ValueError(f"workflow {self.workflow} lists {candidate_kind} candidates")
            if entry.match.query_id != self.query.id:
                raise ValueError(f"match for {entry.candidate.id} is for a different query")

        cited = {i for e in self.results for r in e.match.reasons for i in r.evidence_ids}
        if self.query.evidence_id:
            cited.add(self.query.evidence_id)
        if missing := sorted(cited - self.evidence.keys()):
            raise ValueError(f"cited evidence ids are not in the evidence lookup: {missing}")

        ids = [e.candidate.id for e in self.results]
        if duplicates := sorted({i for i in ids if ids.count(i) > 1}):
            raise ValueError(f"the same candidate is listed more than once: {duplicates}")

        self._check_order()
        return self

    def _check_order(self) -> None:
        ranks = [e.rank for e in self.results]
        ranked = [r for r in ranks if r is not None]
        if ranks != [*range(1, len(ranked) + 1), *[None] * (len(ranks) - len(ranked))]:
            raise ValueError("results must be ranked 1, 2, 3... with unranked matches last")
        scores = [e.match.score for e in self.results if e.rank is not None]
        if scores != sorted(scores, reverse=True):
            raise ValueError("ranked results must be in descending score order")
