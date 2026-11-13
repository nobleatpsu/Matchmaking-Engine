"""Score one researcher against one company (spec 002, section 5).

Every number here is a starting value, kept in `ScoreConfig`, not a validated finding. Anything
unknown is left out of the score and the other weights are scaled up, so a missing value is never
counted against a researcher or a company.
"""

import datetime as dt
from dataclasses import dataclass, field

from fime_matching.inputs import Company, Direction, Faculty, Signal
from fime_matching.models import (
    FIT_GATE,
    MODERATE_MIN,
    Band,
    Breakdown,
    Evidence,
    FlagCode,
    Match,
    Method,
    Reason,
    UncertaintyFlag,
    Weights,
    Workflow,
    _expected_band,
)
from fime_matching.similarity import TopicSimilarity

BASE_WEIGHTS = {
    "topical_fit": 0.50,
    "recency": 0.15,
    "evidence_strength": 0.15,
    "company_quality": 0.10,
    "psu_link": 0.10,
}
ALWAYS_NOT_CHECKED = [
    "conflict of interest",
    "export control",
    "the researcher's availability and interest",
    "who owns any related intellectual property",
]


@dataclass(frozen=True)
class ScoreConfig:
    half_life_days: float = 45
    saturation_share: float = 0.25  # a 25% share of someone's works counts as full expertise
    stale_years: int = 3
    thin_works: int = 5
    near_cover: float = 0.4  # a signal this close to the researcher's topics counts as related
    conflict_ratio: float = 0.5
    conflict_cap: int = 74
    stale_cap: int = 59  # a stale profile can appear but never above a current researcher
    gate_cap: int = MODERATE_MIN - 1
    weights: dict[str, float] = field(default_factory=lambda: dict(BASE_WEIGHTS))


@dataclass
class ScoredPair:
    match: Match
    unrounded: float | None  # for ranking, so near ties are not decided by rounding
    evidence: dict[str, Evidence]
    matched_signal_id: str | None = None
    signals_total: int = 0


@dataclass
class _Candidate:
    signal: Signal
    cover: float  # already halved for a neutral signal
    weight: float
    pair: tuple[str, str, float]  # company topic, researcher topic, closeness


def _decay(days: int | None, config: ScoreConfig) -> float | None:
    return None if days is None else 0.5 ** (days / config.half_life_days)


def _signal_weight(signal: Signal, config: ScoreConfig) -> float:
    strength = 1.0 if signal.strength is None else signal.strength / 5
    return strength * (_decay(signal.age_days, config) or 1.0)


def _cover(signal: Signal, expertise: dict[str, float], sim: TopicSimilarity):
    """How well the researcher's topics cover the signal's topics, 0 to 1, or None if unknown."""
    if not signal.topics or not expertise:
        return None
    total, best_pair = 0.0, ("", "", -1.0)
    for topic in signal.topics:
        closest = max(((sim(topic.topic_id, b) * w, b) for b, w in expertise.items()))
        total += closest[0]
        if closest[0] > best_pair[2]:
            best_pair = (topic.topic_id, closest[1], closest[0])
    return total / len(signal.topics), best_pair


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _scaled(parts: list[tuple[float, float]]) -> float | None:
    """parts are (points earned, points possible) for the known parts only; 0 to 100."""
    possible = sum(p for _, p in parts)
    return 100 * sum(e for e, _ in parts) / possible if possible else None


def _signal_support(best: Signal, n_corroborating: int) -> float | None:
    parts = [(20 * min(1, (n_corroborating - 1) / 2), 20)]
    if best.strength is not None:
        parts.append((60 * best.strength / 5, 60))
    if best.verifiers is not None:
        parts.append((20 * (len(best.verifiers) >= 2), 20))
    return _scaled(parts)


def _track_record(f: Faculty) -> float | None:
    parts = [
        (value, cap, weight)
        for value, cap, weight in (
            (f.works_last_5y, 30, 0.35),
            (f.active_grants, 3, 0.25),
            (f.patents, 5, 0.20),
            (f.prior_industry_collabs, 5, 0.20),
        )
        if value is not None
    ]
    return _scaled([(weight * min(1, value / cap), weight) for value, cap, weight in parts])


