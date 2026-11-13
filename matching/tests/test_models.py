"""Tests for the data contracts (spec 001, section 3 and acceptance criteria 1, 5, 6, 8)."""

import copy
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from fime_matching.models import (
    CompanyProfile,
    Evidence,
    Match,
    MatchResultSet,
    Provenance,
    ResearcherProfile,
)

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = sorted((ROOT / "docs" / "samples").glob("*.json"))
FIXTURES = ROOT / "matching" / "data" / "synthetic"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


PROV = {"source_type": "synthetic", "source_ref": "doc-1", "retrieved_at": "2026-10-19"}


def evidence(**over):
    base = {"id": "ev-1", "kind": "grant", "text": "A grant.", "provenance": PROV}
    return {**base, **over}


@pytest.fixture
def result():
    """A valid result file to break one rule at a time."""
    return copy.deepcopy(load(next(p for p in SAMPLES if "researcher-to-companies" in p.name)))


# --- fixtures and samples ----------------------------------------------------------------------


def test_synthetic_fixtures_validate():
    researchers = [ResearcherProfile.model_validate(r) for r in load(FIXTURES / "researchers.json")]
    companies = [CompanyProfile.model_validate(c) for c in load(FIXTURES / "companies.json")]
    assert len(researchers) == 2
    assert len(companies) == 9  # the eight sample partners plus one placeholder with no information
    assert all(r.provenance.source_type == "synthetic" for r in researchers)


@pytest.mark.parametrize("path", SAMPLES, ids=lambda p: p.name)
def test_sample_result_files_validate(path):
    MatchResultSet.model_validate(load(path))


def test_fixtures_and_samples_agree_on_shared_evidence():
    """The sample outputs cite evidence by id, so the same id must mean the same fact."""
    profiles = load(FIXTURES / "researchers.json") + load(FIXTURES / "companies.json")
    known = {e["id"]: e["text"] for p in profiles for e in p["evidence"]}
    for path in SAMPLES:
        for ev_id, ev in load(path)["evidence"].items():
            if ev_id in known:
                assert ev["text"] == known[ev_id], ev_id


# --- provenance --------------------------------------------------------------------------------


@pytest.mark.parametrize("missing", ["source_type", "source_ref", "retrieved_at"])
def test_provenance_requires_source_and_retrieval_date(missing):
    data = {k: v for k, v in PROV.items() if k != missing}
    with pytest.raises(ValidationError):
        Provenance.model_validate(data)


@pytest.mark.parametrize(
    "ref", ["", "C:\\Users\\someone\\cv.pdf", "C:/Users/someone/cv.pdf", "/Users/x/cv.pdf",
            "/home/x/cv.pdf", "\\\\server\\share\\cv.pdf"]
)
def test_provenance_rejects_empty_or_local_path_refs(ref):
    with pytest.raises(ValidationError):
        Provenance.model_validate({**PROV, "source_ref": ref})


def test_provenance_accepts_url_and_document_id():
    for ref in ("https://psu.flintbox.com/technologies/abc", "cv-0007"):
        Provenance.model_validate({**PROV, "source_ref": ref})


@pytest.mark.parametrize("value", ["2024", "2024-03", "2024-03-15"])
def test_partial_dates_accepted(value):
    Evidence.model_validate(evidence(date=value))
    Provenance.model_validate({**PROV, "as_of": value})


@pytest.mark.parametrize("value", ["24", "2024-13", "2024-02-30", "0000", "March 2024", "2024/03"])
def test_bad_dates_rejected(value):
    with pytest.raises(ValidationError):
        Evidence.model_validate(evidence(date=value))


# --- evidence and profiles ---------------------------------------------------------------------


def test_status_only_on_grants_patents_and_sbir():
    Evidence.model_validate(evidence(kind="grant", status="active"))
    Evidence.model_validate(evidence(kind="patent", status="pending"))
    with pytest.raises(ValidationError, match="status applies to"):
        Evidence.model_validate(evidence(kind="publication", status="active"))


def test_unknown_fields_are_errors():
    with pytest.raises(ValidationError):
        Evidence.model_validate(evidence(url="https://example.com"))


def test_evidence_without_text_or_provenance_rejected():
    with pytest.raises(ValidationError):
        Evidence.model_validate(evidence(text=""))
    with pytest.raises(ValidationError):
        Evidence.model_validate({k: v for k, v in evidence().items() if k != "provenance"})


def test_duplicate_evidence_ids_rejected():
    profile = {
        "id": "r1", "display_name": "R One", "provenance": PROV,
        "evidence": [evidence(), evidence()],
    }
    with pytest.raises(ValidationError, match="duplicate evidence id"):
        ResearcherProfile.model_validate(profile)


def test_sparse_profiles_are_allowed():
    """Missing information is flagged later, not rejected, so thin profiles must load."""
    r = ResearcherProfile.model_validate({"id": "r1", "display_name": "R One", "provenance": PROV})
    assert r.unit is None and r.research_areas == [] and r.evidence == []
    c = CompanyProfile.model_validate({"id": "c1", "name": "Co", "provenance": PROV})
    assert c.relationship == "unknown"


# --- match rules -------------------------------------------------------------------------------


def a_match(result_file, index=0):
    return copy.deepcopy(result_file["results"][index]["match"])


def test_insufficient_match_has_null_score_and_a_reason_why(result):
    insufficient = a_match(result, -1)
    assert insufficient["band"] == "insufficient"
    Match.model_validate(insufficient)

    insufficient["score"] = 40
    with pytest.raises(ValidationError, match="exactly when the band"):
        Match.model_validate(insufficient)

    silent = a_match(result, -1)
    silent["uncertainty"] = []
    with pytest.raises(ValidationError, match="must say why"):
        Match.model_validate(silent)


