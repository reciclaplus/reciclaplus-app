"""Declarative base for all SQLAlchemy models.

The SQL migrations in supabase/migrations/ are the source of truth for the
schema; these models are kept in sync with them by hand.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
