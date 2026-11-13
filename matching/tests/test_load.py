"""Tests for loading the data team's files (spec 002 section 3, acceptance criteria 1 and 10 to 13)."""

import copy
import datetime as dt
import json

import pytest

from fime_matching.load import InputError, load_company_needs, load_faculty, main

RUN = dt.date(2026, 10, 28)
TOPICS = {"T001": "Photonic and fiber-optic materials", "T002": "Solid oxide fuel cells",
          "T003": "Battery electrode materials", "T004": "Advanced ceramics processing"}


def faculty_row(**over):
    row = {
        "schema_version": "0.1", "synthetic": False, "faculty_id": "A100", "name": "Pat Doe",
        "department": None,
        "topics": [{"topic_id": "T001", "label": TOPICS["T001"], "weight": 0.4}],
        "works_last_5y": 12, "h_index": 20, "last_pub_year": 2025,
        "active_grants": None, "patents": None, "prior_industry_collabs": None,
        "open_to_industry": None,
    }
    return {**row, **over}


def signal_row(need_id="n1", **over):
    row = {
        "schema_version": "0.1", "as_of": "2026-10-23", "synthetic": False, "need_id": need_id,
        "company": {"company_id": "acme", "name": "Acme", "ticker": "ACM", "hq_state": "PA"},
        "need": {"kind": "investment_field", "summary": "Acme invests in fibre.",
                 "topics": [{"topic_id": "T001", "label": TOPICS["T001"], "weight": 0.9}],
                 "direction": "positive", "strength": 4, "event_date": "2026-10-01",
                 "age_days": None},
        "company_quality": {"score": None, "momentum_theme": None, "signals_last_7d": None},
        "psu_links": {"alumni_count": None, "psu_engaged": False, "copub_faculty_ids": []},
        "evidence": [{"evidence_id": "e1", "source": "news_rss", "url": "https://x.test/a",
                      "fetched": "2026-10-23"}],
        "status": "verified",
    }
    return {**row, **over}


def write(tmp_path, rows, name="in.jsonl"):
    path = tmp_path / name
    path.write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")
    return path


def need(**over):
    row = signal_row()
    row["need"] = {**row["need"], **over}
    return row


# --- faculty -----------------------------------------------------------------------------------


def test_faculty_loads_and_unknown_stays_unknown(tmp_path):
    people, report = load_faculty(write(tmp_path, [faculty_row()]), TOPICS, RUN)
    p = people[0]
    assert (p.id, p.works_last_5y, p.topics[0].weight) == ("A100", 12, 0.4)
    assert p.active_grants is None and p.patents is None and p.open_to_industry is None
    assert report.used == 1


def test_faculty_without_provenance_gets_derived_provenance_and_is_counted(tmp_path):
    people, report = load_faculty(write(tmp_path, [faculty_row()]), TOPICS, RUN)
    prov = people[0].provenance
    assert prov.source_ref == "https://openalex.org/A100" and prov.retrieved_at == RUN
    assert people[0].provenance_derived and report.provenance_derived == 1


def test_faculty_given_provenance_keeps_it(tmp_path):
    row = faculty_row(source_ref="https://openalex.org/A100", retrieved_at="2026-10-20")
    people, report = load_faculty(write(tmp_path, [row]), TOPICS, RUN)
    assert people[0].provenance.retrieved_at == dt.date(2026, 10, 20)
    assert not people[0].provenance_derived and report.provenance_derived == 0


def test_faculty_gets_citable_evidence_items(tmp_path):
    people, _ = load_faculty(write(tmp_path, [faculty_row()]), TOPICS, RUN)
    by_id = {e.id: e for e in people[0].evidence}
    assert "12 works in the last 5 years" in by_id["A100:activity"].text
    assert "40%" in by_id["A100:topics"].text
    assert all(e.kind == "profile_stat" for e in by_id.values())


def test_faculty_extra_fields_are_reported_not_rejected(tmp_path):
    row = faculty_row(openalex_topics=[{"openalex_id": "https://openalex.org/T1", "label": "X",
                                        "subfield": "Y", "works": 3}], brand_new="x")
    people, report = load_faculty(write(tmp_path, [row]), TOPICS, RUN)
    assert people[0].openalex_topics[0].works == 3
    assert report.unknown_fields == ["brand_new"]


