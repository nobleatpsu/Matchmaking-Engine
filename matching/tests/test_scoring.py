"""Tests for the pair scorer (spec 002 section 5 and 7, slice 2c)."""

import datetime as dt

import pytest

from fime_matching.inputs import Company, Faculty, Signal, TopicWeight
from fime_matching.models import Evidence, FlagCode, Provenance, Workflow
from fime_matching.scoring import ScoreConfig, score_pair
from fime_matching.similarity import ExactSimilarity, MatrixSimilarity

RUN = dt.date(2026, 10, 28)
NOW = dt.datetime(2026, 10, 28, 12, 0, tzinfo=dt.UTC)
TOPICS = {"T001": "Fibre optics", "T002": "Fuel cells", "T003": "Batteries", "T004": "Ceramics",
          "T005": "Robotics", "T006": "Sensors"}
EXACT = ExactSimilarity()
RELATED = MatrixSimilarity("t", {frozenset(("T001", "T002")): 0.6}, reviewed=True)


def prov():
    return Provenance(source_type="synthetic", source_ref="doc", retrieved_at=RUN)


def person(topics=(("T001", 0.5),), **over):
    fid = over.pop("id", "A1")
    base = {
        "id": fid, "name": "Pat Doe", "works_last_5y": 12, "h_index": 20, "last_pub_year": 2025,
        "synthetic": False, "provenance": prov(),
        "topics": [TopicWeight(topic_id=t, label=TOPICS[t], weight=w) for t, w in topics],
        "evidence": [
            Evidence(id=f"{fid}:topics", kind="profile_stat", text="Shares.", provenance=prov()),
            Evidence(id=f"{fid}:activity", kind="profile_stat", text="Pat: 12 works.",
                     provenance=prov()),
        ],
    }
    return Faculty(**{**base, **over})


def signal(sid="s1", topics=("T001",), **over):
    base = {
        "id": sid, "company_id": "acme", "kind": "investment_field", "direction": "positive",
        "field_text": "Acme invests in fibre.", "strength": 4, "age_days": 10,
        "event_date": "2026-10-18", "as_of": RUN, "is_replay": False, "synthetic": False,
        "topics": [TopicWeight(topic_id=t, label=TOPICS[t], weight=0.9) for t in topics],
        "evidence": [Evidence(id=f"{sid}:ev", kind="company_signal", text="Acme invests.",
                              provenance=prov())],
    }
    return Signal(**{**base, **over})


def firm(signals=None, **over):
    return Company(**{"id": "acme", "name": "Acme", "signals": signals or [signal()], **over})


def run(f=None, c=None, sim=EXACT, workflow=Workflow.RESEARCHER_TO_COMPANIES, **kw):
    return score_pair(f or person(), c or firm(), workflow, RUN, sim, NOW, **kw)


# --- fit, saturation, fuzzy ---------------------------------------------------------------------


def test_same_topic_with_enough_share_is_a_strong_match():
    pair = run()
    b = pair.match.breakdown
    assert b.topical_fit == 100 and pair.match.band == "strong"
    assert abs(sum(b.weights.model_dump().values()) - 1) < 1e-6
    assert pair.matched_signal_id == "s1"


@pytest.mark.parametrize(("share", "fit"), [(0.25, 100), (0.5, 100), (0.125, 50), (0.05, 20)])
def test_a_share_is_saturated_at_a_quarter_of_the_works(share, fit):
    assert run(person(topics=(("T001", share),))).match.breakdown.topical_fit == fit


def test_a_broad_researcher_is_not_pushed_under_the_gate_by_spreading_their_work():
    broad = person(topics=(("T001", 0.2), ("T002", 0.2), ("T003", 0.2), ("T004", 0.2), ("T005", 0.2)))
    assert run(broad).match.breakdown.topical_fit == 80


def test_related_topics_count_through_the_similarity_and_exact_gives_nothing():
    f, c = person(topics=(("T002", 0.5),)), firm()
    assert run(f, c, RELATED).match.breakdown.topical_fit == 60
    off = run(f, c, EXACT).match
    assert off.breakdown.topical_fit == 0 and off.band == "weak"


