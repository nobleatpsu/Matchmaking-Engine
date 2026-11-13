"""How close two topics are, from 0 (unrelated) to 1 (the same) (spec 002, section 6).

The scorer asks one question, `similarity(topic_a, topic_b)`, and does not care where the answer
comes from. `exact` is the baseline. A `matrix` file lists related pairs so a person can read and
review every line. The matcher must never read the data generator's own neighbour table.
"""

import hashlib
import json
from pathlib import Path
from typing import Annotated, Protocol

from pydantic import Field, ValidationError, model_validator

from fime_matching.load import InputError
from fime_matching.models import Contract, Id, Text


class TopicSimilarity(Protocol):
    name: str
    reviewed: bool
    fingerprint: str  # changes whenever any similarity value changes, so a run id can tell

    def __call__(self, topic_a: str, topic_b: str) -> float: ...


class ExactSimilarity:
    """A topic matches only itself."""

    name = "exact"
    reviewed = True
    fingerprint = "exact"

    def __call__(self, topic_a: str, topic_b: str) -> float:
        return 1.0 if topic_a == topic_b else 0.0


class MatrixSimilarity:
    """Related pairs from a reviewed file. A pair that is not listed is unrelated."""

    def __init__(self, name: str, pairs: dict[frozenset[str], float], reviewed: bool) -> None:
        self.name = f"matrix:{name}"
        self.reviewed = reviewed
        self._pairs = pairs
        listed = sorted((sorted(pair), value) for pair, value in pairs.items())
        self.fingerprint = hashlib.sha256(json.dumps(listed).encode()).hexdigest()[:16]

    def __call__(self, topic_a: str, topic_b: str) -> float:
        if topic_a == topic_b:
            return 1.0
        return self._pairs.get(frozenset((topic_a, topic_b)), 0.0)


class _Pair(Contract):
    a: Id
    b: Id
    similarity: Annotated[float, Field(gt=0, le=1)]

    @model_validator(mode="after")
    def _two_different_topics(self):
        if self.a == self.b:
            raise ValueError("a topic is always 1 with itself, do not list it")
        return self


class _MatrixFile(Contract):
    name: Text
    source: Text
    reviewed_by: Text | None = None
    pairs: list[_Pair]


def load_matrix(path: Path, topics: dict[str, str]) -> MatrixSimilarity:
    """Read and check a matrix file. Unknown topic ids and repeated pairs are errors."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        matrix = _MatrixFile.model_validate(data)
    except (OSError, json.JSONDecodeError) as exc:
        raise InputError([f"{path}: cannot read matrix: {exc}"]) from exc
    except ValidationError as exc:
        raise InputError(
            [f"{path.name}.{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()]
        ) from exc

    errors: list[str] = []
    pairs: dict[frozenset[str], float] = {}
    for i, pair in enumerate(matrix.pairs):
        for side in (pair.a, pair.b):
            if side not in topics:
                errors.append(f"{path.name}.pairs.{i}: unknown topic id {side}")
        key = frozenset((pair.a, pair.b))
        if key in pairs:
            errors.append(f"{path.name}.pairs.{i}: {pair.a} and {pair.b} are listed twice")
        pairs[key] = pair.similarity
    if errors:
        raise InputError(errors)
    return MatrixSimilarity(matrix.name, pairs, reviewed=matrix.reviewed_by is not None)
