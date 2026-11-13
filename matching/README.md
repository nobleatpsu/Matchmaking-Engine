# matching

The matching engine for the faculty-industry matchmaking project (FIME: Faculty-Industry Matchmaking
Engine). It is built slice by slice from
[spec 001](../docs/specs/spec-001-matching-core.md). This README covers what exists today: the data
contracts (slice 1), which is what data collection and the frontend build against.

## Set up

Needs Python 3.11 or newer. From the repo root:

```bash
cd matching
python -m venv .venv
.venv\Scripts\activate          # Windows. On Mac or Linux: source .venv/bin/activate
pip install -e ".[dev]"
python -m pytest
```

## Check your data against the contracts

```bash
python -m fime_matching.validate researcher records.json
python -m fime_matching.validate company records.json
python -m fime_matching.validate need records.json
python -m fime_matching.validate result result.json
```

A file can hold one record or a list. Each problem is printed with the record and field it is in, and
the exit code is 1 if anything is wrong. Misspelled or unknown fields are errors on purpose. Every
fact needs a `provenance` with a `source_ref` and a `retrieved_at` date, and an evidence `id`.

A good template is `data/synthetic/researchers.json` and `data/synthetic/companies.json`. Dates can be
a year (`2024`), a month (`2024-03`), or a day (`2024-03-15`).

Keep real data out of the repo. Put it in `data/private/`, which git ignores.

## Load the data team's files

```bash
python -m fime_matching.load faculty faculty_profiles.jsonl --topics topics.json
python -m fime_matching.load company company_needs.jsonl --topics topics.json --faculty faculty_profiles.jsonl
```

This is the input side (spec 002). It reads the faculty and company files as delivered, stops on bad
records with `record N (id).field: message`, and prints what it kept, excluded or filled in: backtest
replay rows (kept apart from live needs), signals with no topic, partial dates, derived provenance,
and unknown fields it ignored. A missing value stays missing, it is never turned into zero.

## What is where

| Path | What |
| --- | --- |
| `src/fime_matching/models.py` | The contracts: provenance, evidence, profiles, needs, matches, result file |
| `src/fime_matching/validate.py` | The command above |
| `schema/*.schema.json` | The same contracts as JSON Schema, for any language. Generated, do not edit |
| `data/synthetic/` | Fictional researchers and companies in the contract format (not real, not validation data) |
| `../docs/samples/` | Hand-written example result files for the frontend |
| `../docs/specs/` | The approved spec |

After changing a model, run `python scripts/export_schema.py`. A test fails if the schema files are
out of date.

## Checks

```bash
python -m pytest
ruff check .
```