@pytest.mark.parametrize(
    ("row", "message"),
    [
        (faculty_row(schema_version="9.9"), "unknown version"),
        (faculty_row(topics=[{"topic_id": "T999", "label": "?", "weight": 0.5}]), "unknown topic id"),
        (faculty_row(topics=[{"topic_id": "T001", "label": "x", "weight": 1.5}]), "weight"),
        (faculty_row(faculty_id="not-openalex"), "not an OpenAlex author id"),
        (faculty_row(last_pub_year="soon"), "last_pub_year"),
    ],
)
def test_faculty_errors_name_the_record_and_field(tmp_path, row, message):
    with pytest.raises(InputError, match=message) as exc:
        load_faculty(write(tmp_path, [row]), TOPICS, RUN)
    assert exc.value.errors[0].startswith("record 0")


def test_faculty_duplicate_id_is_an_error(tmp_path):
    with pytest.raises(InputError, match="duplicate, already used by record 0"):
        load_faculty(write(tmp_path, [faculty_row(), faculty_row()]), TOPICS, RUN)


def test_synthetic_faculty_does_not_need_an_openalex_id(tmp_path):
    row = faculty_row(synthetic=True, faculty_id="fac-001")
    people, _ = load_faculty(write(tmp_path, [row]), TOPICS, RUN)
    assert people[0].provenance.source_ref == "synthetic:in.jsonl#fac-001"


def test_topic_shares_above_one_get_a_warning(tmp_path):
    topics = [{"topic_id": t, "label": TOPICS[t], "weight": 0.8} for t in ("T001", "T002")]
    _, report = load_faculty(write(tmp_path, [faculty_row(topics=topics)]), TOPICS, RUN)
    assert any("add up to 1.60" in w for w in report.warnings)


# --- company signals ---------------------------------------------------------------------------


def test_live_signal_builds_a_company(tmp_path):
    companies, replays, report = load_company_needs(write(tmp_path, [signal_row()]), TOPICS, RUN)
    assert [c.id for c in companies] == ["acme"] and replays == []
    s = companies[0].signals[0]
    assert (s.field_text, s.topics[0].topic_id, s.age_days) == ("Acme invests in fibre.", "T001", 27)
    assert report.used == 1


def test_company_values_that_are_null_stay_null(tmp_path):
    companies, _, _ = load_company_needs(write(tmp_path, [signal_row()]), TOPICS, RUN)
    c = companies[0]
    assert c.score is None and c.momentum is None and c.alumni_count is None
    assert companies[0].signals[0].verifiers is None


def test_old_as_of_is_a_replay_and_never_a_live_company(tmp_path):
    rows = [signal_row("n1", as_of="2023-01-23"), signal_row("n2")]
    companies, replays, report = load_company_needs(write(tmp_path, rows), TOPICS, RUN)
    assert [s.id for s in replays] == ["n1"] and replays[0].is_replay
    assert [s.id for c in companies for s in c.signals] == ["n2"]
    assert report.replays == 1 and report.replays_inferred == 1


def test_explicit_replay_marker_wins_over_as_of(tmp_path):
    rows = [signal_row("n1", replay=True), signal_row("n2", as_of="2023-01-23", replay=False)]
    companies, replays, report = load_company_needs(write(tmp_path, rows), TOPICS, RUN)
    assert [s.id for s in replays] == ["n1"] and companies[0].signals[0].id == "n2"
    assert report.replays_inferred == 0


def test_age_comes_from_the_run_date_not_the_records_as_of(tmp_path):
    row = signal_row(as_of="2019-12-05", replay=False)  # a very old as_of must not shrink the age
    row["need"]["event_date"] = "2026-10-18"
    companies, _, _ = load_company_needs(write(tmp_path, [row]), TOPICS, RUN)
    assert companies[0].signals[0].age_days == 10


def test_year_only_and_unreadable_dates_are_kept_as_known_and_counted(tmp_path):
    rows = [signal_row("n1"), signal_row("n2"), signal_row("n3")]
    rows[0]["need"]["event_date"] = "2021"
    rows[1]["need"]["event_date"] = "November 7"
    rows[2]["need"]["event_date"] = None
    companies, _, report = load_company_needs(write(tmp_path, rows), TOPICS, RUN)
    got = {s.id: (s.event_date, s.age_days) for s in companies[0].signals}
    assert got == {"n1": ("2021", None), "n2": (None, None), "n3": (None, None)}
    assert (report.partial_dates, report.unreadable_dates) == (1, 1)


def test_a_signal_with_no_topic_is_kept_and_counted(tmp_path):
    rows = [signal_row("n1"), signal_row("n2")]
    rows[1]["need"]["topics"] = []
    companies, _, report = load_company_needs(write(tmp_path, rows), TOPICS, RUN)
    assert len(companies[0].signals) == 2 and report.no_topic == 1


