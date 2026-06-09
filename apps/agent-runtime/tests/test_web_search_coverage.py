"""
Tests for web_search.py SSRF protection and SearXNG search logic.
Stubs crewai and pydantic_settings to run without those installed.
"""

import sys
import types
from unittest.mock import MagicMock, patch

import pytest

# ── 1. Stub pydantic_settings (not in this env) ──────────────────────────────
_ps = types.ModuleType("pydantic_settings")


class _BaseSettings:
    """Minimal BaseSettings stub — no env-var loading."""

    def __init_subclass__(cls, **kwargs):
        # Stub: skip pydantic_settings field registration
        super().__init_subclass__(**kwargs)


_ps.BaseSettings = _BaseSettings
_ps.SettingsConfigDict = dict
sys.modules.setdefault("pydantic_settings", _ps)

# ── 2. Stub crewai ────────────────────────────────────────────────────────────
_cr = types.ModuleType("crewai")
_ct = types.ModuleType("crewai.tools")


class _BaseTool:
    """Minimal BaseTool stub."""

    name: str = ""
    description: str = ""
    args_schema: type | None = None


_ct.BaseTool = _BaseTool
_cr.tools = _ct
sys.modules.setdefault("crewai", _cr)
sys.modules.setdefault("crewai.tools", _ct)

# ── 3. Inject a real-looking config object into src.config ───────────────────
_cfg_mod = types.ModuleType("src.config")
_cfg = MagicMock()
_cfg.searxng_url = None
_cfg_mod.config = _cfg  # type: ignore[attr-defined]
sys.modules["src.config"] = _cfg_mod

# Force a fresh import of web_search so stubs take effect
sys.modules.pop("src.skills.web_search", None)

# After import, manually set cfg reference on the module for patching
import src.skills.web_search as _ws_mod  # noqa: E402
from src.skills.web_search import WebSearchTool  # noqa: E402

if not hasattr(_ws_mod, "config"):
    _ws_mod.config = _cfg  # type: ignore[attr-defined]


# ── helpers ───────────────────────────────────────────────────────────────────


def _cfg_patch(searxng_url=None):
    c = MagicMock()
    c.searxng_url = searxng_url
    return patch("src.skills.web_search.config", new=c)


@pytest.fixture()
def tool():
    return WebSearchTool()


# ── SSRF protection ──────────────────────────────────────────────────────


class TestSSRFProtection:
    def test_blocks_localhost(self, tool):
        with _cfg_patch():
            result = tool._run(query="localhost services")
        assert "Blocked" in result

    def test_blocks_127_0_0_1(self, tool):
        with _cfg_patch():
            result = tool._run(query="hit 127.0.0.1 now")
        assert "Blocked" in result

    def test_blocks_10_subnet(self, tool):
        with _cfg_patch():
            result = tool._run(query="10.0.0.1 admin")
        assert "Blocked" in result

    def test_blocks_metadata(self, tool):
        with _cfg_patch():
            result = tool._run(query="metadata.google.internal")
        assert "Blocked" in result

    def test_allows_normal_query(self, tool):
        with _cfg_patch(searxng_url=None):
            result = tool._run(query="restaurantes em Sao Paulo")
        assert "Blocked" not in result


# ── SearXNG path ─────────────────────────────────────────────────────────


class TestSearXNGPath:
    def _mock_client(self, resp):
        c = MagicMock()
        c.__enter__ = MagicMock(return_value=c)
        c.__exit__ = MagicMock(return_value=False)
        c.get.return_value = resp
        return c

    def test_returns_searxng_results(self, tool):
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json.return_value = {"results": [{"title": "Café A", "url": "https://a.com", "content": "x"}]}
        with _cfg_patch("http://searxng:8080"), patch("httpx.Client", return_value=self._mock_client(resp)):
            result = tool._run(query="cafes Recife")
        assert "Café A" in result

    def test_searxng_error_handled(self, tool):
        client = MagicMock()
        client.__enter__ = MagicMock(return_value=client)
        client.__exit__ = MagicMock(return_value=False)
        client.get.side_effect = Exception("timeout")
        with _cfg_patch("http://searxng:8080"), patch("httpx.Client", return_value=client):
            result = tool._run(query="bares SP")
        assert "error" in result.lower()

    def test_city_appended(self, tool):
        captured: dict = {}
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json.return_value = {"results": []}

        def fake_get(url, params=None, **_kw):
            captured.update(params or {})
            return resp

        client = MagicMock()
        client.__enter__ = MagicMock(return_value=client)
        client.__exit__ = MagicMock(return_value=False)
        client.get.side_effect = fake_get
        with _cfg_patch("http://searxng:8080"), patch("httpx.Client", return_value=client):
            tool._run(query="barbearias", city="Fortaleza")
        assert "Fortaleza" in captured.get("q", "")

    def test_empty_results(self, tool):
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json.return_value = {"results": []}
        with _cfg_patch("http://searxng:8080"), patch("httpx.Client", return_value=self._mock_client(resp)):
            result = tool._run(query="query no results")
        assert result == "[]"
