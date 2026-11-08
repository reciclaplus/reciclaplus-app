"""Global account management is for superadmins only."""

from sqlalchemy import select

from app.models import ActivityLog, User
from tests.conftest import add_member, make_user


def test_town_admin_cannot_manage_accounts(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    other = make_user(db)
    client = api.as_user(admin)

    assert client.get("/users").status_code == 403
    assert client.put(f"/users/{other.email}", json={"is_superadmin": True}).status_code == 403
    assert client.delete(f"/users/{other.email}").status_code == 403
    db.refresh(other)
    assert (other.is_superadmin, other.deleted_at) == (False, None)


def test_superadmin_lists_accounts_without_roles(db, api):
    superadmin = make_user(db, superadmin=True)
    accounts = api.as_user(superadmin).get("/users").json()
    mine = next(a for a in accounts if a["email"] == superadmin.email)
    assert mine["is_superadmin"] is True
    assert "role" not in mine


def test_superadmin_promotes_and_demotes_others(db, api):
    superadmin = make_user(db, superadmin=True)
    other = make_user(db)
    client = api.as_user(superadmin)

    assert client.put(f"/users/{other.email}", json={"is_superadmin": True}).json()["is_superadmin"] is True
    # Omitted fields are left unchanged: renaming keeps superadmin.
    renamed = client.put(f"/users/{other.email}", json={"name": "Ana"}).json()
    assert (renamed["name"], renamed["is_superadmin"]) == ("Ana", True)
    assert client.put(f"/users/{other.email}", json={"is_superadmin": False}).json()["is_superadmin"] is False

    logged = db.scalars(select(ActivityLog).where(ActivityLog.resource_id == other.id)).all()
    assert len(logged) == 3
    assert all(entry.town_id is None for entry in logged)


def test_superadmin_cannot_demote_or_deactivate_themselves(db, api):
    superadmin = make_user(db, superadmin=True)
    client = api.as_user(superadmin)
    assert client.put(f"/users/{superadmin.email}", json={"is_superadmin": False}).status_code == 400
    assert client.delete(f"/users/{superadmin.email}").status_code == 400
    db.refresh(superadmin)
    assert (superadmin.is_superadmin, superadmin.deleted_at) == (True, None)


def test_deactivated_account_disappears_from_lists(db, api, town_a):
    superadmin = make_user(db, superadmin=True)
    member = make_user(db)
    add_member(db, member, town_a.town, "write")
    client = api.as_user(superadmin)

    assert client.delete(f"/users/{member.email}").status_code == 204
    assert member.email not in [a["email"] for a in client.get("/users").json()]
    members = client.get(f"/towns/{town_a.town.id}/members").json()
    assert member.email not in [m["email"] for m in members]
    assert db.get(User, member.id).deleted_at is not None