def test_a_topic_on_over_a_quarter_of_signals_warns(tmp_path):
    rows = [signal_row(f"n{i}") for i in range(4)]
    _, _, report = load_company_needs(write(tmp_path, rows), TOPICS, RUN)
    assert any("topic T001" in w and "fallback" in w for w in report.warnings)


def test_unverified_signals_are_excluded_and_counted(tmp_path):
    rows = [signal_row("n1"), signal_row("n2", status="quarantined")]
    companies, _, report = load_company_needs(write(tmp_path, rows), TOPICS, RUN)
    assert [s.id for s in companies[0].signals] == ["n1"] and report.excluded_unverified == 1


def test_evidence_without_a_retrieval_date_gets_the_run_date_and_is_counted(tmp_path):
    row = signal_row()
    row["evidence"][0]["fetched"] = "2017"
    companies, _, report = load_company_needs(write(tmp_path, [row]), TOPICS, RUN)
    prov = companies[0].signals[0].evidence[0].provenance
    assert (prov.retrieved_at, prov.as_of) == (RUN, "2017") and report.retrieved_at_defaulted == 1


def test_repeated_evidence_ids_within_a_signal_are_dropped_once(tmp_path):
    row = signal_row()
    row["evidence"].append(copy.deepcopy(row["evidence"][0]))
    companies, _, report = load_company_needs(write(tmp_path, [row]), TOPICS, RUN)
    assert len(companies[0].signals[0].evidence) == 1 and report.duplicate_evidence_dropped == 1


def test_verifiers_are_collected_when_present(tmp_path):
    row = signal_row()
    row["evidence"][0]["verified_by"] = ["groq", "ollama"]
    companies, _, _ = load_company_needs(write(tmp_path, [row]), TOPICS, RUN)
    assert companies[0].signals[0].verifiers == ["groq", "ollama"]


@pytest.mark.parametrize(
    ("row", "message"),
    [
        (signal_row(schema_version="2.0"), "unknown version"),
        (need(topics=[{"topic_id": "T999", "label": "?", "weight": 0.9}]), "unknown topic id"),
        (signal_row(as_of="23 Oct"), "as_of"),
        (need(direction="sideways"), "direction"),
        (signal_row(evidence=[{"evidence_id": "e", "source": "carrier_pigeon"}]), "unmapped source"),
        (signal_row(psu_links={"copub_faculty_ids": ["A404"]}), "not a loaded faculty id"),
    ],
)
def test_company_errors_name_the_record_and_field(tmp_path, row, message):
    with pytest.raises(InputError, match=message) as exc:
        load_company_needs(write(tmp_path, [row]), TOPICS, RUN, faculty_ids={"A100"})
    assert exc.value.errors[0].startswith("record 0")


def test_duplicate_need_id_is_an_error(tmp_path):
    with pytest.raises(InputError, match="duplicate, already used by record 0"):
        load_company_needs(write(tmp_path, [signal_row(), signal_row()]), TOPICS, RUN)


def test_company_values_that_disagree_are_reported(tmp_path):
    rows = [signal_row("n1"), signal_row("n2")]
    rows[0]["company_quality"]["score"] = 5.0
    rows[1]["company_quality"]["score"] = 7.5
    _, _, report = load_company_needs(write(tmp_path, rows), TOPICS, RUN)
    assert any("disagree on score" in w for w in report.warnings)


def test_json_list_files_load_too(tmp_path):
    path = tmp_path / "list.json"
    path.write_text(json.dumps([signal_row()]), encoding="utf-8")
    companies, _, _ = load_company_needs(path, TOPICS, RUN)
    assert len(companies) == 1


def test_bad_json_line_is_reported_with_its_line(tmp_path):
    path = tmp_path / "bad.jsonl"
    path.write_text(json.dumps(signal_row()) + "\n{broken\n", encoding="utf-8")
    with pytest.raises(InputError, match="line 2: not valid JSON"):
        load_company_needs(path, TOPICS, RUN)


# --- command line ------------------------------------------------------------------------------


def test_command_reports_ok_and_invalid(tmp_path, capsys):
    topics = tmp_path / "topics.json"
    topics.write_text(json.dumps(TOPICS), encoding="utf-8")
    good = write(tmp_path, [faculty_row()], "good.jsonl")
    bad = write(tmp_path, [faculty_row(schema_version="9")], "bad.jsonl")

    assert main(["faculty", str(good), "--topics", str(topics)]) == 0
    assert "OK: 1 researcher(s)" in capsys.readouterr().out
    assert main(["faculty", str(bad), "--topics", str(topics)]) == 1
    assert "INVALID: 1 problem(s)" in capsys.readouterr().out
