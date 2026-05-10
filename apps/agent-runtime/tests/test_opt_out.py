import pytest
from unittest.mock import patch, MagicMock
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
    """Test if WhatsAppSender checks opt-out API and stops on blocked lead."""
    mock_client = MagicMock()
    mock_client_class.return_value.__enter__.return_value = mock_client
    
    # Mock opt-out check to return isBlocked = True
    opt_resp = MagicMock()
    opt_resp.status_code = 200
    opt_resp.json.return_value = {"isBlocked": True}
    mock_client.get.return_value = opt_resp
    
    tool = WhatsAppSenderTool()
    result = tool._run(phone="5511999999999", message="Hello")
    
    assert "Envio bloqueado" in result
    assert "opt-out" in result
    
    # Ensure POST /internal/messages/whatsapp was never called
    mock_client.post.assert_not_called()
