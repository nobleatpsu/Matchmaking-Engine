"""Run the matcher and write one result file per query (spec 002, slice 2d).

    python -m fime_matching.match --faculty faculty.jsonl --company needs.jsonl \\
        --topics topics.json --out results/ [--similarity matrix.json] [--workflow both]

Result files go to `<out>/researcher_to_companies/<id>.json` and
`<out>/company_need_to_researchers/<id>.json`. Nothing here sends anything. Put the output folder
somewhere git ignores when the data is real, for example `data/private/results`.
"""

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

from fime_matching.load import InputError, load_company_needs, load_faculty, load_topics
from fime_matching.models import Workflow
from fime_matching.ranking import company_to_researchers, researcher_to_companies
from fime_matching.similarity import ExactSimilarity, TopicSimilarity, load_matrix

WORKFLOWS = {
    "researcher_to_companies": Workflow.RESEARCHER_TO_COMPANIES,
    "company_need_to_researchers": Workflow.COMPANY_NEED_TO_RESEARCHERS,
}


def _safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", value)


def write_results(
    people, companies, run_date: dt.date, similarity: TopicSimilarity, now: dt.datetime,
    out: Path, workflows: list[str], top: int = 10, only_id: str | None = None,
) -> list[Path]:
    written = []
    jobs = []
    if "researcher_to_companies" in workflows:
        jobs += [("researcher_to_companies", p.id, lambda p=p: researcher_to_companies(
            p, companies, run_date, similarity, now, top)) for p in people]
    if "company_need_to_researchers" in workflows:
        jobs += [("company_need_to_researchers", c.id, lambda c=c: company_to_researchers(
            c, people, run_date, similarity, now, top)) for c in companies]
    for folder, query_id, build in jobs:
        if only_id and query_id != only_id:
            continue
        result = build()
        path = out / folder / f"{_safe_name(query_id)}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(result.model_dump_json(indent=2, exclude_none=False) + "\n",
                        encoding="utf-8")
        written.append(path)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Score and rank, writing one result file per query.")
    parser.add_argument("--faculty", type=Path, required=True)
    parser.add_argument("--company", type=Path, required=True)
    parser.add_argument("--topics", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--similarity", default="exact",
                        help="exact, or the path to a matrix file")
    parser.add_argument("--workflow", choices=[*WORKFLOWS, "both"], default="both")
    parser.add_argument("--id", dest="only_id", help="only this researcher or company id")
    parser.add_argument("--top", type=int, default=10)
    args = parser.parse_args(argv)

    run_date = dt.date.today()
    try:
        topics = load_topics(args.topics)
        people, f_report = load_faculty(args.faculty, topics, run_date)
        companies, replays, c_report = load_company_needs(
            args.company, topics, run_date, faculty_ids={p.id for p in people})
        similarity = (ExactSimilarity() if args.similarity == "exact"
                      else load_matrix(Path(args.similarity), topics))
    except InputError as exc:
        print("\n".join(exc.errors))
        print("INVALID: fix the input files first")
        return 1

    workflows = list(WORKFLOWS) if args.workflow == "both" else [args.workflow]
    written = write_results(people, companies, run_date, similarity,
                            dt.datetime.now(dt.UTC), args.out, workflows, args.top, args.only_id)
    print(f"Wrote {len(written)} result file(s) to {args.out} "
          f"({len(people)} researchers, {len(companies)} live companies, "
          f"{len(replays)} replay signals left out, similarity {similarity.name})")
    print("\n".join(f"faculty: {line}" for line in f_report.lines()))
    print("\n".join(f"company: {line}" for line in c_report.lines()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
