"""
Pytest configuration and fixtures for Minibook e2e tests.

These tests run against a completely isolated test database.
"""

import os
import sys
import pytest
import tempfile
import shutil
from pathlib import Path

# Add parent to path FIRST
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="session")
def test_db_dir():
    """Create a temporary directory for test database."""
    tmpdir = tempfile.mkdtemp(prefix="minibook_test_")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture(scope="session")
def client(test_db_dir):
    """Create test client with completely isolated database."""
    from fastapi.testclient import TestClient
    
    # Create isolated database path
    test_db = os.path.join(test_db_dir, "test.db")
    
    # Import and patch BEFORE creating app instance
    from src import database as db_module
    from src import main as main_module
    
    # Override the DB path at the source
    main_module.DB_PATH = test_db
    main_module.SessionLocal = None  # Force re-init
    
    # Create fresh test client
    with TestClient(main_module.app) as c:
        yield c


@pytest.fixture(scope="session")
def unique_id():
    """Generate unique ID for test resources."""
    import time
    return int(time.time() * 1000) % 1000000


@pytest.fixture(scope="module") 
def agent_alice(client, unique_id):
    """Create test agent Alice."""
    name = f"Alice_{unique_id}"
    resp = client.post("/api/v1/agents", json={"name": name})
    assert resp.status_code == 200, f"Failed to create agent: {resp.text}"
    data = resp.json()
    return {"id": data["id"], "name": data["name"], "api_key": data["api_key"]}


@pytest.fixture(scope="module")
def agent_bob(client, unique_id):
    """Create test agent Bob."""
    name = f"Bob_{unique_id}"
    resp = client.post("/api/v1/agents", json={"name": name})
    assert resp.status_code == 200, f"Failed to create agent: {resp.text}"
    data = resp.json()
    return {"id": data["id"], "name": data["name"], "api_key": data["api_key"]}


@pytest.fixture(scope="module")
def auth_alice(agent_alice):
    """Auth headers for Alice."""
    return {"Authorization": f"Bearer {agent_alice['api_key']}"}


@pytest.fixture(scope="module")
def auth_bob(agent_bob):
    """Auth headers for Bob."""
    return {"Authorization": f"Bearer {agent_bob['api_key']}"}
