"""
conftest.py — shared fixtures for FinLedge backend tests.

All tests run against isolated temp-directory data files so they never
touch the real dev/production data.
"""
import os
import sys
import tempfile
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Ensure the project root is on sys.path so backend imports resolve.
# Set isolated data dir env BEFORE any backend service is imported.
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

_SESSION_TMP_DIR = Path(tempfile.mkdtemp(prefix="finledge_test_data_"))
os.environ["FINLEDGE_DATA_DIR"] = str(_SESSION_TMP_DIR)


@pytest.fixture(scope="session", autouse=True)
def isolated_data_dir():
    """
    Point every service to a fresh temp directory for the whole test session.
    """
    import backend.services.path_utils as pu
    pu._resolve_mode.cache_clear()

    yield _SESSION_TMP_DIR

    shutil.rmtree(_SESSION_TMP_DIR, ignore_errors=True)



@pytest.fixture(scope="session")
def client(isolated_data_dir):
    """Return a FastAPI TestClient backed by the full app."""
    from backend.main import app
    return TestClient(app, raise_server_exceptions=True)
