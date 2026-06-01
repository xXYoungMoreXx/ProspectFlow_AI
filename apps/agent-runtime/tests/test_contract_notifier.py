from unittest.mock import MagicMock, patch

import jwt

from src.skills.contract_notifier import ContractNotifierTool

_TEST_API_TOKEN = "test-api-token-for-jwt-signing"


@patch("src.skills.contract_notifier.config")
@patch("src.skills.contract_notifier.httpx.Client")
def test_contract_notifier_generates_valid_jwt(mock_client_class, mock_config):
    mock_config.api_token = _TEST_API_TOKEN
    mock_config.api_url = "https://api.test"

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

    # Extract and validate token
    token = result.split("token=")[1].strip()
    payload = jwt.decode(token, _TEST_API_TOKEN, algorithms=["HS256"])

    assert payload["dealId"] == "deal-123"
    assert payload["amount"] == 1500.00
    assert "exp" in payload
