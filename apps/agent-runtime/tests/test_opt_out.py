from unittest.mock import MagicMock, patch

import pytest

from src.skills.security_guard import SecurityGuard
from src.skills.whatsapp_sender import WhatsAppSenderTool


@pytest.fixture
def security_guard():
    return SecurityGuard()


def test_opt_out_detection(security_guard):
    """Test if opt-out keywords are correctly identified."""
    result = security_guard.check_input("não quero mais mensagens", "lead-123")
    assert result.passed is True
    assert result.is_opt_out is True


@patch("src.skills.whatsapp_sender.httpx.Client")
def test_whatsapp_sender_optout_api_check(mock_client_class):
    """Opt-out agora é verificado server-side: a rota interna responde 403."""
    mock_client = MagicMock()
    mock_client_class.return_value.__enter__.return_value = mock_client

    blocked_resp = MagicMock()
    blocked_resp.status_code = 403
    mock_client.post.return_value = blocked_resp

    tool = WhatsAppSenderTool()
    result = tool._run(phone="5511999999999", message="Hello")

    assert "Envio bloqueado" in result
    assert "opt-out" in result

    # A skill chama a rota interna versionada uma única vez
    mock_client.post.assert_called_once()
    called_url = mock_client.post.call_args.args[0]
    assert "/api/v1/internal/messages/whatsapp" in called_url
