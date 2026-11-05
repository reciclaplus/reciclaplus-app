"""A town's data must never be reachable through another town.

Shared tables mean isolation rests entirely on the backend, so these tests are
the main protection against a missed filter or permission check.
"""

import re
import uuid

from sqlalchemy import select

from app.main import app
from app.models import Collection, WeightEntry
from tests.conftest import add_member, make_user

HTTP_METHODS = {"get", "post", "put", "delete", "patch"}

# Routes not scoped to a town through their path, each for a known reason. A new
# route must be town-scoped or be added here, so it can't be left out by accident.
UNSCOPED_ROUTES = {
    "/health",
    "/auth/me",
    "/towns",
    # Authorize against the row's own town: covered by their own tests below.
    "/communities/{community_id}",
    "/communities/{community_id}/neighborhoods",
    "/neighborhoods/{neighborhood_id}",
    # Legacy: removed in the multi-town contract phase.
    "/collections/current",
    "/collections/{year}/{week}",
    "/dashboard/stats",
    "/pdrs",
    "/pdrs/with-history",
    "/pdrs/{pdr_id}",
    "/users",
    "/users/{email}",
    "/weights",
    "/weights/{entry_id}",
}


def _openapi_routes():
    for path, operations in app.openapi()["paths"].items():
        for method in operations:
            if method in HTTP_METHODS:
                yield method.upper(), path


def _fill_path(path: str, town_id: uuid.UUID) -> str:
    """Fill a route's path parameters, using real-looking values for the rest."""
    path = path.replace("{town_id}", str(town_id))
    path = path.replace("{year}", "2026").replace("{week}", "1")
    return re.sub(r"\{\w+\}", str(uuid.uuid4()), path)


def test_every_route_is_town_scoped_or_explicitly_listed():
    unknown = {
        path
        for _, path in _openapi_routes()
        if not path.startswith("/towns/{town_id}") and path not in UNSCOPED_ROUTES
    }
    assert not unknown, f"Not town-scoped and not in UNSCOPED_ROUTES: {sorted(unknown)}"


def test_admin_of_one_town_is_forbidden_on_every_route_of_another(db, api, town_a, town_b):
    """Reads the route list from the API, so new town routes are covered too."""
    admin_a = make_user(db)
    add_member(db, admin_a, town_a.town, "admin")
    client = api.as_user(admin_a)

    routes = [(m, p) for m, p in _openapi_routes() if p.startswith("/towns/{town_id}")]
    assert len(routes) >= 20, "Expected the town routes to be discovered"

    allowed = []
    for method, path in routes:
        response = client.request(method, _fill_path(path, town_b.town.id), json={})
        if response.status_code != 403:
            allowed.append(f"{method} {path} -> {response.status_code}")
    assert not allowed, allowed


def test_unknown_town_is_not_found(db, api):
    superadmin = make_user(db, superadmin=True)
    response = api.as_user(superadmin).get(f"/towns/{uuid.uuid4()}/pdrs")
    assert response.status_code == 404


# --- IDs from another town, used under a town the caller can access ---

def test_pdr_from_another_town_is_not_found(db, api, town_a, town_b):
    user = make_user(db)
    add_member(db, user, town_a.town, "admin")
    client = api.as_user(user)
    base = f"/towns/{town_a.town.id}/pdrs/{town_b.pdr.id}"

    assert client.get(base).status_code == 404
    assert client.put(base, json={"name": "hacked"}).status_code == 404
    assert client.delete(base).status_code == 404
    db.refresh(town_b.pdr)
    assert town_b.pdr.name != "hacked"
    assert town_b.pdr.deleted_at is None


def test_weight_from_another_town_is_not_found(db, api, town_a, town_b):
    user = make_user(db)
    add_member(db, user, town_a.town, "admin")
    client = api.as_user(user)
    base = f"/towns/{town_a.town.id}/weights/{town_b.weight.id}"

    assert client.put(base, json={"weight_lbs": 99}).status_code == 404
    assert client.delete(base).status_code == 404
    assert db.get(WeightEntry, town_b.weight.id) is not None


