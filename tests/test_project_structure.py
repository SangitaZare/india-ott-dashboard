"""Smoke test: the repository keeps the folder layout described in CLAUDE.md section 4."""
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent

EXPECTED_DIRS = [
    "data/raw",
    "scripts",
    "sql",
    "notebooks",
    "dashboard/css",
    "dashboard/js",
    "dashboard/data",
    "app",
    "tests",
    ".github/workflows",
]

EXPECTED_FILES = [
    "CLAUDE.md",
    "PROJECT_PLAN.md",
    "README.md",
    "requirements.txt",
    ".gitignore",
    ".github/pr_body.md",
]


@pytest.mark.parametrize("relative_path", EXPECTED_DIRS)
def test_expected_directory_exists(relative_path: str) -> None:
    assert (REPO_ROOT / relative_path).is_dir(), f"Missing folder: {relative_path}"


@pytest.mark.parametrize("relative_path", EXPECTED_FILES)
def test_expected_file_exists(relative_path: str) -> None:
    assert (REPO_ROOT / relative_path).is_file(), f"Missing file: {relative_path}"


def test_env_files_are_ignored() -> None:
    gitignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
    assert ".env" in gitignore.splitlines(), ".env must be in .gitignore so secrets are never committed"