def _psu_link(f: Faculty, company: Company, signals: list[Signal]) -> float | None:
    if any(f.id in s.copub_faculty_ids for s in signals):
        return 100.0
    if company.psu_engaged or (company.alumni_count or 0) > 0:
        return min(100.0, 30 * bool(company.psu_engaged) + 8 * min(company.alumni_count or 0, 5))
    return None  # false or null in the company file means "not checked", not "no link"


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


def score_pair(
    faculty: Faculty,
    company: Company,
    workflow: Workflow,
    run_date: dt.date,
    similarity: TopicSimilarity,
    now: dt.datetime,
    config: ScoreConfig | None = None,
) -> ScoredPair:
    config = config or ScoreConfig()
    query_id, candidate_id = (
        (faculty.id, company.id)
        if workflow is Workflow.RESEARCHER_TO_COMPANIES
        else (company.id, faculty.id)
    )
    expertise = {
        t.topic_id: min(1.0, t.weight / config.saturation_share)
        for t in faculty.topics
        if t.weight is not None
    }
    synthetic = faculty.synthetic or any(s.synthetic for s in company.signals)

    eligible: list[_Candidate] = []
    negative: list[_Candidate] = []
    for signal in company.signals:
        result = _cover(signal, expertise, similarity)
        if result is None:
            continue
        cover, pair = result
        if signal.direction is Direction.NEGATIVE:
            negative.append(_Candidate(signal, cover, _signal_weight(signal, config), pair))
        else:
            factor = 0.5 if signal.direction is Direction.NEUTRAL else 1.0
            eligible.append(_Candidate(signal, cover * factor, _signal_weight(signal, config), pair))

    def done(unrounded, match, ev):
        return ScoredPair(match, unrounded, ev, None, len(company.signals))

    def insufficient(code: FlagCode, note: str, headline: str) -> ScoredPair:
        match = _build(
            query_id, candidate_id, None, Band.INSUFFICIENT,
            Breakdown(topical_fit=None, recency=None, evidence_strength=None,
                      weights=Weights(**config.weights)),
            headline, [], [UncertaintyFlag(code=code, note=note)], faculty, company,
            similarity, now, synthetic, [],
        )
        return done(None, match, {})

    if not expertise:
        return insufficient(FlagCode.THIN_EVIDENCE,
                            "The researcher has no topic shares, so there is nothing to compare.",
                            "Not enough to judge: no topic shares for this researcher.")

    near_pos = [c for c in eligible if c.cover >= config.near_cover]
    near_neg = [c for c in negative if c.cover >= config.near_cover]
    if not near_pos and near_neg:
        return insufficient(
            FlagCode.NEGATIVE_SIGNAL,
            "The company's signals near this researcher's topics point away from investing "
            "(for example a pullback), so this is not flagged as an opportunity.",
            "Seen but not flagged: the company's signals in this area are negative.",
        )
    if not eligible:
        return insufficient(FlagCode.THIN_EVIDENCE,
                            "None of the company's signals has a topic we can compare.",
                            "Not enough to judge: the company's signals have no usable topic.")

    best = min(eligible, key=lambda c: (-c.cover, -c.weight, c.signal.id))
    fit = round(100 * best.cover)
    n_corr = max(1, len(near_pos))

    conflict = False
    if near_neg and best.cover >= config.near_cover:
        w_neg = max(c.weight for c in near_neg)
        lo, hi = sorted((best.weight, w_neg))
        conflict = hi > 0 and lo / hi > config.conflict_ratio

    s = best.signal
    signal_rec = None if s.age_days is None else 100 * _decay(s.age_days, config)
    fac_rec = (None if faculty.last_pub_year is None
               else max(0.0, 100 - 20 * (run_date.year - faculty.last_pub_year)))
    support, record = _signal_support(s, n_corr), _track_record(faculty)
    known = {
        "topical_fit": fit,
        "recency": _mean([v for v in (signal_rec, fac_rec) if v is not None]),
        "evidence_strength": _mean([v for v in (support, record) if v is not None]),
        "company_quality": (None if company.score is None
                            else max(0.0, min(100.0, (company.score - 1) / 9 * 100))),
        "psu_link": _psu_link(faculty, company, [c.signal for c in eligible]),
    }
    if known["recency"] is None and known["evidence_strength"] is None:
        return insufficient(FlagCode.THIN_EVIDENCE,
                            "Nothing is known about how recent or how well evidenced this is.",
                            "Not enough to judge: recency and evidence strength are both unknown.")
    values = {n: round(v) for n, v in known.items() if v is not None}

    total = sum(config.weights[n] for n in values)
    weights = {n: round(config.weights[n] / total, 4) for n in values}
    weights["topical_fit"] = round(1 - sum(v for n, v in weights.items() if n != "topical_fit"), 4)
    raw = sum(weights[n] * values[n] for n in values)
    year = faculty.last_pub_year
    stale = year is not None and run_date.year - year > config.stale_years
    cap = min(
        config.gate_cap if fit < FIT_GATE else 100,
        config.conflict_cap if conflict else 100,
        config.stale_cap if stale else 100,
    )
    score = min(round(raw), cap)
    band = _expected_band(score, fit)

    breakdown = Breakdown(
        **{n: values.get(n) for n in BASE_WEIGHTS},
        weights=Weights(**{n: weights.get(n, 0) for n in BASE_WEIGHTS}),
    )
    flags = _flags(faculty, s, n_corr, conflict, synthetic, run_date, config)
    reasons, ev = _reasons(faculty, company, best, len(company.signals), known["psu_link"])
    headline = _headline(band, best, company, faculty)
    match = _build(query_id, candidate_id, score, band, breakdown, headline, reasons, flags,
                   faculty, company, similarity, now, synthetic, _unknown(known, faculty))
    return ScoredPair(match, min(raw, cap), ev, s.id, len(company.signals))


