"""
ProspectFlow AI — Modelos de Banco de Dados
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON, BigInteger, Boolean, DateTime, Enum, ForeignKey,
    Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ─── Enums ────────────────────────────────────────────────────────────────────

class LeadStatus(str, enum.Enum):
    NEW = "new"
    QUEUED = "queued"
    CONTACTED = "contacted"
    ENGAGED = "engaged"
    PROPOSAL_SENT = "proposal_sent"
    NEGOTIATING = "negotiating"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"
    BLOCKED = "blocked"          # optou por não receber mais mensagens
    DISQUALIFIED = "disqualified"


class FunnelStage(str, enum.Enum):
    OPENING = "opening"
    PRESENTATION = "presentation"
    PERSONALIZATION = "personalization"
    PROPOSAL = "proposal"
    OBJECTION = "objection"
    CLOSING = "closing"
    DONE = "done"


class Channel(str, enum.Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"


class MessageDirection(str, enum.Enum):
    OUTBOUND = "outbound"
    INBOUND = "inbound"


class SecurityEventType(str, enum.Enum):
    INJECTION_ATTEMPT = "injection_attempt"
    OPT_OUT = "opt_out"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    ACCOUNT_BLOCKED = "account_blocked"


# ─── Modelos ──────────────────────────────────────────────────────────────────

class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Dados do Google Maps
    place_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(String(1000))
    city: Mapped[str] = mapped_column(String(255))
    state: Mapped[str | None] = mapped_column(String(50))
    category: Mapped[str] = mapped_column(String(255))
    niche: Mapped[str | None] = mapped_column(String(255))
    rating: Mapped[float | None] = mapped_column()
    total_ratings: Mapped[int | None] = mapped_column(Integer)
    has_photo: Mapped[bool] = mapped_column(Boolean, default=False)
    maps_url: Mapped[str | None] = mapped_column(String(1000))

    # Qualificação
    score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus), default=LeadStatus.NEW, index=True
    )

    # Preferências coletadas durante a negociação
    reference_url: Mapped[str | None] = mapped_column(String(1000))
    logo_url: Mapped[str | None] = mapped_column(String(1000))
    preferred_colors: Mapped[dict | None] = mapped_column(JSON)
    business_description: Mapped[str | None] = mapped_column(Text)

    # Financeiro
    agreed_price: Mapped[int | None] = mapped_column(Integer)
    payment_link: Mapped[str | None] = mapped_column(String(1000))
    payment_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Metadados
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    contacted_first_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_interaction_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relacionamentos
    conversations: Mapped[list[Conversation]] = relationship(
        back_populates="lead", cascade="all, delete-orphan"
    )
    messages: Mapped[list[Message]] = relationship(
        back_populates="lead", cascade="all, delete-orphan"
    )
    site: Mapped[Site | None] = relationship(back_populates="lead", uselist=False)
    security_events: Mapped[list[SecurityEvent]] = relationship(
        back_populates="lead", cascade="all, delete-orphan"
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id"), index=True
    )
    channel: Mapped[Channel] = mapped_column(Enum(Channel))
    stage: Mapped[FunnelStage] = mapped_column(
        Enum(FunnelStage), default=FunnelStage.OPENING
    )

    # Histórico serializado para o LLM (lista de {role, content})
    history: Mapped[list[dict]] = mapped_column(JSON, default=list)

    # Metadata da conversa
    injection_attempts: Mapped[int] = mapped_column(Integer, default=0)
    sentiment: Mapped[str | None] = mapped_column(String(50))  # positive/neutral/negative
    objection_type: Mapped[str | None] = mapped_column(String(100))

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lead: Mapped[Lead] = relationship(back_populates="conversations")
    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id"), index=True
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), index=True
    )
    channel: Mapped[Channel] = mapped_column(Enum(Channel))
    direction: Mapped[MessageDirection] = mapped_column(Enum(MessageDirection))
    content: Mapped[str] = mapped_column(Text)
    raw_payload: Mapped[dict | None] = mapped_column(JSON)  # payload original do webhook
    was_injection_attempt: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lead: Mapped[Lead] = relationship(back_populates="messages")
    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id"), unique=True
    )

    # Design system extraído
    design_system: Mapped[dict | None] = mapped_column(JSON)
    reference_url: Mapped[str | None] = mapped_column(String(1000))

    # Geração
    generated_html: Mapped[str | None] = mapped_column(Text)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Publicação
    deployment_url: Mapped[str | None] = mapped_column(String(1000))
    domain: Mapped[str | None] = mapped_column(String(255))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Status
    status: Mapped[str] = mapped_column(String(50), default="pending")
    error: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lead: Mapped[Lead] = relationship(back_populates="site")


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id"), nullable=True, index=True
    )
    event_type: Mapped[SecurityEventType] = mapped_column(Enum(SecurityEventType))
    channel: Mapped[Channel | None] = mapped_column(Enum(Channel), nullable=True)
    raw_message: Mapped[str | None] = mapped_column(Text)
    matched_pattern: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(50))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lead: Mapped[Lead | None] = relationship(back_populates="security_events")


class ProspectJob(Base):
    """Agendamento de jobs de prospecção por categoria+cidade."""
    __tablename__ = "prospect_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    leads_found: Mapped[int] = mapped_column(Integer, default=0)
    leads_qualified: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