def test_off_topic_is_weak_and_capped_below_moderate_however_well_evidenced():
    pair = run(person(topics=(("T003", 0.5),)))
    assert pair.match.band == "weak" and pair.match.score <= 49


def test_neutral_signals_count_at_half():
    neutral = firm([signal(direction="neutral")])
    assert run(c=neutral).match.breakdown.topical_fit == 50


def test_a_company_with_several_unrelated_needs_is_not_diluted():
    c = firm([signal("s1", ("T003",)), signal("s2", ("T001",)), signal("s3", ("T005",))])
    pair = run(c=c)
    assert pair.matched_signal_id == "s2" and pair.match.breakdown.topical_fit == 100
    assert "1 of the company's 3 signals" in pair.match.reasons[0].text


# --- unknown stays unknown -----------------------------------------------------------------------


def test_missing_company_score_and_psu_data_drop_out_and_the_other_weights_scale_up():
    b = run().match.breakdown
    assert b.company_quality is None and b.psu_link is None
    assert b.weights.company_quality == 0 and b.weights.psu_link == 0
    assert b.weights.topical_fit == pytest.approx(0.625, abs=1e-3)


def test_a_known_company_score_is_remapped_from_one_to_ten():
    b = run(c=firm(score=5.5)).match.breakdown
    assert b.company_quality == 50 and b.weights.company_quality > 0
    assert run(c=firm(score=1.0)).match.breakdown.company_quality == 0


def test_psu_engaged_false_is_not_a_no():
    assert run(c=firm(psu_engaged=False, alumni_count=None)).match.breakdown.psu_link is None
    assert run(c=firm(psu_engaged=True, alumni_count=2)).match.breakdown.psu_link == 46


def test_unknown_counts_are_listed_as_not_checked_and_never_zero():
    nc = run().match.not_checked
    assert any("grants, patents" in line for line in nc)
    assert any("company's own score" in line for line in nc)
    assert any("Penn State links" in line for line in nc)
    for line in ("conflict of interest", "export control"):
        assert line in nc


def test_track_record_uses_only_the_counts_that_are_known():
    a = run(person(works_last_5y=30, h_index=None)).match.breakdown.evidence_strength
    b = run(person(works_last_5y=30, patents=0, active_grants=0)).match.breakdown.evidence_strength
    assert a > b  # a known zero lowers the score, an unknown count does not


def test_unknown_recency_is_left_out_not_counted_as_zero():
    f = person(last_pub_year=None, works_last_5y=None)
    c = firm([signal(strength=None, age_days=None, event_date=None)], )
    pair = run(f, c)
    # the corroboration part is always known, so evidence strength still exists here
    assert pair.match.band != "insufficient"
    assert pair.match.breakdown.recency is None and pair.match.breakdown.weights.recency == 0


# --- direction ----------------------------------------------------------------------------------


def test_only_negative_signals_near_the_topic_means_not_flagged():
    pair = run(c=firm([signal(direction="negative")]))
    m = pair.match
    assert m.band == "insufficient" and m.score is None
    assert m.uncertainty[0].code is FlagCode.NEGATIVE_SIGNAL


def test_a_negative_signal_far_from_the_topic_does_not_matter():
    c = firm([signal("s1"), signal("s2", ("T003",), direction="negative")])
    assert run(c=c).match.band == "strong"


def test_comparable_positive_and_negative_signals_conflict_and_cap_at_moderate():
    c = firm([signal("s1"), signal("s2", direction="negative")])
    m = run(c=c).match
    assert m.score <= 74 and m.band == "moderate"
    assert FlagCode.CONFLICTING_SIGNALS in {f.code for f in m.uncertainty}


def test_a_much_weaker_negative_signal_does_not_conflict():
    c = firm([signal("s1"), signal("s2", direction="negative", strength=1, age_days=200)])
    m = run(c=c).match
    assert FlagCode.CONFLICTING_SIGNALS not in {f.code for f in m.uncertainty}


# --- insufficient cases --------------------------------------------------------------------------


