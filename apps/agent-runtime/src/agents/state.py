import logging
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

import redis
from pydantic import BaseModel, Field

from src.config import config

logger = logging.getLogger(__name__)


def _s(value: str) -> str:
    """Sanitize user-supplied string for safe log output (prevent log injection)."""
    return str(value).replace("\n", "\\n").replace("\r", "\\r")


class SessionStatus(StrEnum):
    RUNNING = "RUNNING"
    PAUSED_FOR_APPROVAL = "PAUSED_FOR_APPROVAL"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ToolApprovalState(BaseModel):
    tool_name: str
    tool_input: str
    approved: bool = False
    approved_by: str | None = None
    approved_at: datetime | None = None


class SessionState(BaseModel):
    session_id: str
    status: SessionStatus = SessionStatus.RUNNING
    history: list[dict[str, Any]] = Field(default_factory=list)
    pending_approvals: dict[str, ToolApprovalState] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ── Redis Key Prefix ─────────────────────────────────────────────────────────
_SESSION_PREFIX = "hefesto:session:"
_SESSION_TTL_SECONDS = 86400  # 24 hours — sessions expire after inactivity


def _build_key(session_id: str) -> str:
    return f"{_SESSION_PREFIX}{session_id}"


class AgentSessionManager:
    """
    Manages state and context for agent executions (ADK Pattern).
    Uses Redis as persistent backend so sessions are shared across workers.
    Falls back to in-memory dict if Redis is unavailable.
    """

    _redis: redis.Redis | None = None
    _fallback_store: dict[str, SessionState] = {}

    @classmethod
    def _get_redis(cls) -> redis.Redis | None:
        """Lazy-connect to Redis. Returns None if unavailable."""
        if cls._redis is None:
            try:
                cls._redis = redis.from_url(
                    config.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                    retry_on_timeout=True,
                )
                # Verify connection
                cls._redis.ping()
                logger.info("AgentSessionManager connected to Redis at %s", config.redis_url)
            except Exception as e:
                logger.warning("Redis unavailable for session management, falling back to in-memory: %s", str(e))
                cls._redis = None
        return cls._redis

    @classmethod
    def get_session(cls, session_id: str) -> SessionState:
        r = cls._get_redis()
        if r is not None:
            try:
                data = r.get(_build_key(session_id))
                if data:
                    return SessionState.model_validate_json(data)
            except (redis.RedisError, Exception) as e:
                logger.warning("Redis read failed for session %s, using fallback: %s", _s(session_id), str(e))

        # Fallback to in-memory
        if session_id not in cls._fallback_store:
            cls._fallback_store[session_id] = SessionState(session_id=session_id)
        return cls._fallback_store[session_id]

    @classmethod
    def save_session(cls, state: SessionState) -> None:
        state.updated_at = datetime.now(UTC)
        serialized = state.model_dump_json()

        r = cls._get_redis()
        if r is not None:
            try:
                r.set(_build_key(state.session_id), serialized, ex=_SESSION_TTL_SECONDS)
                logger.info("Session %s saved to Redis. Status: %s", _s(state.session_id), state.status.value)
                return
            except (redis.RedisError, Exception) as e:
                logger.warning("Redis write failed for session %s, using fallback: %s", _s(state.session_id), str(e))

        # Fallback
        cls._fallback_store[state.session_id] = state
        logger.info("Session %s saved to fallback store. Status: %s", _s(state.session_id), state.status.value)

    @classmethod
    def log_step(cls, session_id: str, step_data: dict[str, Any]) -> None:
        state = cls.get_session(session_id)
        state.history.append({"timestamp": datetime.now(UTC).isoformat(), "step": step_data})
        cls.save_session(state)

    @classmethod
    def request_approval(cls, session_id: str, tool_name: str, tool_input: str) -> None:
        state = cls.get_session(session_id)
        approval_id = f"{tool_name}_{len(state.pending_approvals)}"
        state.pending_approvals[approval_id] = ToolApprovalState(tool_name=tool_name, tool_input=tool_input)
        state.status = SessionStatus.PAUSED_FOR_APPROVAL
        cls.save_session(state)
        logger.warning("Session %s paused for human approval on %s", session_id, tool_name)

    @classmethod
    def grant_approval(cls, session_id: str, approval_id: str, operator_id: str) -> bool:
        state = cls.get_session(session_id)
        if approval_id in state.pending_approvals:
            approval = state.pending_approvals[approval_id]
            approval.approved = True
            approval.approved_by = operator_id
            approval.approved_at = datetime.now(UTC)
            state.status = SessionStatus.RUNNING
            cls.save_session(state)
            return True
        return False
