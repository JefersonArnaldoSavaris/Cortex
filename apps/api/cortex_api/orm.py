from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserORM(Base):
    __tablename__ = "usuarios"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False, default="user")
    plan: Mapped[str] = mapped_column(Text, nullable=False, default="free")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="trial")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    broker_connections: Mapped[list["BrokerConnectionORM"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class BrokerConnectionORM(Base):
    __tablename__ = "conexoes_corretora"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(Text, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    provider: Mapped[str] = mapped_column(Text, nullable=False, default="mt5")
    login: Mapped[int] = mapped_column(Integer, nullable=False)
    server: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_password: Mapped[str] = mapped_column(Text, nullable=False)
    terminal_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    connection_status: Mapped[str] = mapped_column(Text, nullable=False, default="connected")
    account_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    company: Mapped[str | None] = mapped_column(Text, nullable=True)
    currency: Mapped[str | None] = mapped_column(Text, nullable=True)
    balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    equity: Mapped[float | None] = mapped_column(Float, nullable=True)
    margin: Mapped[float | None] = mapped_column(Float, nullable=True)
    trade_allowed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    user: Mapped[UserORM] = relationship(back_populates="broker_connections")


class AnalysisORM(Base):
    __tablename__ = "analises"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    analysis_date: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    quick_model: Mapped[str] = mapped_column(Text, nullable=False)
    deep_model: Mapped[str] = mapped_column(Text, nullable=False)
    analysts_json: Mapped[str] = mapped_column(Text, nullable=False)
    research_depth: Mapped[int] = mapped_column(Integer, nullable=False)
    output_language: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    checkpoint: Mapped[bool] = mapped_column(nullable=False, default=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    decision: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    events: Mapped[list["AnalysisEventORM"]] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        order_by="AnalysisEventORM.timestamp",
    )


class AnalysisEventORM(Base):
    __tablename__ = "eventos_analise"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[str] = mapped_column(Text, ForeignKey("analises.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    level: Mapped[str] = mapped_column(Text, nullable=False, default="info")
    message: Mapped[str] = mapped_column(Text, nullable=False)

    analysis: Mapped[AnalysisORM] = relationship(back_populates="events")
