"""Published JSON Schemas for the data contracts, generated from the models in models.py.

Atharv checks his output against the profile schemas and Noble builds against the result schema.
Run scripts/export_schema.py after changing a model. A test fails if the files are out of date.
"""

import json
from pathlib import Path

from fime_matching.validate import KINDS

SCHEMA_DIR = Path(__file__).resolve().parents[2] / "schema"

FILE_NAMES = {
    "researcher": "researcher-profile.schema.json",
    "company": "company-profile.schema.json",
    "need": "company-need.schema.json",
    "result": "match-result.schema.json",
}


def schema_text(kind: str) -> str:
    return json.dumps(KINDS[kind].model_json_schema(), indent=2) + "\n"


def write_schemas(directory: Path = SCHEMA_DIR) -> list[Path]:
    directory.mkdir(parents=True, exist_ok=True)
    written = []
    for kind, name in FILE_NAMES.items():
        path = directory / name
        path.write_text(schema_text(kind), encoding="utf-8")
        written.append(path)
    return written
