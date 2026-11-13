"""Internal records built from the data team's files (spec 002, section 3).

Unknown stays unknown: a missing count or score is None, never 0 or False, so the scorer can leave
it out instead of counting it against anyone.
"""

import datetime as dt
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Annotated

from pydantic import Field

from fime_matching.models import Contract, Evidence, Id, PartialDate, Provenance, Text

Count = Annotated[int, Field(ge=0)]
Share = Annotated[float, Field(ge=0, le=1)]


class Direction(StrEnum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class TopicWeight(Contract):
    topic_id: Id
    label: Text
    weight: Share | None = None


class OpenAlexTopic(Contract):
    openalex_id: Text
    label: Text
    subfield: Text | None = None
    works: Count | None = None


class Faculty(Contract):
    id: Id
    name: Text
    department: Text | None = None
    topics: list[TopicWeight] = Field(default_factory=list)
    openalex_topics: list[OpenAlexTopic] = Field(default_factory=list)
    works_last_5y: Count | None = None
    h_index: Count | None = None
    last_pub_year: Annotated[int, Field(ge=1000, le=3000)] | None = None
    active_grants: Count | None = None
    patents: Count | None = None
    prior_industry_collabs: Count | None = None
    open_to_industry: bool | None = None
    synthetic: bool
    provenance: Provenance
    provenance_derived: bool = False
    evidence: list[Evidence] = Field(default_factory=list)


class Signal(Contract):
    """One thing a company is doing, as one line of the company file."""

    id: Id
    company_id: Id
    kind: Text
    field_text: Text
    topics: list[TopicWeight] = Field(default_factory=list)
    direction: Direction
    strength: Annotated[int, Field(ge=1, le=5)] | None = None
    event_date: PartialDate | None = None
    age_days: Count | None = None
    as_of: dt.date
    is_replay: bool
    synthetic: bool
    verifiers: list[Text] | None = None
    copub_faculty_ids: list[Id] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)


class Company(Contract):
    id: Id
    name: Text
    ticker: Text | None = None
    hq_state: Text | None = None
    signals: list[Signal]
    score: Annotated[float, Field(ge=0, le=10)] | None = None
    momentum: Text | None = None
    psu_engaged: bool | None = None
    alumni_count: Count | None = None


@dataclass
class LoadReport:
    """What a load did, so nothing is dropped or defaulted silently."""

    rows: int = 0
    used: int = 0
    excluded_unverified: int = 0
    replays: int = 0
    replays_inferred: int = 0
    no_topic: int = 0
    partial_dates: int = 0
    unreadable_dates: int = 0
    retrieved_at_defaulted: int = 0
    provenance_derived: int = 0
    duplicate_evidence_dropped: int = 0
    unknown_fields: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def lines(self) -> list[str]:
        counts = [
            ("rows read", self.rows),
            ("records used", self.used),
            ("excluded (not verified)", self.excluded_unverified),
            ("backtest replays", self.replays),
            ("  of which inferred from an old as_of", self.replays_inferred),
            ("signals with no topic", self.no_topic),
            ("event dates year or month only", self.partial_dates),
            ("event dates unreadable", self.unreadable_dates),
            ("evidence retrieved_at set to the run date", self.retrieved_at_defaulted),
            ("provenance derived", self.provenance_derived),
            ("duplicate evidence dropped", self.duplicate_evidence_dropped),
        ]
        out = [f"{label}: {n}" for label, n in counts if n]
        if self.unknown_fields:
            out.append("unknown fields ignored: " + ", ".join(self.unknown_fields))
        out += [f"warning: {w}" for w in self.warnings]
        return out
