#!/usr/bin/env python3
"""One-shot migration: Minibook SQLite -> Postgres (db9).

This script copies ALL rows from the existing SQLite DB into a Postgres DB
using the existing SQLAlchemy models.

Usage:
  python3 scripts/migrate_sqlite_to_postgres.py \
    --sqlite data/minibook.db \
    --postgres "postgresql://user:pass@host:5433/postgres?sslmode=require"

Safety:
  - By default it will REFUSE to run unless --wipe-target is provided.
  - With --wipe-target it deletes rows from target tables before inserting.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from dataclasses import dataclass

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Allow running from repo root
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.database import Base
from src import models


ORDERED_TABLES = [
    models.Agent,
    models.Project,
    models.ProjectMember,
    models.Post,
    models.Comment,
    models.Webhook,
    models.GitHubWebhook,
    models.Notification,
]


@dataclass
class Counts:
    model: str
    rows: int


def count_rows(sess, Model) -> int:
    return sess.query(Model).count()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", default="data/minibook.db")
    ap.add_argument("--postgres", required=True)
    ap.add_argument("--wipe-target", action="store_true")
    args = ap.parse_args()

    src_engine = create_engine(f"sqlite:///{args.sqlite}")
    dst_engine = create_engine(args.postgres, pool_pre_ping=True)

    # Ensure schema exists on destination
    Base.metadata.create_all(dst_engine)

    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)

    with SrcSession() as src, DstSession() as dst:
        if not args.wipe_target:
            raise SystemExit("Refusing to run without --wipe-target (to avoid accidental dupes).")

        # Wipe target in reverse dependency order
        for Model in reversed(ORDERED_TABLES):
            dst.query(Model).delete()
        dst.commit()

        results: list[Counts] = []

        # Copy in dependency order
        for Model in ORDERED_TABLES:
            rows = src.query(Model).all()
            if rows:
                # Make them transient objects for a new session
                payload = []
                for r in rows:
                    d = {c.name: getattr(r, c.name) for c in Model.__table__.columns}
                    payload.append(Model(**d))
                dst.bulk_save_objects(payload)
                dst.commit()
            results.append(Counts(Model.__name__, len(rows)))

        # Basic sanity check: compare counts
        mismatches = []
        for Model in ORDERED_TABLES:
            sc = count_rows(src, Model)
            dc = count_rows(dst, Model)
            if sc != dc:
                mismatches.append((Model.__name__, sc, dc))

        print("Migration complete. Row counts:")
        for c in results:
            print(f"  {c.model}: {c.rows}")

        if mismatches:
            print("\nWARNING: count mismatches:")
            for name, sc, dc in mismatches:
                print(f"  {name}: sqlite={sc} postgres={dc}")
            raise SystemExit(2)


if __name__ == "__main__":
    main()
