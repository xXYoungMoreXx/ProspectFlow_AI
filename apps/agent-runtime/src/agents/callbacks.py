import json
import logging
from typing import Any

from crewai.tools.base_tool import BaseTool
from pydantic import PrivateAttr

from src.skills.security_guard import SecurityGuard

logger = logging.getLogger(__name__)


class SecureToolWrapper(BaseTool):
    """
    Wraps an existing CrewAI Tool to intercept executions and run
    before_tool_callback (SSRF and argument validation).
    """

    name: str = "SecureToolWrapper"
    description: str = "A wrapper that adds ADK-style security callbacks to tools."

    _original_tool: BaseTool = PrivateAttr()
    _security_guard: SecurityGuard = PrivateAttr()

    def __init__(self, original_tool: BaseTool):
        super().__init__(
            name=original_tool.name, description=original_tool.description, args_schema=original_tool.args_schema
        )
        self._original_tool = original_tool
        self._security_guard = SecurityGuard()

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        """Intercept the tool execution to run before_tool_callback checks."""
        # SSRF Check: scan arguments for URLs
        for key, value in kwargs.items():
            if isinstance(value, str) and ("http://" in value or "https://" in value):
                result = self._security_guard.check_ssrf(value)
                if not result.passed:
                    logger.warning(f"before_tool_callback BLOCKED SSRF attempt on tool {self.name}: {value}")
                    return f"❌ Tool execution blocked by SecurityGuard: SSRF attempt detected ({result.reason})"

        # Execute original tool
        try:
            return self._original_tool._run(*args, **kwargs)
        except Exception as e:
            logger.error(f"Tool {self.name} failed: {str(e)}")
            return f"❌ Tool execution failed: {str(e)}"


class RequiresApprovalException(Exception):
    """Raised when a tool requires human intervention to proceed."""

    def __init__(self, message: str, hitl_level: str = "HITL-1", action_type: str = "UNKNOWN"):
        super().__init__(message)
        self.hitl_level = hitl_level
        self.action_type = action_type


HITL_ACTION_MAP = {
    "SendWhatsAppTool": ("HITL-1", "FIRST_CONTACT", 3600),
    "SendProposalTool": ("HITL-FINANCEIRO", "SEND_PROPOSAL", None),
    "DeploySiteTool": ("HITL-1", "DEPLOY_SITE", 14400),
    "FollowUpTool": ("HITL-2", "FOLLOW_UP", 1800),
    "PaidCampaignTool": ("HITL-FINANCEIRO", "PAID_CAMPAIGN", None),
}


class HITLToolWrapper(SecureToolWrapper):
    """
    Extends SecureToolWrapper to add Human-In-The-Loop (HITL) pausing.
    If called, it raises RequiresApprovalException to pause the execution.
    """

    name: str = "HITLToolWrapper"
    description: str = "A wrapper that enforces human approval before execution."

    _session_id: str = PrivateAttr()

    def __init__(self, original_tool: BaseTool, session_id: str):
        super().__init__(original_tool=original_tool)
        self.name = f"{original_tool.name} (Requires Approval)"
        self._session_id = session_id

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        # We simulate checking if approval was granted
        from src.agents.state import AgentSessionManager

        state = AgentSessionManager.get_session(self._session_id)

        # Get tier config
        hitl_config = HITL_ACTION_MAP.get(self._original_tool.name, ("HITL-1", "UNKNOWN", 3600))
        hitl_level, action_type, timeout = hitl_config

        # In a real async flow, we would check if this specific input is approved.
        # Here we just raise the exception to signal the orchestrator to pause.
        input_str = json.dumps(kwargs)
        # Assuming request_approval might take additional kwargs later
        AgentSessionManager.request_approval(self._session_id, self._original_tool.name, input_str)

        logger.warning(
            f"HITL Triggered for {self._original_tool.name} in session {self._session_id} Level: {hitl_level}"
        )
        raise RequiresApprovalException(
            f"Human approval required to run {self._original_tool.name}.",
            hitl_level=hitl_level,
            action_type=action_type,
        )


def agent_step_callback(step: Any) -> None:
    """
    Called after each agent step. Acts as an after_agent_callback for
    audit logging and session state saving.
    """
    try:
        from src.agents.state import AgentSessionManager

        # Using a dummy session ID for now, this should be injected or stored in context.
        session_id = getattr(step, "session_id", "default_session")

        step_data = {
            "thought": getattr(step, "thought", str(step)),
            # additional metadata can be pulled from step
        }

        AgentSessionManager.log_step(session_id, step_data)
        logger.info(f"after_agent_callback: Step completed. Trace captured for session {session_id}.")
    except Exception as e:
        logger.error(f"Error in agent_step_callback: {str(e)}")
