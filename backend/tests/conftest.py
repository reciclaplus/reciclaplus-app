"""Integration test fixtures.

Tests run against a real Postgres database named by TEST_DATABASE_URL, migrated
with supabase/migrations/. They are skipped if it isn't set, and refuse to run
against production. The test database is shared between worktrees, so each test
runs inside a transaction that is always rolled back.

To test a migration before applying it to the shared database, list its file(s)
in TEST_PENDING_MIGRATIONS (comma-separated): each test applies them inside its
own transaction first, so they're rolled back with everything else.
"""

import os
import uuid
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.main import app
from app.models import Community, Neighborhood, Pdr, Town, TownMember, User, WeightEntry

PRODUCTION_REF = "fapvtagwtbvdzbqjhvlc"


@pytest.fixture(scope="session")
def engine():
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is not set")
    url = make_url(database_url)
    if PRODUCTION_REF in f"{url.username} {url.host}":
        pytest.exit("TEST_DATABASE_URL points at PRODUCTION. Refusing to run.", returncode=2)
    engine = create_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def pending_migrations() -> list[str]:
    """SQL of migrations to apply, rolled back, in every test (see module doc)."""
    paths = [p.strip() for p in os.environ.get("TEST_PENDING_MIGRATIONS", "").split(",") if p.strip()]
    return [Path(p).read_text(encoding="utf-8") for p in paths]


@pytest.fixture
def connection(engine, pending_migrations):
    with engine.connect() as conn:
        transaction = conn.begin()
        for sql in pending_migrations:
            # Through the driver directly: migration SQL may contain "%", which
            # SQLAlchemy would read as parameter markers.
            conn.connection.driver_connection.execute(sql)
        yield conn
        transaction.rollback()


@pytest.fixture
def db(connection: Connection):
    """A session whose commits only release savepoints, so the outer transaction
    can roll everything back. Configured like the app's own sessions."""
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
        autoflush=False,
        expire_on_commit=False,
    )
    yield session
    session.close()


class ApiClient:
    """A test client that makes requests as a given user."""

    def __init__(self, client: TestClient):
        self.http = client

    def as_user(self, user: User) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: user
        return self.http


@pytest.fixture
def api(db: Session):
    app.dependency_overrides[get_db] = lambda: db
    yield ApiClient(TestClient(app))
    app.dependency_overrides.clear()


@dataclass
class TownFixture:
    town: Town
    community: Community
    neighborhood: Neighborhood
    pdr: Pdr
    weight: WeightEntry


# Factories commit (releasing a savepoint, see `db`) rather than only flush. Data
# already exists when a request starts in real use, so a route's rollback after a
# failed write has to leave it in place here too.

def make_user(db: Session, *, superadmin: bool = False) -> User:
    user = User(email=f"test-{uuid.uuid4().hex}@example.com", is_superadmin=superadmin)
    db.add(user)
    db.commit()
    return user


def make_town(db: Session) -> TownFixture:
    suffix = uuid.uuid4().hex
    town = Town(
        name=f"Test town {suffix}",
        map_center_lat=18.0,
        map_center_lng=-70.0,
        categories=["casa", "negocio"],
        plastic_types=["pet", "hdpe"],
    )
    db.add(town)
    db.flush()
    community = Community(town_id=town.id, name="Centro")
    db.add(community)
    db.flush()
    neighborhood = Neighborhood(community_id=community.id, name="Barrio")
    db.add(neighborhood)
    db.flush()
    pdr = Pdr(
        name=f"PDR {suffix}",
        category="casa",
        lat=18.0,
        lng=-70.0,
        town_id=town.id,
        neighborhood_id=neighborhood.id,
    )
    weight = WeightEntry(town_id=town.id, plastic_type="pet", weight_lbs=5, date="2026-01-05")
    db.add_all([pdr, weight])
    db.commit()
    return TownFixture(town, community, neighborhood, pdr, weight)


def add_member(db: Session, user: User, town: Town, role: str) -> None:
    db.add(TownMember(user_id=user.id, town_id=town.id, role=role))
    db.commit()


@pytest.fixture
def town_a(db: Session) -> TownFixture:
    return make_town(db)


@pytest.fixture
def town_b(db: Session) -> TownFixture:
    return make_town(db)
