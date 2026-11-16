import os
import tempfile

# Must be set before the app is imported: settings are read at import time, and tests
# must never touch the developer's real clusterone.db or job-logs directory.
_TMP = tempfile.mkdtemp(prefix="clusterone-tests-")
os.environ["CLUSTERONE_DATABASE_URL"] = f"sqlite:///{_TMP}/startup.db"
os.environ["CLUSTERONE_LOG_DIR"] = f"{_TMP}/job-logs"
os.environ["CLUSTERONE_BACKGROUND_INTERVAL_SECONDS"] = "0"
for _var in ("CLUSTERONE_SLURM_ENABLED", "CLUSTERONE_AUTH_ENABLED", "CLUSTERONE_AGENT_TOKEN",
             "CLUSTERONE_PROMETHEUS_URL", "DATABASE_URL", "SLURMRESTD_URL"):
    os.environ.pop(_var, None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.services import slurm_sync  # noqa: E402

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(autouse=True)
def _isolated_settings(monkeypatch, tmp_path):
    """Every test starts from dev-mode defaults and its own log directory."""
    monkeypatch.setattr(settings, "log_dir", str(tmp_path / "job-logs"))
    monkeypatch.setattr(settings, "slurm_enabled", False)
    monkeypatch.setattr(settings, "auth_enabled", False)
    monkeypatch.setattr(settings, "agent_token", None)
    monkeypatch.setattr(settings, "api_key", None)
    monkeypatch.setattr(settings, "prometheus_url", None)
    slurm_sync.reset_for_tests()


@pytest.fixture()
def db_engine():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture()
def db_session(db_engine):
    session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        c.session_factory = TestingSessionLocal  # lets tests poke the DB directly
        yield c
    app.dependency_overrides.clear()