def test_scored_match_cannot_have_null_score(result):
    match = a_match(result)
    match["score"] = None
    with pytest.raises(ValidationError):
        Match.model_validate(match)


def test_score_out_of_range_rejected(result):
    for bad in (-1, 101):
        match = a_match(result)
        match["score"] = bad
        with pytest.raises(ValidationError):
            Match.model_validate(match)


def test_every_match_lists_what_was_not_checked(result):
    match = a_match(result)
    match["not_checked"] = []
    with pytest.raises(ValidationError):
        Match.model_validate(match)


def test_every_reason_cites_evidence(result):
    match = a_match(result)
    match["reasons"][0]["evidence_ids"] = []
    with pytest.raises(ValidationError):
        Match.model_validate(match)


def test_weights_must_add_up_to_one(result):
    match = a_match(result)
    match["breakdown"]["weights"]["recency"] = 0.5
    with pytest.raises(ValidationError, match="add up to 1"):
        Match.model_validate(match)


def test_breakdown_is_all_or_none(result):
    match = a_match(result)
    match["breakdown"]["recency"] = None
    with pytest.raises(ValidationError):
        Match.model_validate(match)


def test_score_must_follow_from_the_breakdown(result):
    match = a_match(result)  # fit 88, recency/evidence put the weighted sum at 85.8
    match["score"] = 95
    with pytest.raises(ValidationError, match="does not follow from the breakdown"):
        Match.model_validate(match)

    match["score"] = 60
    with pytest.raises(ValidationError, match="does not follow from the breakdown"):
        Match.model_validate(match)


def test_score_is_the_weighted_sum_rounded(result):
    match = a_match(result)  # weighted sum is 85.8
    match["score"] = 86
    Match.model_validate(match)

    match["score"] = 87
    with pytest.raises(ValidationError, match="does not follow from the breakdown"):
        Match.model_validate(match)


@pytest.mark.parametrize(
    ("fit", "recency", "evidence", "score", "band"),
    [
        (80, 80, 80, 80, "moderate"),  # 75+ is strong
        (60, 60, 60, 60, "strong"),  # 50 to 74 is moderate
        (45, 45, 45, 45, "moderate"),  # under 50 is weak
        (30, 100, 100, 58, "moderate"),  # off-topic is always weak, however well evidenced
    ],
)
def test_band_must_match_score_and_fit_gate(result, fit, recency, evidence, score, band):
    match = a_match(result, 1)
    match["breakdown"].update(topical_fit=fit, recency=recency, evidence_strength=evidence)
    match["breakdown"]["weights"] = {"topical_fit": 0.6, "recency": 0.2, "evidence_strength": 0.2}
    match["score"], match["band"] = score, band
    with pytest.raises(ValidationError, match="does not fit score"):
        Match.model_validate(match)


def test_fit_gate_may_pull_the_score_down_but_not_up(result):
    match = a_match(result, 1)
    match["breakdown"].update(topical_fit=30, recency=100, evidence_strength=100)
    match["breakdown"]["weights"] = {"topical_fit": 0.6, "recency": 0.2, "evidence_strength": 0.2}
    match["band"] = "weak"

    match["score"] = 49  # weighted sum is 58, the gate caps it
    Match.model_validate(match)

    match["score"] = 58  # a weak match must not outscore a moderate one
    with pytest.raises(ValidationError, match="weak match must score under 50"):
        Match.model_validate(match)

    match["score"] = 70  # the gate can never raise the score
    with pytest.raises(ValidationError, match="does not follow from the breakdown"):
        Match.model_validate(match)


# --- result file rules -------------------------------------------------------------------------


def test_same_candidate_cannot_be_listed_twice(result):
    result["results"].insert(1, copy.deepcopy(result["results"][0]))
    with pytest.raises(ValidationError, match="listed more than once"):
        MatchResultSet.model_validate(result)


def test_cited_evidence_missing_from_lookup_is_rejected(result):
    del result["evidence"]["ev-ge-interests"]
    with pytest.raises(ValidationError, match="not in the evidence lookup"):
        MatchResultSet.model_validate(result)


def test_unranked_match_must_be_last_and_ranks_must_be_in_order(result):
    result["results"][0]["rank"], result["results"][1]["rank"] = 2, 1
    with pytest.raises(ValidationError, match="ranked 1, 2, 3"):
        MatchResultSet.model_validate(result)


def test_ranked_results_must_be_in_score_order(result):
    result["results"][0], result["results"][1] = result["results"][1], result["results"][0]
    result["results"][0]["rank"], result["results"][1]["rank"] = 1, 2
    with pytest.raises(ValidationError, match="descending score"):
        MatchResultSet.model_validate(result)


def test_insufficient_entry_cannot_have_a_rank(result):
    result["results"][-1]["rank"] = 6
    with pytest.raises(ValidationError, match="rank is null exactly when"):
        MatchResultSet.model_validate(result)


def test_workflow_must_match_query_and_candidate_kinds(result):
    result["workflow"] = "company_need_to_researchers"
    with pytest.raises(ValidationError, match="needs a query of kind"):
        MatchResultSet.model_validate(result)


def test_evidence_lookup_key_must_match_item_id(result):
    result["evidence"]["ev-ge-interests"]["id"] = "something-else"
    with pytest.raises(ValidationError, match="does not match its id"):
        MatchResultSet.model_validate(result)
