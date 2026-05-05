import pytest
from src.skills.web_search import WebSearchTool

class TestWebSearchTool:
    @pytest.fixture
    def tool(self):
        return WebSearchTool()

    def test_ssrf_protection_blocks_localhost(self, tool):
        result = tool._run("http://localhost:8080/admin")
        assert "Blocked due to security policy (SSRF attempt detected)" in result

    def test_ssrf_protection_blocks_local_ip(self, tool):
        result = tool._run("127.0.0.1")
        assert "Blocked due to security policy (SSRF attempt detected)" in result

    def test_ssrf_protection_blocks_private_network(self, tool):
        result = tool._run("192.168.1.10")
        assert "Blocked due to security policy (SSRF attempt detected)" in result
        
        result2 = tool._run("10.0.0.5")
        assert "Blocked due to security policy (SSRF attempt detected)" in result2

    def test_allows_legitimate_queries(self, tool):
        # When no API key is provided, it should return mock results
        result = tool._run("best marketing strategies 2026")
        assert "Mock search results" in result or "places" in result.lower()
        assert "Blocked" not in result
