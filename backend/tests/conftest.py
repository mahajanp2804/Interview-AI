import os
import tempfile
from types import SimpleNamespace

# Must be set before the app is imported: settings and the DB engine are created at import time.
# Real environment variables take priority over backend/.env.
_tmpdir = tempfile.mkdtemp(prefix="interviewai-tests-")
os.environ["GEMINI_API_KEY"] = "test-key"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmpdir}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as c:
        # Start every test with an empty sessions table
        for s in c.get("/api/sessions/").json():
            c.delete(f"/api/sessions/{s['session_uid']}")
        yield c


class FakeResponse:
    def __init__(self, parsed=None, text=None):
        self.parsed = parsed
        self.text = text


class FakeModels:
    """Stands in for client.models: records calls and returns or raises what it's given."""

    def __init__(self, result):
        self.result = result
        self.calls = []

    def generate_content(self, *, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        if isinstance(self.result, Exception):
            raise self.result
        return self.result

    def generate_content_stream(self, *, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        for chunk in self.result:
            if isinstance(chunk, Exception):
                raise chunk
            yield FakeResponse(text=chunk)


@pytest.fixture
def fake_gemini(monkeypatch):
    """Replace the Gemini client with one returning `result` (a FakeResponse or an exception)."""
    from app import ai_service

    def install(result):
        models = FakeModels(result)
        monkeypatch.setattr(ai_service, "client", SimpleNamespace(models=models))
        return models

    return install
