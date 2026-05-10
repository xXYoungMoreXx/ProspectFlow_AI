import pytest
from unittest.mock import patch, MagicMock
from src.agents.qa.agent import QAAgent
from src.agents.qa.tasks import create_qa_audit_task
from crewai import Crew

@pytest.fixture
def qa_agent():
    return QAAgent("agent-qa", "corr-123", {"html_code": "<html><body><h1>Test</h1></body></html>"}).build()

def test_qa_rejects_missing_csp():
    # This test verifies that the QA task creation properly passes the html
    # and the prompt instructs to check CSP.
    
    agent_instance = QAAgent("agent-1", "corr-1", {}).build()
    html_code = "<html lang='pt'><head><title>Test</title></head><body>No CSP here</body></html>"
    
    task = create_qa_audit_task(agent_instance, html_code)
    
    assert "Content Security Policy (CSP)" in task.description
    assert html_code in task.description
    assert "Lighthouse" in task.description
    assert "WCAG" in task.description

def test_qa_agent_initialization():
    qa = QAAgent("agent-1", "corr-1", {})
    agent = qa.build()
    
    assert agent.role == "Auditor de Qualidade e Segurança"
    assert "OWASP Top 10" in agent.backstory or "OWASP Top 10" in agent.goal
    assert "Lighthouse" in agent.backstory or "Lighthouse" in agent.goal
