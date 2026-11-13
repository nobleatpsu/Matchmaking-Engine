"""Tests for topic similarity (spec 002 section 6, slice 2b)."""

import json
from pathlib import Path

import pytest

from fime_matching.load import InputError, load_topics
from fime_matching.similarity import ExactSimilarity, load_matrix

DATA = Path(__file__).resolve().parents[1] / "data"
TOPICS = {"T001": "Fibre", "T002": "Fuel cells", "T003": "Batteries"}


def matrix_file(tmp_path, **over):
    body = {"name": "test", "source": "written for the test", "reviewed_by": None,
            "pairs": [{"a": "T001", "b": "T002", "similarity": 0.5}]}
    path = tmp_path / "matrix.json"
    path.write_text(json.dumps({**body, **over}), encoding="utf-8")
    return path


def test_exact_matches_only_itself():
    sim = ExactSimilarity()
    assert sim("T001", "T001") == 1.0 and sim("T001", "T002") == 0.0


def test_matrix_is_symmetric_one_on_the_diagonal_and_zero_when_unlisted(tmp_path):
    sim = load_matrix(matrix_file(tmp_path), TOPICS)
    assert sim("T001", "T002") == sim("T002", "T001") == 0.5
    assert sim("T003", "T003") == 1.0 and sim("T001", "T003") == 0.0


def test_matrix_says_whether_a_person_reviewed_it(tmp_path):
    assert load_matrix(matrix_file(tmp_path), TOPICS).reviewed is False
    assert load_matrix(matrix_file(tmp_path, reviewed_by="Noble"), TOPICS).reviewed is True
    assert load_matrix(matrix_file(tmp_path), TOPICS).name == "matrix:test"


@pytest.mark.parametrize(
    ("pairs", "message"),
    [
        ([{"a": "T001", "b": "T999", "similarity": 0.5}], "unknown topic id T999"),
        ([{"a": "T001", "b": "T002", "similarity": 0.5},
          {"a": "T002", "b": "T001", "similarity": 0.4}], "listed twice"),
        ([{"a": "T001", "b": "T001", "similarity": 0.5}], "always 1 with itself"),
        ([{"a": "T001", "b": "T002", "similarity": 1.5}], "similarity"),
        ([{"a": "T001", "b": "T002", "similarity": 0}], "similarity"),
    ],
)
def test_bad_matrix_files_are_rejected_with_the_pair(tmp_path, pairs, message):
    with pytest.raises(InputError, match=message):
        load_matrix(matrix_file(tmp_path, pairs=pairs), TOPICS)


def test_matrix_needs_a_source(tmp_path):
    path = matrix_file(tmp_path)
    data = json.loads(path.read_text(encoding="utf-8"))
    del data["source"]
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(InputError, match="source"):
        load_matrix(path, TOPICS)


def test_the_starter_matrix_loads_against_the_shared_topic_list():
    topics = load_topics(DATA / "topics.json")
    sim = load_matrix(DATA / "similarity" / "starter-matrix.json", topics)
    assert len(topics) == 40 and sim("T002", "T009") == 0.6
    assert sim.reviewed is False  # it stays unreviewed until a second person has read every pair
