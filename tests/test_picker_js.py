"""Run the JavaScript unit tests for the family plan picker (tests/js/) as part of pytest.

The picker runs in the browser, so its logic is written in JavaScript and tested with Node's
built-in test runner (no npm packages needed). This wrapper makes `python -m pytest` the one
command that checks everything.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")


@pytest.mark.skipif(NODE is None, reason="Node.js is not installed")
def test_picker_javascript_unit_tests_pass() -> None:
    result = subprocess.run(
        [NODE, "--test", "tests/js/"], cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", timeout=120
    )
    assert result.returncode == 0, result.stdout[-4000:] + result.stderr[-2000:]
