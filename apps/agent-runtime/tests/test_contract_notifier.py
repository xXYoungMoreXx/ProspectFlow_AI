import pytest
import jwt
from unittest.mock import patch, MagicMock
from src.skills.contract_notifier import ContractNotifierTool
from src.config import config

@patch("src.skills.contract_notifier.httpx.Client")
def test_contract_notifier_generates_valid_jwt(mock_client_class):
    mock_client = MagicMock()
    mock_client_class.return_value.__enter__.return_value = mock_client
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.post.return_value = mock_resp
    
    tool = ContractNotifierTool()
    deal_id = "deal-123"
    result = tool._run(deal_id=deal_id, phone="5511999999999", contract_value=1500.00)
    
    assert "sucesso" in result
    assert "public/deals/deal-123/proposal?token=" in result
    
    # Extract token
    token = result.split("token=")[1].strip()
    
    # Validate token
    secret = config.api_token or "super-secret-key"
    payload = jwt.decode(token, secret, algorithms=["HS256"])
    
    assert payload["dealId"] == "deal-123"
    assert payload["amount"] == 1500.00
    assert "exp" in payload
