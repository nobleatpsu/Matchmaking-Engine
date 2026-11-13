"""Load and check the data team's faculty and company files (spec 002, section 3).

    python -m fime_matching.load faculty faculty.jsonl --topics topics.json
    python -m fime_matching.load company needs.jsonl --topics topics.json [--faculty faculty.jsonl]

Each file is JSON Lines (one record per line) or a JSON list. Bad records are reported as
`record N (id).field: message`. Odd but usable values (partial dates, missing counts, old replay
rows) are kept as far as they are known and counted in the report, never silently changed.
"""

import argparse
import datetime as dt
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from fime_matching.inputs import (
    Company,
    Direction,
    Faculty,
    LoadReport,
    OpenAlexTopic,
    Signal,
    TopicWeight,
)
from fime_matching.models import (
    Evidence,
    EvidenceKind,
    Provenance,
    SourceType,
    _check_partial_date,
)

INPUT_VERSIONS = {"0.1"}
REPLAY_AFTER_DAYS = 30  # no replay marker yet: an as_of older than this is a backtest replay
OVERUSED_TOPIC_SHARE = 0.25

# The data team's source names mapped to ours. An unknown name is a load error on purpose, so a
# new source forces a deliberate decision (spec 002, section 3).
SOURCE_TYPES = {
    "edgar_10k": SourceType.SEC_FILING,
    "edgar_8k": SourceType.SEC_FILING,
    "uspto": SourceType.PATENT_DB,
    "linkedin_jobs": SourceType.JOB_POSTING,
    "linkedin_post": SourceType.SOCIAL_POST,
    "market_data": SourceType.MARKET_DATA,
    "catalyst": SourceType.MARKET_DATA,
    "news": SourceType.NEWS,
    "news_rss": SourceType.NEWS,
    "openalex": SourceType.OPENALEX,
    "linkedin_company_employees": SourceType.LINKEDIN,
}

_OPENALEX_AUTHOR = re.compile(r"^A\d+$")


class InputError(Exception):
    """One or more records are invalid. `errors` holds one readable line per problem."""

    def __init__(self, errors: list[str]) -> None:
        super().__init__("\n".join(errors))
        self.errors = errors


# --- raw shapes (what the files contain) ------------------------------------------------------


class _Raw(BaseModel):
    """Extra fields are allowed here and reported, so a new field never stops a load."""

    model_config = ConfigDict(extra="allow")


class RawTopic(_Raw):
    topic_id: str
    label: str
    weight: float | None = None
    oa_label: str | None = None


class RawOpenAlexTopic(_Raw):
    openalex_id: str
    label: str
    subfield: str | None = None
    works: int | None = None


class RawFaculty(_Raw):
    schema_version: str
    synthetic: bool
    faculty_id: str
    name: str
    department: str | None = None
    topics: list[RawTopic] = []
    openalex_topics: list[RawOpenAlexTopic] = []
    works_last_5y: int | None = None
    h_index: int | None = None
    last_pub_year: int | None = None
    active_grants: int | None = None
    patents: int | None = None
    prior_industry_collabs: int | None = None
    open_to_industry: bool | None = None
    source_ref: str | None = None
    retrieved_at: str | None = None


class RawCompanyRef(_Raw):
    company_id: str
    name: str
    ticker: str | None = None
    hq_state: str | None = None


class RawNeed(_Raw):
    kind: str
    summary: str
    topics: list[RawTopic] = []
    direction: Direction
    strength: int | None = None
    event_date: str | None = None
    age_days: int | None = None


class RawQuality(_Raw):
    score: float | None = None
    momentum_theme: Any = None
    signals_last_7d: int | None = None


class RawPsuLinks(_Raw):
    alumni_count: int | None = None
    psu_engaged: bool | None = None
    copub_faculty_ids: list[str] = []


class RawEvidence(_Raw):
    evidence_id: str
    source: str
    url: str | None = None
    fetched: str | None = None
    verified_by: list[str] | None = None
    excerpt: str | None = None