def test_collection_save_rejects_pdr_from_another_town_entirely(db, api, town_a, town_b):
    user = make_user(db)
    add_member(db, user, town_a.town, "write")
    response = api.as_user(user).post(
        f"/towns/{town_a.town.id}/collections/2026/1",
        json={"entries": [
            {"pdr_id": str(town_a.pdr.id), "status": "collected"},
            {"pdr_id": str(town_b.pdr.id), "status": "collected"},
        ]},
    )
    assert response.status_code == 422
    saved = db.scalars(
        select(Collection).where(Collection.pdr_id.in_([town_a.pdr.id, town_b.pdr.id]))
    ).all()
    assert saved == []


def test_collection_save_accepts_soft_deleted_pdr_in_same_town(db, api, town_a):
    """Marks queued offline for a PDR deleted meanwhile must not block the queue."""
    user = make_user(db)
    add_member(db, user, town_a.town, "write")
    client = api.as_user(user)
    assert client.delete(f"/towns/{town_a.town.id}/pdrs/{town_a.pdr.id}").status_code == 204

    response = client.post(
        f"/towns/{town_a.town.id}/collections/2026/1",
        json={"entries": [{"pdr_id": str(town_a.pdr.id), "status": "empty"}]},
    )
    assert response.status_code == 200


def test_pdr_write_rejects_neighborhood_from_another_town(db, api, town_a, town_b):
    user = make_user(db)
    add_member(db, user, town_a.town, "write")
    client = api.as_user(user)
    base = f"/towns/{town_a.town.id}/pdrs"

    created = client.post(base, json={
        "name": "x", "neighborhood_id": str(town_b.neighborhood.id),
        "category": "casa", "lat": 18, "lng": -70,
    })
    assert created.status_code == 422
    updated = client.put(f"{base}/{town_a.pdr.id}", json={"neighborhood_id": str(town_b.neighborhood.id)})
    assert updated.status_code == 422
    db.refresh(town_a.pdr)
    assert town_a.pdr.neighborhood_id == town_a.neighborhood.id


def test_config_of_another_town_is_forbidden(db, api, town_a, town_b):
    admin_a = make_user(db)
    add_member(db, admin_a, town_a.town, "admin")
    client = api.as_user(admin_a)
    name = {"name": "hacked"}

    community = f"/communities/{town_b.community.id}"
    neighborhood = f"/neighborhoods/{town_b.neighborhood.id}"
    assert client.put(community, json=name).status_code == 403
    assert client.delete(community).status_code == 403
    assert client.post(f"{community}/neighborhoods", json=name).status_code == 403
    assert client.put(neighborhood, json=name).status_code == 403
    assert client.delete(neighborhood).status_code == 403


# --- Reads return only this town's data ---

def test_reads_return_only_this_towns_data(db, api, town_a, town_b):
    user = make_user(db)
    add_member(db, user, town_a.town, "read")
    client = api.as_user(user)
    base = f"/towns/{town_a.town.id}"
    db.add(Collection(pdr_id=town_b.pdr.id, year=2026, week=1, status="collected", date="2026-01-05"))
    db.flush()

    assert [p["id"] for p in client.get(f"{base}/pdrs").json()] == [str(town_a.pdr.id)]
    assert [p["id"] for p in client.get(f"{base}/pdrs/with-history").json()] == [str(town_a.pdr.id)]
    assert [w["id"] for w in client.get(f"{base}/weights").json()] == [str(town_a.weight.id)]

    week = client.get(f"{base}/collections/2026/1").json()
    assert [r["pdr_id"] for r in week] == [str(town_a.pdr.id)]
    assert week[0]["status"] is None

    stats = client.get(f"{base}/dashboard/stats").json()
    assert stats["total_pdrs"] == 1
    assert stats["collections_by_week"] == []
    assert stats["current_status_breakdown"] == []
    assert sum(m["weight_lbs"] for m in stats["weight_by_month"]) == 5


def test_town_lists_show_only_accessible_towns(db, api, town_a, town_b):
    user = make_user(db)
    add_member(db, user, town_a.town, "write")
    client = api.as_user(user)

    assert [t["id"] for t in client.get("/towns").json()] == [str(town_a.town.id)]
    me = client.get("/auth/me").json()
    assert me["is_superadmin"] is False
    assert me["towns"] == [{"id": str(town_a.town.id), "name": town_a.town.name, "role": "write"}]


def test_user_with_no_town_sees_nothing(db, api, town_a):
    user = make_user(db)
    client = api.as_user(user)
    assert client.get("/towns").json() == []
    assert client.get("/auth/me").json()["towns"] == []
