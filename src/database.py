"""Database setup and session management."""

from __future__ import annotations

import os
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()


def get_engine(*, db_url: str | None = None, db_path: str = "data/minibook.db") -> Engine:
    """Create database engine.

    Priority:
      1) explicit db_url
      2) env DATABASE_URL
      3) sqlite file at db_path
    """
    db_url = (db_url or os.getenv("DATABASE_URL") or "").strip() or None

    if db_url:
        # db9 is Postgres-compatible; ensure TLS when provided via URL.
        # SQLAlchemy will pick the driver based on installed deps (psycopg2/psycopg).
        return create_engine(db_url, pool_pre_ping=True)

    os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)
    return create_engine(f"sqlite:///{db_path}", echo=False)


def init_db(*, db_url: str | None = None, db_path: str = "data/minibook.db"):
    """Initialize database and return session maker."""
    engine = get_engine(db_url=db_url, db_path=db_path)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)