class RawSignal(_Raw):
    schema_version: str
    as_of: str
    synthetic: bool
    need_id: str
    company: RawCompanyRef
    need: RawNeed
    company_quality: RawQuality = RawQuality()
    psu_links: RawPsuLinks = RawPsuLinks()
    evidence: list[RawEvidence] = []
    status: str
    replay: bool | None = None


# --- reading helpers --------------------------------------------------------------------------


def _where(n: int, rec_id: str | None, loc: tuple[int | str, ...] = ()) -> str:
    label = f"record {n}" + (f" ({rec_id})" if rec_id else "")
    return ".".join([label, *map(str, loc)]) if loc else label


def _read_rows(path: Path, errors: list[str]) -> list[tuple[int, dict]]:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"{path}: cannot read: {exc}")
        return []
    rows: list[tuple[int, dict]] = []
    if text.lstrip().startswith("["):
        try:
            records = json.loads(text)
        except json.JSONDecodeError as exc:
            errors.append(f"{path.name}: not valid JSON: {exc}")
            return []
    else:
        records = []
        for line_no, line in enumerate(text.splitlines(), start=1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                errors.append(f"{path.name} line {line_no}: not valid JSON: {exc}")
                records.append(None)
    for n, record in enumerate(records):
        if isinstance(record, dict):
            rows.append((n, record))
        elif record is not None:
            errors.append(f"record {n}: expected a JSON object")
    return rows


def _collect_extras(value: Any, prefix: str, sink: set[str]) -> None:
    if isinstance(value, BaseModel):
        for key in value.model_extra or {}:
            sink.add(f"{prefix}{key}")
        for name in type(value).model_fields:
            _collect_extras(getattr(value, name), f"{prefix}{name}.", sink)
    elif isinstance(value, list):
        for item in value:
            _collect_extras(item, prefix, sink)


def _parse(model: type[BaseModel], n: int, row: dict, id_key: str, errors: list[str], extras: set):
    rec_id = row.get(id_key) if isinstance(row.get(id_key), str) else None
    try:
        raw = model.model_validate(row)
    except ValidationError as exc:
        errors += [f"{_where(n, rec_id, e['loc'])}: {e['msg']}" for e in exc.errors()]
        return None
    _collect_extras(raw, "", extras)
    return raw


def _full_date(value: str | None) -> dt.date | None:
    try:
        return dt.date.fromisoformat(value) if value else None
    except ValueError:
        return None


def load_topics(path: Path) -> dict[str, str]:
    """topics.json: topic id -> label."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise InputError([f"{path}: cannot read topics: {exc}"]) from exc
    if not isinstance(data, dict) or not all(isinstance(v, str) for v in data.values()):
        raise InputError([f"{path.name}: expected an object of topic id to label"])
    return data


def _topics(raws: list[RawTopic], known: dict[str, str], where: str, errors, report):
    out = []
    for i, t in enumerate(raws):
        if t.topic_id not in known:
            errors.append(f"{where}.topics.{i}.topic_id: unknown topic id {t.topic_id}")
            continue
        if known[t.topic_id] != t.label:
            report.warnings.append(
                f"{where}: topic {t.topic_id} is labelled '{t.label}', topics file says "
                f"'{known[t.topic_id]}'"
            )
        out.append({"topic_id": t.topic_id, "label": t.label, "weight": t.weight})
    return out


def _finish(errors: list[str], extras: set[str], report: LoadReport) -> None:
    report.unknown_fields = sorted(extras)
    if errors:
        raise InputError(errors)


# --- faculty ----------------------------------------------------------------------------------


def _faculty_evidence(raw: RawFaculty, prov: Provenance) -> list[Evidence]:
    items = []
    parts = []
    if raw.works_last_5y is not None:
        parts.append(f"{raw.works_last_5y} works in the last 5 years")
    if raw.last_pub_year is not None:
        parts.append(f"last published in {raw.last_pub_year}")
    if raw.h_index is not None:
        parts.append(f"h-index {raw.h_index}")
    if parts:
        items.append(Evidence(id=f"{raw.faculty_id}:activity", kind=EvidenceKind.PROFILE_STAT,
                              text=raw.name + ": " + ", ".join(parts) + ".", provenance=prov))
    shares = [f"{t.label} {round(100 * t.weight)}%" for t in raw.topics if t.weight is not None]
    if shares:
        items.append(Evidence(id=f"{raw.faculty_id}:topics", kind=EvidenceKind.PROFILE_STAT,
                              text="Share of works by topic: " + ", ".join(shares) + ".",
                              provenance=prov))
    return items


def load_faculty(
    path: Path, topics: dict[str, str], run_date: dt.date | None = None
) -> tuple[list[Faculty], LoadReport]:
    run_date = run_date or dt.date.today()
    report, errors, extras = LoadReport(), [], set()
    out: list[Faculty] = []
    seen: dict[str, int] = {}
    for n, row in _read_rows(path, errors):
        report.rows += 1
        raw = _parse(RawFaculty, n, row, "faculty_id", errors, extras)
        if raw is None:
            continue
        where = _where(n, raw.faculty_id)
        if raw.schema_version not in INPUT_VERSIONS:
            errors.append(f"{where}.schema_version: unknown version '{raw.schema_version}'")
            continue
        if raw.faculty_id in seen:
            errors.append(f"{where}.faculty_id: duplicate, already used by record "
                          f"{seen[raw.faculty_id]}")
            continue
        seen[raw.faculty_id] = n

        ref = raw.source_ref
        if raw.synthetic:
            ref = ref or f"synthetic:{path.name}#{raw.faculty_id}"
            source_type = SourceType.SYNTHETIC
        else:
            source_type = SourceType.OPENALEX
            if not ref and _OPENALEX_AUTHOR.match(raw.faculty_id):
                ref = f"https://openalex.org/{raw.faculty_id}"
        if not ref:
            errors.append(f"{where}.source_ref: missing, and the id is not an OpenAlex author id")
            continue
        retrieved = _full_date(raw.retrieved_at)
        derived = raw.source_ref is None or retrieved is None
        report.provenance_derived += derived
        try:
            prov = Provenance(source_type=source_type, source_ref=ref,
                              retrieved_at=retrieved or run_date)
            faculty = Faculty(
                id=raw.faculty_id, name=raw.name, department=raw.department,
                topics=[TopicWeight(**t) for t in _topics(raw.topics, topics, where, errors, report)],
                openalex_topics=[OpenAlexTopic(**t.model_dump(exclude_none=True))
                                 for t in raw.openalex_topics],
                works_last_5y=raw.works_last_5y, h_index=raw.h_index,
                last_pub_year=raw.last_pub_year, active_grants=raw.active_grants,
                patents=raw.patents, prior_industry_collabs=raw.prior_industry_collabs,
                open_to_industry=raw.open_to_industry, synthetic=raw.synthetic,
                provenance=prov, provenance_derived=derived,
                evidence=_faculty_evidence(raw, prov),
            )
        except ValidationError as exc:
            errors += [f"{where}.{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()]
            continue
        total = sum(t.weight or 0 for t in faculty.topics)
        if total > 1.05:
            report.warnings.append(f"{where}: topic shares add up to {total:.2f}, expected 1 or less")
        out.append(faculty)
        report.used += 1
    _finish(errors, extras, report)
    return out, report


# --- companies --------------------------------------------------------------------------------


def _signal_evidence(raw: RawSignal, event_date: str | None, run_date: dt.date,
                     report: LoadReport, where: str, errors: list[str]) -> list[Evidence]:
    items, seen = [], set()
    for i, e in enumerate(raw.evidence):
        if e.source not in SOURCE_TYPES:
            errors.append(f"{where}.evidence.{i}.source: unmapped source '{e.source}'")
            continue
        if e.evidence_id in seen:
            report.duplicate_evidence_dropped += 1
            continue
        seen.add(e.evidence_id)
        retrieved = _full_date(e.fetched)
        if retrieved is None:
            report.retrieved_at_defaulted += 1
        as_of = e.fetched if e.fetched and not retrieved and _is_partial(e.fetched) else None
        items.append(Evidence(
            id=e.evidence_id, kind=EvidenceKind.COMPANY_SIGNAL, text=e.excerpt or raw.need.summary,
            date=event_date,
            provenance=Provenance(source_type=SOURCE_TYPES[e.source],
                                  source_ref=e.url or f"{e.source}:{raw.need_id}",
                                  retrieved_at=retrieved or run_date, as_of=as_of),
        ))
    return items


def _is_partial(value: str) -> bool:
    try:
        _check_partial_date(value)
    except ValueError:
        return False
    return True


def _signal(raw: RawSignal, n: int, known: dict[str, str], run_date: dt.date,
            report: LoadReport, errors: list[str]) -> Signal | None:
    where = _where(n, raw.need_id)
    before = len(errors)
    as_of = _full_date(raw.as_of)
    if as_of is None:
        errors.append(f"{where}.as_of: expected YYYY-MM-DD, got '{raw.as_of}'")
        return None
    topics = _topics(raw.need.topics, known, where, errors, report)

    event_date = raw.need.event_date
    age = None
    if event_date is not None and not _is_partial(event_date):
        report.unreadable_dates += 1
        event_date = None
    elif event_date is not None:
        full = _full_date(event_date)
        if full is None:
            report.partial_dates += 1
        else:
            age = (run_date - full).days
            if age < 0:
                report.warnings.append(f"{where}: event_date {event_date} is after the run date")
                age = None
            elif raw.need.age_days is not None and raw.need.age_days != age:
                report.warnings.append(
                    f"{where}: age_days {raw.need.age_days} differs from the {age} computed "
                    f"from event_date, using {age}"
                )

    if raw.replay is not None:
        is_replay = raw.replay
    else:
        is_replay = (run_date - as_of).days > REPLAY_AFTER_DAYS
        report.replays_inferred += is_replay
    report.replays += is_replay
    report.no_topic += not topics

    verifiers = None
    if any(e.verified_by is not None for e in raw.evidence):
        verifiers = sorted({v for e in raw.evidence for v in e.verified_by or []})
    try:
        evidence = _signal_evidence(raw, event_date, run_date, report, where, errors)
        if len(errors) > before:
            return None
        return Signal(
            id=raw.need_id, company_id=raw.company.company_id, kind=raw.need.kind,
            field_text=raw.need.summary, topics=[TopicWeight(**t) for t in topics],
            direction=raw.need.direction, strength=raw.need.strength, event_date=event_date,
            age_days=age, as_of=as_of, is_replay=is_replay, synthetic=raw.synthetic,
            verifiers=verifiers, copub_faculty_ids=raw.psu_links.copub_faculty_ids,
            evidence=evidence,
        )
    except ValidationError as exc:
        errors += [f"{where}.{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()]
        return None


def _momentum(value: Any) -> str | None:
    if value is None or isinstance(value, str):
        return value
    return json.dumps(value, sort_keys=True)


def _company(signals: list[tuple[RawSignal, Signal]], report: LoadReport) -> Company:
    latest = max(signals, key=lambda pair: pair[0].as_of)[0]  # first of the newest as_of
    first = signals[0][0]
    for label, getter in (
        ("score", lambda r: r.company_quality.score),
        ("momentum", lambda r: _momentum(r.company_quality.momentum_theme)),
        ("psu_engaged", lambda r: r.psu_links.psu_engaged),
        ("alumni_count", lambda r: r.psu_links.alumni_count),
    ):
        values = {getter(r) for r, _ in signals if getter(r) is not None}
        if len(values) > 1:
            report.warnings.append(f"{first.company.name}: signals disagree on {label}: "
                                   f"{sorted(map(str, values))}, using the newest")
    return Company(
        id=first.company.company_id, name=first.company.name, ticker=first.company.ticker,
        hq_state=first.company.hq_state, signals=[s for _, s in signals],
        score=latest.company_quality.score,
        momentum=_momentum(latest.company_quality.momentum_theme),
        psu_engaged=latest.psu_links.psu_engaged, alumni_count=latest.psu_links.alumni_count,
    )


def load_company_needs(
    path: Path,
    topics: dict[str, str],
    run_date: dt.date | None = None,
    faculty_ids: set[str] | None = None,
) -> tuple[list[Company], list[Signal], LoadReport]:
    """Return (companies built from live signals, backtest replay signals, report)."""
    run_date = run_date or dt.date.today()
    report, errors, extras = LoadReport(), [], set()
    live: dict[str, list[tuple[RawSignal, Signal]]] = {}
    replays: list[Signal] = []
    seen: dict[str, int] = {}
    topic_counts: Counter[str] = Counter()
    for n, row in _read_rows(path, errors):
        report.rows += 1
        raw = _parse(RawSignal, n, row, "need_id", errors, extras)
        if raw is None:
            continue
        where = _where(n, raw.need_id)
        if raw.schema_version not in INPUT_VERSIONS:
            errors.append(f"{where}.schema_version: unknown version '{raw.schema_version}'")
            continue
        if raw.need_id in seen:
            errors.append(f"{where}.need_id: duplicate, already used by record {seen[raw.need_id]}")
            continue
        seen[raw.need_id] = n
        if raw.status != "verified":
            report.excluded_unverified += 1
            continue
        for fid in raw.psu_links.copub_faculty_ids:
            if faculty_ids is not None and fid not in faculty_ids:
                errors.append(f"{where}.psu_links.copub_faculty_ids: {fid} is not a loaded "
                              "faculty id")
        signal = _signal(raw, n, topics, run_date, report, errors)
        if signal is None:
            continue
        report.used += 1
        topic_counts.update({t.topic_id for t in signal.topics})
        if signal.is_replay:
            replays.append(signal)
        else:
            live.setdefault(signal.company_id, []).append((raw, signal))

    for topic_id, count in topic_counts.most_common():
        if report.used and count / report.used > OVERUSED_TOPIC_SHARE:
            report.warnings.append(
                f"topic {topic_id} ({topics.get(topic_id, '?')}) tags {count} of {report.used} "
                "signals; check the tagger is not using it as a fallback"
            )
    _finish(errors, extras, report)
    return [_company(pairs, report) for pairs in live.values()], replays, report


# --- command line -----------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check the faculty or company file.")
    parser.add_argument("kind", choices=["faculty", "company"])
    parser.add_argument("file", type=Path)
    parser.add_argument("--topics", type=Path, required=True)
    parser.add_argument("--faculty", type=Path, help="faculty file, to check co-publication ids")
    args = parser.parse_args(argv)

    try:
        topics = load_topics(args.topics)
        if args.kind == "faculty":
            records, report = load_faculty(args.file, topics)
            summary = f"{len(records)} researcher(s)"
        else:
            faculty_ids = None
            if args.faculty:
                people, _ = load_faculty(args.faculty, topics)
                faculty_ids = {p.id for p in people}
            companies, replays, report = load_company_needs(args.file, topics,
                                                            faculty_ids=faculty_ids)
            summary = f"{len(companies)} live company(ies), {len(replays)} replay signal(s)"
    except InputError as exc:
        print("\n".join(exc.errors))
        print(f"INVALID: {len(exc.errors)} problem(s) in {args.file}")
        return 1
    print(f"OK: {summary} in {args.file}")
    print("\n".join(report.lines()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
