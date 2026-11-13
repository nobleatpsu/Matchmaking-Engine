"""Tests for ranking and the result files (spec 002 5.7 and section 4, slice 2d)."""

import json
from pathlib import Path

import jsonschema
import pytest

from fime_matching.models import FlagCode, MatchResultSet
from fime_matching.ranking import company_to_researchers, researcher_to_companies
from fime_matching.schema import FILE_NAMES, SCHEMA_DIR
from fime_matching.similarity import MatrixSimilarity
from fime_matching.validate import main as validate_main
from test_scoring import EXACT, NOW, RELATED, RUN, TOPICS, firm, person, signal


def wide(people, c=None, sim=EXACT, top=10):
    return company_to_researchers(c or firm(), people, RUN, sim, NOW, top)


def ids(result):
    return [(e.rank, e.candidate.id) for e in result.results]


def test_researchers_for_a_company_are_ranked_from_best_to_worst_and_validate():
    people = [person(id="A1", topics=(("T001", 0.5),)), person(id="A2", topics=(("T001", 0.1),)),
              person(id="A3", topics=(("T001", 0.5),), last_pub_year=2019)]
    result = wide(people)
    assert isinstance(result, MatchResultSet) and result.workflow == "company_need_to_researchers"
    assert ids(result) == [(1, "A1"), (2, "A3"), (3, "A2")]
    assert result.query.kind == "company_need" and result.results[0].candidate.kind == "researcher"
    scores = [e.match.score for e in result.results]
    assert scores == sorted(scores, reverse=True)


def test_companies_for_a_researcher_are_ranked_and_the_candidate_names_the_matched_signal():
    near = firm([signal("s1", ("T001",))], id="near", name="Near Co")
    far = firm([signal("s2", ("T003",))], id="far", name="Far Co")
    result = researcher_to_companies(person(), [far, near], RUN, EXACT, NOW)
    assert result.workflow == "researcher_to_companies" and result.query.kind == "researcher"
    assert ids(result)[0] == (1, "near")
    assert result.results[0].candidate.detail == "Acme invests in fibre."


def test_a_list_is_not_padded_with_weak_matches():
    strong = [person(id=f"A{i}", topics=(("T001", 0.5),)) for i in range(3)]
    weak = [person(id=f"W{i}", topics=(("T003", 0.5),)) for i in range(5)]
    assert {c for _, c in ids(wide(strong + weak))} == {"A0", "A1", "A2"}


def test_weak_matches_only_fill_up_to_three_when_there_are_few_good_ones():
    people = [person(id="A1", topics=(("T001", 0.5),))] + [
        person(id=f"W{i}", topics=(("T003", 0.5),)) for i in range(5)]
    result = wide(people)
    assert len(result.results) == 3
    assert [e.match.band for e in result.results] == ["strong", "weak", "weak"]


def test_the_list_is_cut_at_top():
    people = [person(id=f"A{i}", topics=(("T001", 0.5),)) for i in range(6)]
    assert len(wide(people, top=4).results) == 4


def test_equal_scores_break_the_same_way_whatever_the_input_order():
    people = [person(id=i, topics=(("T001", 0.5),)) for i in ("A3", "A1", "A2")]
    forward, backward = wide(people), wide(list(reversed(people)))
    assert ids(forward) == ids(backward) == [(1, "A1"), (2, "A2"), (3, "A3")]


def test_a_company_that_looks_negative_is_listed_unranked_with_the_reason():
    positive = firm([signal("s1")], id="good", name="Good Co")
    negative = firm([signal("s2", direction="negative")], id="bad", name="Bad Co")
    result = researcher_to_companies(person(), [negative, positive], RUN, EXACT, NOW)
    assert ids(result) == [(1, "good"), (None, "bad")]
    last = result.results[-1].match
    assert last.score is None and last.uncertainty[0].code is FlagCode.NEGATIVE_SIGNAL


def test_researchers_without_topics_are_left_out_not_listed():
    result = wide([person(id="A1"), person(id="A2", topics=())])
    assert [c for _, c in ids(result)] == ["A1"]


def test_every_cited_evidence_id_is_in_the_file():
    result = wide([person()], firm(psu_engaged=True, alumni_count=1))
    cited = {i for e in result.results for r in e.match.reasons for i in r.evidence_ids}
    assert cited and cited <= set(result.evidence)