def _unknown(known: dict, faculty: Faculty) -> list[str]:
    out = []
    if (faculty.active_grants is None and faculty.patents is None
            and faculty.prior_industry_collabs is None):
        out.append("grants, patents and prior industry collaborations were not collected")
    if known["company_quality"] is None:
        out.append("the company's own score was not available")
    if known["psu_link"] is None:
        out.append("Penn State links to the company were not checked in the company data")
    return out


def _flags(faculty: Faculty, signal: Signal, n_corr: int, conflict: bool, synthetic: bool,
           run_date: dt.date, config: ScoreConfig) -> list[UncertaintyFlag]:
    flags = []
    year = faculty.last_pub_year
    if year is not None and run_date.year - year > config.stale_years:
        flags.append(UncertaintyFlag(
            code=FlagCode.STALE_PROFILE,
            note=f"The researcher's last publication in the data is from {year}."))
    if faculty.works_last_5y == 0:
        flags.append(UncertaintyFlag(
            code=FlagCode.NO_RECENT_ACTIVITY,
            note="No works by this researcher in the last 5 years in the data."))
    thin = []
    if faculty.works_last_5y is not None and faculty.works_last_5y < config.thin_works:
        thin.append(f"only {_plural(faculty.works_last_5y, 'work')} by the researcher in the "
                    "last 5 years")
    if signal.verifiers is not None and len(signal.verifiers) <= 1 and n_corr == 1:
        thin.append("the company signal has one verifier and nothing else backs it")
    if thin:
        flags.append(UncertaintyFlag(code=FlagCode.THIN_EVIDENCE,
                                     note="Thin evidence: " + " and ".join(thin) + "."))
    if faculty.open_to_industry is False:
        flags.append(UncertaintyFlag(
            code=FlagCode.NOT_OPEN_TO_INDUSTRY,
            note="The researcher's profile says they are not open to industry work. "
                 "This is shown, not scored."))
    if conflict:
        flags.append(UncertaintyFlag(
            code=FlagCode.CONFLICTING_SIGNALS,
            note="The company also has a negative signal in this area, so this cannot rate "
                 "as strong."))
    if synthetic:
        flags.append(UncertaintyFlag(code=FlagCode.SYNTHETIC_DATA,
                                     note="Some of the input data is synthetic."))
    return flags


