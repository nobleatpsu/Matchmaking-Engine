"""Rank scored pairs and build the result file the frontend reads (spec 002, 5.7 and section 4).

A list holds the matches that are moderate or better, up to `top`. Weak matches appear only when
fewer than 3 are moderate or better, and only enough to reach 3, so a list is never padded.
Companies the data says are heading the wrong way show up unranked with the reason.
"""

import datetime as dt
import hashlib
from collections.abc import Sequence

from fime_matching.inputs import Company, Faculty
from fime_matching.models import (
    Band,
    Candidate,
    CandidateKind,
    Evidence,
    FlagCode,
    MatchResultSet,
    Query,
    QueryKind,
    ResultEntry,
    Workflow,
)
from fime_matching.scoring import ScoreConfig, ScoredPair, score_pair
from fime_matching.similarity import TopicSimilarity

SCHEMA_VERSION = "0.2"
MIN_LIST = 3


def sort_key(pair: ScoredPair):
    """Shown score first, then the tie-break chain from the spec, so input order never matters."""
    m, b = pair.match, pair.match.breakdown
    return (
        -(m.score or 0), -(b.topical_fit or 0), -(b.psu_link or 0), -(b.evidence_strength or 0),
        -(b.recency or 0), -(pair.unrounded or 0), m.candidate_id,
    )


def select(pairs: Sequence[ScoredPair], top: int = 10) -> tuple[list[ScoredPair], list[ScoredPair]]:
    """Return (ranked pairs, unranked pairs worth showing), both in display order."""
    scored = sorted((p for p in pairs if p.match.score is not None), key=sort_key)
    strong_enough = [p for p in scored if p.match.band is not Band.WEAK]
    ranked = strong_enough[:top]
    if len(strong_enough) < MIN_LIST:
        weak = [p for p in scored if p.match.band is Band.WEAK]
        ranked += weak[: MIN_LIST - len(strong_enough)]
    seen = sorted(
        (p for p in pairs
         if p.match.score is None
         and any(f.code is FlagCode.NEGATIVE_SIGNAL for f in p.match.uncertainty)),
        key=lambda p: p.match.candidate_id,
    )
    return ranked, seen


def _percent(faculty: Faculty) -> str:
    shares = [f"{t.label} {round(100 * t.weight)}%" for t in faculty.topics if t.weight is not None]
    return ", ".join(shares[:4])


def _researcher_detail(f: Faculty) -> str:
    parts = [f.department] if f.department else []
    if f.last_pub_year:
        parts.append(f"last published {f.last_pub_year}")
    return "; ".join(parts) or "no department or publication year in the data"


def _company_detail(pair: ScoredPair, company: Company) -> str:
    for s in company.signals:
        if s.id == pair.matched_signal_id:
            return s.field_text
    return f"{len(company.signals)} current signal(s), none matched"


def run_id(workflow: Workflow, asked: Faculty | Company, candidates: Sequence[Faculty | Company],
           similarity: TopicSimilarity, config: ScoreConfig, run_date: dt.date) -> str:
    """The same inputs give the same id, so a saved decision can say which run it was made on.

    It covers what was read, not only who was in it: every field of the query and of each candidate,
    the topic similarity values and the settings. Change any of them and the id changes."""
    records = [asked.model_dump_json(), *(c.model_dump_json() for c in sorted(candidates, key=lambda c: c.id))]
    text = "|".join([workflow.value, *records, similarity.name, similarity.fingerprint, repr(config),
                     run_date.isoformat()])
    return f"{run_date.isoformat()}-{hashlib.sha256(text.encode()).hexdigest()[:10]}"


def _note(similarity: TopicSimilarity) -> str:
    note = "Starting weights are hand-picked and not validated."
    note += f" Topic similarity: {similarity.name}."
    if not similarity.reviewed:
        note += " The topic matrix has not been reviewed by a second person."
    return note


def _file(workflow: Workflow, query: Query, ranked, seen, candidate_of, detail_of, similarity,
          now, rid) -> MatchResultSet:
    entries, evidence = [], {}
    for rank, pair in enumerate(ranked, start=1):
        entries.append(ResultEntry(rank=rank, candidate=candidate_of(pair, detail_of(pair)),
                                   match=pair.match))
    for pair in seen:
        entries.append(ResultEntry(rank=None, candidate=candidate_of(pair, detail_of(pair)),
                                   match=pair.match))
    for pair in [*ranked, *seen]:
        evidence.update(pair.evidence)
    items: dict[str, Evidence] = {i: e for i, e in evidence.items()}
    return MatchResultSet(
        schema_version=SCHEMA_VERSION, note=_note(similarity), workflow=workflow,
        synthetic=any(e.match.synthetic for e in entries), run_id=rid, generated_at=now,
        query=query, results=entries, evidence=items,
    )


def researcher_to_companies(faculty: Faculty, companies: Sequence[Company], run_date: dt.date,
                            similarity: TopicSimilarity, now: dt.datetime, top: int = 10,
                            config: ScoreConfig | None = None) -> MatchResultSet:
    config = config or ScoreConfig()
    workflow = Workflow.RESEARCHER_TO_COMPANIES
    by_id = {c.id: c for c in companies}
    pairs = [score_pair(faculty, c, workflow, run_date, similarity, now, config) for c in companies]
    ranked, seen = select(pairs, top)
    query = Query(id=faculty.id, kind=QueryKind.RESEARCHER, display_name=faculty.name,
                  summary=_percent(faculty) or "no topic shares in the data")

    def candidate(pair, detail):
        company = by_id[pair.match.candidate_id]
        return Candidate(id=company.id, display_name=company.name, kind=CandidateKind.COMPANY,
                         detail=detail)

    rid = run_id(workflow, faculty, companies, similarity, config, run_date)
    return _file(workflow, query, ranked, seen, candidate,
                 lambda p: _company_detail(p, by_id[p.match.candidate_id]), similarity, now, rid)


def company_to_researchers(company: Company, people: Sequence[Faculty], run_date: dt.date,
                           similarity: TopicSimilarity, now: dt.datetime, top: int = 10,
                           config: ScoreConfig | None = None) -> MatchResultSet:
    config = config or ScoreConfig()
    workflow = Workflow.COMPANY_NEED_TO_RESEARCHERS
    by_id = {p.id: p for p in people}
    pairs = [score_pair(p, company, workflow, run_date, similarity, now, config) for p in people]
    ranked, seen = select(pairs, top)
    live = "; ".join(s.field_text for s in company.signals[:2])
    query = Query(id=company.id, kind=QueryKind.COMPANY_NEED, display_name=company.name,
                  summary=f"{len(company.signals)} current signal(s). {live}")

    def candidate(pair, detail):
        person = by_id[pair.match.candidate_id]
        return Candidate(id=person.id, display_name=person.name, kind=CandidateKind.RESEARCHER,
                         detail=detail)

    rid = run_id(workflow, company, people, similarity, config, run_date)
    return _file(workflow, query, ranked, seen, candidate,
                 lambda p: _researcher_detail(by_id[p.match.candidate_id]), similarity, now, rid)