def test_the_run_id_is_stable_and_changes_with_the_input():
    one = wide([person()]).run_id
    assert one == wide([person()]).run_id
    assert one != wide([person(id="A2")]).run_id
    assert one != wide([person()], sim=RELATED).run_id


def test_the_run_id_changes_when_the_data_changes_but_the_ids_do_not():
    base = wide([person()], firm([signal("s1", ("T001",))])).run_id
    assert base != wide([person(topics=(("T001", 0.2),))], firm([signal("s1", ("T001",))])).run_id
    assert base != wide([person()], firm([signal("s1", ("T001",), strength=2)])).run_id
    assert base != wide([person(works_last_5y=1)], firm([signal("s1", ("T001",))])).run_id


def test_the_run_id_changes_when_a_matrix_value_changes_under_the_same_name():
    pairs = {frozenset(("T001", "T002")): 0.6}
    moved = {frozenset(("T001", "T002")): 0.7}
    first = wide([person()], sim=MatrixSimilarity("t", pairs, reviewed=True)).run_id
    assert first == wide([person()], sim=MatrixSimilarity("t", dict(pairs), reviewed=True)).run_id
    assert first != wide([person()], sim=MatrixSimilarity("t", moved, reviewed=True)).run_id


def test_the_run_id_does_not_depend_on_the_order_of_the_candidates():
    people = [person(id="A1"), person(id="A2")]
    assert wide(people).run_id == wide(list(reversed(people))).run_id


def test_the_note_says_the_weights_are_unvalidated_and_the_matrix_unreviewed():
    assert "not validated" in wide([person()]).note


def test_synthetic_input_makes_the_file_synthetic():
    assert wide([person(synthetic=True)]).synthetic is True
    assert wide([person()]).synthetic is False


def test_result_files_match_the_published_json_schema_and_the_validate_command(tmp_path):
    result = wide([person(id="A1"), person(id="A2", topics=(("T001", 0.1),))])
    schema = json.loads((SCHEMA_DIR / FILE_NAMES["result"]).read_text(encoding="utf-8"))
    jsonschema.validate(json.loads(result.model_dump_json()), schema)
    path = tmp_path / "result.json"
    path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    assert validate_main(["result", str(path)]) == 0


def test_the_command_writes_one_file_per_query_for_both_workflows(tmp_path):
    from fime_matching.match import main  # imported here so the other tests do not need it

    root = Path(__file__).resolve().parents[1]
    faculty, needs = tmp_path / "f.jsonl", tmp_path / "c.jsonl"
    f_row = {"schema_version": "0.1", "synthetic": True, "faculty_id": "fac-1", "name": "Pat",
             "topics": [{"topic_id": "T001", "label": TOPICS["T001"], "weight": 0.5}],
             "works_last_5y": 9, "last_pub_year": 2025}
    s_row = {"schema_version": "0.1", "as_of": RUN.isoformat(), "synthetic": True, "need_id": "n1",
             "company": {"company_id": "acme", "name": "Acme"},
             "need": {"kind": "investment_field", "summary": "Acme invests.", "direction": "positive",
                      "topics": [{"topic_id": "T001", "label": TOPICS["T001"], "weight": 0.9}],
                      "event_date": None},
             "status": "verified"}
    faculty.write_text(json.dumps(f_row), encoding="utf-8")
    needs.write_text(json.dumps(s_row), encoding="utf-8")
    out = tmp_path / "out"
    code = main(["--faculty", str(faculty), "--company", str(needs), "--topics",
                 str(root / "data" / "topics.json"), "--out", str(out)])
    files = sorted(p.relative_to(out).as_posix() for p in out.rglob("*.json"))
    assert code == 0 and files == ["company_need_to_researchers/acme.json",
                                   "researcher_to_companies/fac-1.json"]
    assert validate_main(["result", str(out / files[0])]) == 0


@pytest.mark.parametrize("name", ["a/b", "a b", "x:y"])
def test_file_names_are_made_safe(name):
    from fime_matching.match import _safe_name

    assert "/" not in _safe_name(name) and " " not in _safe_name(name) and ":" not in _safe_name(name)