def test_a_researcher_with_no_topic_shares_is_insufficient():
    f = person(topics=(("T001", None),))
    assert run(f).match.band == "insufficient"
    assert run(person(topics=())).match.band == "insufficient"


def test_a_company_with_no_usable_topic_is_insufficient():
    c = firm([signal(topics=())])
    m = run(c=c).match
    assert m.band == "insufficient" and m.uncertainty[0].code is FlagCode.THIN_EVIDENCE


# --- flags and recency ---------------------------------------------------------------------------


def test_stale_and_inactive_researchers_are_flagged_and_score_lower_on_recency():
    old = run(person(last_pub_year=2019, works_last_5y=0)).match
    codes = {f.code for f in old.uncertainty}
    assert {FlagCode.STALE_PROFILE, FlagCode.NO_RECENT_ACTIVITY, FlagCode.THIN_EVIDENCE} <= codes
    assert old.breakdown.recency < run().match.breakdown.recency


def test_a_stale_profile_is_capped_below_a_current_researcher_with_a_decent_fit():
    m = run(person(last_pub_year=1974, works_last_5y=0)).match
    assert m.breakdown.topical_fit == 100
    assert m.score <= 59 and m.band == "moderate"
    assert FlagCode.STALE_PROFILE in {f.code for f in m.uncertainty}
    assert run(person(last_pub_year=2025)).match.band == "strong"


def test_an_older_signal_scores_lower_on_recency():
    new = run(c=firm([signal(age_days=5)])).match.breakdown.recency
    old = run(c=firm([signal(age_days=180)])).match.breakdown.recency
    assert old < new


def test_not_open_to_industry_is_a_flag_and_changes_nothing_else():
    shut, plain = run(person(open_to_industry=False)).match, run().match
    assert FlagCode.NOT_OPEN_TO_INDUSTRY in {f.code for f in shut.uncertainty}
    assert shut.score == plain.score


def test_synthetic_input_is_labelled_synthetic():
    m = run(person(synthetic=True)).match
    assert m.synthetic and FlagCode.SYNTHETIC_DATA in {f.code for f in m.uncertainty}


# --- reasons, headline, ids ------------------------------------------------------------------------


def test_every_reason_cites_evidence_that_is_returned():
    pair = run(c=firm(psu_engaged=True, alumni_count=1))
    assert pair.match.reasons
    for reason in pair.match.reasons:
        assert set(reason.evidence_ids) <= set(pair.evidence)


def test_a_past_co_publication_is_a_cited_reason():
    c = firm([signal(copub_faculty_ids=["A1"])])
    pair = run(c=c)
    assert pair.match.breakdown.psu_link == 100
    assert any("past co-author" in r.text for r in pair.match.reasons)


def test_the_headline_says_the_band_and_names_both_sides():
    h = run().match.headline
    assert h.startswith("Strong match") and "Acme" in h and "Fibre optics" in h
    related = run(person(topics=(("T002", 0.5),)), sim=RELATED).match.headline
    assert "close to Pat Doe's work on Fuel cells" in related


def test_ids_follow_the_workflow():
    a = run(workflow=Workflow.RESEARCHER_TO_COMPANIES).match
    b = run(workflow=Workflow.COMPANY_NEED_TO_RESEARCHERS).match
    assert (a.query_id, a.candidate_id) == ("A1", "acme")
    assert (b.query_id, b.candidate_id) == ("acme", "A1")


def test_the_same_input_gives_the_same_output():
    one, two = run(), run()
    assert one.match.model_dump() == two.match.model_dump() and one.unrounded == two.unrounded


def test_the_method_note_says_the_weights_are_not_validated_and_the_matrix_unreviewed():
    plain = run().match.method.note
    assert "not validated" in plain and "exact" in plain
    unreviewed = MatrixSimilarity("starter", {}, reviewed=False)
    assert "not yet reviewed" in run(sim=unreviewed).match.method.note


def test_config_values_change_the_result_without_changing_code():
    stricter = ScoreConfig(saturation_share=0.5)
    assert run(person(topics=(("T001", 0.25),)), config=stricter).match.breakdown.topical_fit == 50
