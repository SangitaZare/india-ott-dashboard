"""Run the JavaScript unit tests for the family plan picker (tests/js/) as part of pytest.

The picker runs in the browser, so its logic is written in JavaScript and tested with Node's
built-in test runner (no npm packages needed). This wrapper makes `python -m pytest` the one
command that checks everything.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")


def test_picker_javascript_unit_tests_pass() -> None:
    if NODE is None:
        # Locally, Node is optional. In CI (GitHub sets CI=true) a missing Node must fail, not silently skip.
        if os.environ.get("CI"):
            pytest.fail("Node.js is required in CI to run the picker tests")
        pytest.skip("Node.js is not installed")
    # Pass the files by name: older Node versions (e.g. 22, used in CI) don't accept a folder after --test.
    files = sorted(str(p.relative_to(REPO_ROOT)) for p in (REPO_ROOT / "tests" / "js").glob("*.test.js"))
    assert files, "no JavaScript test files found in tests/js/"
    result = subprocess.run(
        [NODE, "--test", *files], cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", timeout=120
    )
    assert result.returncode == 0, result.stdout[-4000:] + result.stderr[-2000:]
