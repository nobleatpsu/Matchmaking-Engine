"""Check a JSON file against the data contracts and print readable errors.

    python -m fime_matching.validate researcher records.json

The file may hold one record or a list of records. Exit code is 0 when everything is valid.
"""

import argparse
import json
import sys
from pathlib import Path

from pydantic import BaseModel, ValidationError

from fime_matching.models import CompanyNeed, CompanyProfile, MatchResultSet, ResearcherProfile

KINDS: dict[str, type[BaseModel]] = {
    "researcher": ResearcherProfile,
    "company": CompanyProfile,
    "need": CompanyNeed,
    "result": MatchResultSet,
}


def _where(index: int | None, record: object, loc: tuple[int | str, ...]) -> str:
    label = "record" if index is None else f"record {index}"
    if isinstance(record, dict) and record.get("id"):
        label += f" ({record['id']})"
    return ".".join([label, *map(str, loc)]) if loc else label


def validate_file(kind: str, path: Path) -> tuple[int, list[str]]:
    """Return (number of records checked, error lines). An empty error list means valid."""
    model = KINDS[kind]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return 0, [f"{path}: cannot read as JSON: {exc}"]

    is_list = isinstance(data, list)
    records = data if is_list else [data]
    errors: list[str] = []
    seen: dict[str, int] = {}
    for n, record in enumerate(records):
        index = n if is_list else None
        record_id = record.get("id") if isinstance(record, dict) else None
        if isinstance(record_id, str):
            if record_id in seen:
                errors.append(
                    f"{_where(index, record, ('id',))}: duplicate id, already used by "
                    f"record {seen[record_id]}"
                )
            seen.setdefault(record_id, n)
        try:
            model.model_validate(record)
        except ValidationError as exc:
            errors += [
                f"{_where(index, record, err['loc'])}: {err['msg'].removeprefix('Value error, ')}"
                for err in exc.errors()
            ]
    return len(records), errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("kind", choices=sorted(KINDS))
    parser.add_argument("file", type=Path)
    args = parser.parse_args(argv)

    count, errors = validate_file(args.kind, args.file)
    if errors:
        print("\n".join(errors))
        print(f"INVALID: {len(errors)} problem(s) in {args.file}")
        return 1
    print(f"OK: {count} {args.kind} record(s) in {args.file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
