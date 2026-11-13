"""Tests for the published JSON Schemas and the validation command (spec 001, acceptance 1 and 2)."""

import json
from pathlib import Path

import jsonschema
import pytest

from fime_matching.schema import FILE_NAMES, SCHEMA_DIR, schema_text
from fime_matching.validate import main, validate_file

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "docs" / "samples"
FIXTURES = ROOT / "matching" / "data" / "synthetic"


@pytest.mark.parametrize("kind", FILE_NAMES)
def test_published_schema_is_up_to_date(kind):
    """If this fails, run: python scripts/export_schema.py"""
    published = (SCHEMA_DIR / FILE_NAMES[kind]).read_text(encoding="utf-8")
    assert published == schema_text(kind)


def test_published_schemas_accept_the_samples_and_fixtures():
    """Someone using a plain JSON Schema validator gets the same answer as our own models."""
    cases = [
        ("result", [json.loads(p.read_text(encoding="utf-8")) for p in SAMPLES.glob("*.json")]),
        ("researcher", json.loads((FIXTURES / "researchers.json").read_text(encoding="utf-8"))),
        ("company", json.loads((FIXTURES / "companies.json").read_text(encoding="utf-8"))),
    ]
    for kind, records in cases:
        schema = json.loads((SCHEMA_DIR / FILE_NAMES[kind]).read_text(encoding="utf-8"))
        for record in records:
            jsonschema.validate(record, schema)


def test_published_schema_rejects_a_record_without_provenance():
    schema = json.loads((SCHEMA_DIR / FILE_NAMES["researcher"]).read_text(encoding="utf-8"))
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({"id": "r1", "display_name": "R One"}, schema)


def test_validate_command_accepts_valid_files(capsys):
    assert main(["researcher", str(FIXTURES / "researchers.json")]) == 0
    assert "OK: 2 researcher record(s)" in capsys.readouterr().out
    assert main(["result", str(next(SAMPLES.glob("*.json")))]) == 0


def test_validate_command_points_at_the_bad_record_and_field(tmp_path, capsys):
    records = json.loads((FIXTURES / "researchers.json").read_text(encoding="utf-8"))
    del records[1]["provenance"]["retrieved_at"]
    records[0]["evidence"][1]["date"] = "2024-13"
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(records), encoding="utf-8")

    assert main(["researcher", str(bad)]) == 1
    out = capsys.readouterr().out
    assert "record 1 (res-rivera).provenance.retrieved_at" in out
    assert "record 0 (res-ellis).evidence.1.date" in out
    assert "INVALID: 2 problem(s)" in out


def test_validate_command_catches_duplicate_ids_in_a_file(tmp_path, capsys):
    records = json.loads((FIXTURES / "researchers.json").read_text(encoding="utf-8"))
    records.append(records[0])
    dup = tmp_path / "dup.json"
    dup.write_text(json.dumps(records), encoding="utf-8")

    assert main(["researcher", str(dup)]) == 1
    out = capsys.readouterr().out
    assert "record 2 (res-ellis).id: duplicate id, already used by record 0" in out


def test_validate_command_handles_a_single_object_and_bad_json(tmp_path):
    single = tmp_path / "one.json"
    single.write_text(
        json.dumps({"id": "n1", "text": "A need.", "provenance": {
            "source_type": "synthetic", "source_ref": "x", "retrieved_at": "2026-10-19"}}),
        encoding="utf-8",
    )
    assert validate_file("need", single) == (1, [])

    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    count, errors = validate_file("need", broken)
    assert count == 0 and "cannot read as JSON" in errors[0]