def _reasons(faculty: Faculty, company: Company, best: _Candidate, total: int,
             psu: float | None) -> tuple[list[Reason], dict[str, Evidence]]:
    own = {e.id: e for e in faculty.evidence}
    sig_ev = {e.id: e for e in best.signal.evidence}
    co_topic, fac_topic, _ = best.pair
    co_label = next(t.label for t in best.signal.topics if t.topic_id == co_topic)
    fac = next(t for t in faculty.topics if t.topic_id == fac_topic)
    relation = ("the same topic" if co_topic == fac_topic else f"close to {co_label}")
    age = ("date unknown" if best.signal.age_days is None
           else f"{best.signal.age_days} days ago")

    reasons: list[Reason] = []
    cited = [*list(sig_ev)[:2], *([f"{faculty.id}:topics"] if f"{faculty.id}:topics" in own else [])]
    if cited:
        share = "" if fac.weight is None else f" at {round(100 * fac.weight)}% of their works"
        reasons.append(Reason(
            text=f"{company.name} signal ({best.signal.kind}, {age}): {best.signal.field_text} "
                 f"{faculty.name} works on {fac.label}{share}, {relation}. This match rests on "
                 f"1 of the company's {_plural(total, 'signal')}.",
            evidence_ids=cited))
    if f"{faculty.id}:activity" in own:
        reasons.append(Reason(text=own[f"{faculty.id}:activity"].text,
                              evidence_ids=[f"{faculty.id}:activity"]))
    if psu is not None and sig_ev:
        text = (f"The company data lists {faculty.name} as a past co-author with {company.name}."
                if psu == 100 else
                f"{company.name} has Penn State ties in the company data.")
        reasons.append(Reason(text=text, evidence_ids=[next(iter(sig_ev))]))
    used = {i for r in reasons for i in r.evidence_ids}
    return reasons, {i: e for i, e in {**own, **sig_ev}.items() if i in used}


def _headline(band: Band, best: _Candidate, company: Company, faculty: Faculty) -> str:
    co_topic, fac_topic, _ = best.pair
    co = next(t.label for t in best.signal.topics if t.topic_id == co_topic)
    fac = next(t.label for t in faculty.topics if t.topic_id == fac_topic)
    link = (f"{faculty.name} works on it" if co_topic == fac_topic
            else f"close to {faculty.name}'s work on {fac}")
    return f"{band.value.capitalize()} match: {company.name} is active in {co}, {link}."


def _build(query_id, candidate_id, score, band, breakdown, headline, reasons, flags, faculty,
           company, similarity, now, synthetic, unknown) -> Match:
    if synthetic and not any(f.code is FlagCode.SYNTHETIC_DATA for f in flags):
        flags = [*flags, UncertaintyFlag(code=FlagCode.SYNTHETIC_DATA,
                                         note="Some of the input data is synthetic.")]
    note = "Starting weights are hand-picked and not validated. " + f"Topic similarity: {similarity.name}"
    if not similarity.reviewed:
        note += " (not yet reviewed by a second person)"
    return Match(
        query_id=query_id, candidate_id=candidate_id, score=score, band=band, breakdown=breakdown,
        headline=headline, reasons=reasons, uncertainty=flags,
        not_checked=[*ALWAYS_NOT_CHECKED, *unknown],
        method=Method(scorer="fime-topic-scorer", scorer_version="0.1", note=note + "."),
        generated_at=now, synthetic=synthetic,
    )


__all__ = ["ScoreConfig", "ScoredPair", "score_pair"]
