"""The current frontend uses the unscoped routes until it moves to the town
routes, so they must keep working. Removed with them in the contract phase."""

from sqlalchemy import select

from app.legacy_town import LEGACY_TOWN_NAME
from app.models import Pdr, Town, WeightEntry
from tests.conftest import add_member, make_user


def _legacy_admin(db):
    """A global admin who is also a member of the legacy town, like every
    existing admin after the backfill."""
    user = make_user(db)
    user.role = "admin"
    legacy_town = db.scalar(select(Town).where(Town.name == LEGACY_TOWN_NAME))
    add_member(db, user, legacy_town, "admin")
    return user, legacy_town


def test_legacy_reads_still_work(db, api):
    user, legacy_town = _legacy_admin(db)
    client = api.as_user(user)
    for path in [
        "/towns",
        f"/towns/{legacy_town.id}",
        "/pdrs",
        "/pdrs/with-history",
        "/weights",
        "/dashboard/stats",
        "/collections/current",
        "/collections/2026/1",
    ]:
        assert client.get(path).status_code == 200, path


def test_legacy_auth_me_keeps_role(db, api):
    user, _ = _legacy_admin(db)
    assert api.as_user(user).get("/auth/me").json()["role"] == "admin"


def test_legacy_writes_still_link_to_the_town(db, api):
    user, legacy_town = _legacy_admin(db)
    client = api.as_user(user)
    community = legacy_town.communities[0]
    neighborhood = community.neighborhoods[0]

    created = client.post("/pdrs", json={
        "name": "legacy", "community": community.name, "neighborhood": neighborhood.name,
        "category": "casa", "lat": 18, "lng": -70,
    })
    assert created.status_code == 201
    pdr = db.get(Pdr, created.json()["id"])
    assert (pdr.town_id, pdr.neighborhood_id) == (legacy_town.id, neighborhood.id)

    weight = client.post("/weights", json={"date": "2026-02-02", "plastic_type": "pet", "weight_lbs": 1})
    assert weight.status_code == 201
    assert db.get(WeightEntry, weight.json()["id"]).town_id == legacy_town.id


def test_legacy_routes_stay_global_role_only(db, api, town_a):
    """A town admin with no global role gets no power on the old routes."""
    town_admin = make_user(db)
    add_member(db, town_admin, town_a.town, "admin")
    client = api.as_user(town_admin)
    assert client.get("/users").status_code == 403
    assert client.post("/weights", json={"date": "2026-02-02", "plastic_type": "pet", "weight_lbs": 1}).status_code == 403
