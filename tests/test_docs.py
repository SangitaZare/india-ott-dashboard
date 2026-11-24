"""Documentation stays complete: every column and every analysis query is described in DATA_DICTIONARY.md."""
from __future__ import annotations

from pathlib import Path

import pytest

from run_analysis import load_queries
from schemas import ALL_DATASETS, METRIC_TYPES, SOURCE_TYPES

REPO_ROOT = Path(__file__).resolve().parent.parent
DICTIONARY = (REPO_ROOT / "data" / "DATA_DICTIONARY.md").read_text(encoding="utf-8")
README = (REPO_ROOT / "README.md").read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "dataset, column",
    [(d.filename, c.name) for d in ALL_DATASETS for c in d.columns],
)
def test_every_column_is_documented(dataset: str, column: str) -> None:
    assert f"`{column}`" in DICTIONARY, f"{dataset}: column '{column}' is missing from DATA_DICTIONARY.md"


@pytest.mark.parametrize("value", sorted(METRIC_TYPES | SOURCE_TYPES))
def test_every_allowed_value_is_explained(value: str) -> None:
    assert f"`{value}`" in DICTIONARY


@pytest.mark.parametrize("query", sorted(load_queries()))
def test_every_analysis_query_is_documented(query: str) -> None:
    assert f"`{query}`" in DICTIONARY, f"query '{query}' is missing from DATA_DICTIONARY.md"


def test_readme_images_exist() -> None:
    import re

    for path in re.findall(r'(?:\]\(|src=")(docs/screenshots/[^)"]+)', README):
        assert (REPO_ROOT / path).is_file(), path
