"""Per-town roles, members, archiving and audit logging."""

from datetime import datetime, timezone

from sqlalchemy import select

from app.models import ActivityLog, Community, Neighborhood, Pdr, Town, TownMember, User
from tests.conftest import add_member, make_user


def _logs(db, town_id, resource_type):
    return db.scalars(
        select(ActivityLog).where(
            ActivityLog.town_id == town_id, ActivityLog.resource_type == resource_type
        )
    ).all()


def _town_payload(town, **overrides):
    return {
        "name": town.name,
        "map_center_lat": town.map_center_lat,
        "map_center_lng": town.map_center_lng,
        "categories": town.categories,
        **overrides,
    }


# --- Roles apply per town ---

def test_same_user_has_different_roles_per_town(db, api, town_a, town_b):
    user = make_user(db)
    add_member(db, user, town_a.town, "write")
    add_member(db, user, town_b.town, "read")
    client = api.as_user(user)
    new_weight = {"date": "2026-02-02", "plastic_type": "pet", "weight_lbs": 1}

    assert client.post(f"/towns/{town_a.town.id}/weights", json=new_weight).status_code == 201
    assert client.post(f"/towns/{town_b.town.id}/weights", json=new_weight).status_code == 403
    assert client.get(f"/towns/{town_b.town.id}/weights").status_code == 200


def test_role_hierarchy_within_a_town(db, api, town_a):
    town_id = town_a.town.id
    read, write, admin = make_user(db), make_user(db), make_user(db)
    add_member(db, read, town_a.town, "read")
    add_member(db, write, town_a.town, "write")
    add_member(db, admin, town_a.town, "admin")
    pdr_url = f"/towns/{town_id}/pdrs/{town_a.pdr.id}"
    rename = {"name": "renamed"}

    assert api.as_user(read).get(pdr_url).status_code == 200
    assert api.as_user(read).put(pdr_url, json=rename).status_code == 403
    assert api.as_user(read).get(f"/towns/{town_id}/members").status_code == 403

    assert api.as_user(write).put(pdr_url, json=rename).status_code == 200
    assert api.as_user(write).get(f"/towns/{town_id}/members").status_code == 403
    assert api.as_user(write).put(f"/towns/{town_id}", json=_town_payload(town_a.town)).status_code == 403

    assert api.as_user(admin).get(f"/towns/{town_id}/members").status_code == 200
    assert api.as_user(admin).put(f"/towns/{town_id}", json=_town_payload(town_a.town)).status_code == 200


def test_superadmin_acts_as_admin_without_membership(db, api, town_a):
    superadmin = make_user(db, superadmin=True)
    client = api.as_user(superadmin)
    assert client.get(f"/towns/{town_a.town.id}/members").status_code == 200
    me = client.get("/auth/me").json()
    assert me["is_superadmin"] is True
    assert {"id": str(town_a.town.id), "name": town_a.town.name, "role": "admin"} in me["towns"]


# --- Only superadmins manage towns themselves ---

def test_town_admin_cannot_manage_towns(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    client = api.as_user(admin)
    town_id = town_a.town.id

    payload = {"name": "New town", "map_center_lat": 18, "map_center_lng": -70}
    assert client.post("/towns", json=payload).status_code == 403
    assert client.post(f"/towns/{town_id}/archive").status_code == 403
    assert client.post(f"/towns/{town_id}/restore").status_code == 403
    assert client.delete(f"/towns/{town_id}").status_code == 403


def test_superadmin_creates_town_with_default_settings(db, api):
    client = api.as_user(make_user(db, superadmin=True))
    response = client.post(
        "/towns", json={"name": "Brand new town", "map_center_lat": 18, "map_center_lng": -70}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["map_zoom"] == 13
    assert body["plastic_types"] == ["pet", "hdpe", "pp", "trash"]
    assert body["report_partner_text"] is None
    assert _logs(db, body["id"], "town")


def test_duplicate_town_name_is_a_conflict(db, api, town_a):
    client = api.as_user(make_user(db, superadmin=True))
    response = client.post(
        "/towns", json={"name": town_a.town.name, "map_center_lat": 18, "map_center_lng": -70}
    )
    assert response.status_code == 409


def test_town_settings_keep_omitted_values(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    client = api.as_user(admin)
    url = f"/towns/{town_a.town.id}"

    set_all = _town_payload(town_a.town, map_zoom=15, plastic_types=["pet"], report_partner_text="Socio")
    body = client.put(url, json=set_all).json()
    assert (body["map_zoom"], body["plastic_types"], body["report_partner_text"]) == (15, ["pet"], "Socio")

    body = client.put(url, json=_town_payload(town_a.town)).json()
    assert (body["map_zoom"], body["plastic_types"], body["report_partner_text"]) == (15, ["pet"], "Socio")


# --- Archiving and deleting ---

def test_archived_town_blocks_access_until_restored(db, api, town_a):
    member = make_user(db)
    add_member(db, member, town_a.town, "admin")
    superadmin = make_user(db, superadmin=True)
    pdrs_url = f"/towns/{town_a.town.id}/pdrs"

    assert api.as_user(superadmin).post(f"/towns/{town_a.town.id}/archive").status_code == 200
    db.expire_all()
    assert api.as_user(member).get(pdrs_url).status_code == 403
    assert api.as_user(superadmin).get(pdrs_url).status_code == 403
    assert api.as_user(member).get("/towns").json() == []
    assert api.as_user(member).get("/auth/me").json()["towns"] == []

    listed = api.as_user(superadmin).get("/towns", params={"include_archived": True}).json()
    assert str(town_a.town.id) in [t["id"] for t in listed]
    hidden = api.as_user(superadmin).get("/towns").json()
    assert str(town_a.town.id) not in [t["id"] for t in hidden]

    assert api.as_user(superadmin).post(f"/towns/{town_a.town.id}/restore").status_code == 200
    db.expire_all()
    assert api.as_user(member).get(pdrs_url).status_code == 200


def test_member_cannot_list_archived_towns(db, api, town_a):
    member = make_user(db)
    add_member(db, member, town_a.town, "admin")
    api.as_user(make_user(db, superadmin=True)).post(f"/towns/{town_a.town.id}/archive")
    db.expire_all()
    assert api.as_user(member).get("/towns", params={"include_archived": True}).json() == []


def test_town_with_data_cannot_be_deleted(db, api, town_a):
    client = api.as_user(make_user(db, superadmin=True))
    assert client.delete(f"/towns/{town_a.town.id}").status_code == 409
    db.expire_all()
    assert db.get(Town, town_a.town.id) is not None
    assert db.get(Community, town_a.community.id) is not None
    assert db.get(Neighborhood, town_a.neighborhood.id) is not None
    assert db.get(Pdr, town_a.pdr.id).town_id == town_a.town.id


def test_town_with_only_soft_deleted_pdr_cannot_be_deleted(db, api, town_a):
    client = api.as_user(make_user(db, superadmin=True))
    town_id = town_a.town.id
    assert client.delete(f"/towns/{town_id}/pdrs/{town_a.pdr.id}").status_code == 204
    assert client.delete(f"/towns/{town_id}/weights/{town_a.weight.id}").status_code == 204
    assert client.delete(f"/towns/{town_id}").status_code == 409


def test_empty_town_can_be_deleted(db, api):
    client = api.as_user(make_user(db, superadmin=True))
    created = client.post("/towns", json={"name": "Empty town", "map_center_lat": 18, "map_center_lng": -70})
    town_id = created.json()["id"]
    assert client.delete(f"/towns/{town_id}").status_code == 204
    assert client.get(f"/towns/{town_id}").status_code == 404


def test_barrio_in_use_cannot_be_deleted(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    response = api.as_user(admin).delete(f"/neighborhoods/{town_a.neighborhood.id}")
    assert response.status_code == 409
    assert "barrio" in response.json()["detail"]
    db.expire_all()
    assert db.get(Neighborhood, town_a.neighborhood.id) is not None


def test_failed_delete_leaves_no_log_entry(db, api, town_a):
    client = api.as_user(make_user(db, superadmin=True))
    assert client.delete(f"/towns/{town_a.town.id}").status_code == 409
    logged = db.scalars(
        select(ActivityLog).where(ActivityLog.resource_id == town_a.town.id)
    ).all()
    assert logged == []


# --- Category and plastic type lists ---

def test_category_validated_only_when_changed(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    client = api.as_user(admin)
    url = f"/towns/{town_a.town.id}/pdrs/{town_a.pdr.id}"

    assert client.put(url, json={"category": "inventada"}).status_code == 422

    # A category removed from the list stays on the PDR, which remains editable.
    settings = _town_payload(town_a.town, categories=["negocio"])
    assert client.put(f"/towns/{town_a.town.id}", json=settings).status_code == 200
    response = client.put(url, json={"name": "renamed", "category": "casa"})
    assert response.status_code == 200
    assert response.json()["category"] == "casa"
    assert client.get(url).json()["category"] == "casa"


def test_plastic_type_validated_only_when_changed(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    client = api.as_user(admin)
    base = f"/towns/{town_a.town.id}/weights"
    entry = {"date": "2026-02-02", "weight_lbs": 1}

    assert client.post(base, json={**entry, "plastic_type": "pp"}).status_code == 422
    assert client.post(base, json={**entry, "plastic_type": "hdpe"}).status_code == 201

    # The fixture's entry uses pet: removing pet keeps it readable and editable.
    settings = _town_payload(town_a.town, plastic_types=["hdpe"])
    assert client.put(f"/towns/{town_a.town.id}", json=settings).status_code == 200
    response = client.put(f"{base}/{town_a.weight.id}", json={"weight_lbs": 9})
    assert response.status_code == 200
    assert response.json()["plastic_type"] == "pet"
    assert client.post(base, json={**entry, "plastic_type": "pet"}).status_code == 422


# --- PDR locations come from their links ---

def test_renaming_a_barrio_shows_on_its_pdrs(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    client = api.as_user(admin)
    assert client.put(f"/neighborhoods/{town_a.neighborhood.id}", json={"name": "Nuevo"}).status_code == 200
    db.expire_all()

    town_id = town_a.town.id
    pdr = client.get(f"/towns/{town_id}/pdrs/{town_a.pdr.id}").json()
    assert pdr["neighborhood"] == "Nuevo"
    assert pdr["neighborhood_id"] == str(town_a.neighborhood.id)
    assert pdr["community_id"] == str(town_a.community.id)
    assert client.get(f"/towns/{town_id}/collections/2026/1").json()[0]["neighborhood"] == "Nuevo"
    stats = client.get(f"/towns/{town_id}/dashboard/stats").json()
    assert stats["pdrs_by_neighborhood"][0]["neighborhood"] == "Nuevo"


def test_new_pdr_takes_its_community_from_the_barrio(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    response = api.as_user(admin).post(f"/towns/{town_a.town.id}/pdrs", json={
        "name": "Nuevo", "neighborhood_id": str(town_a.neighborhood.id),
        "category": "casa", "lat": 18, "lng": -70,
    })
    assert response.status_code == 201
    body = response.json()
    assert body["community"] == town_a.community.name
    assert body["town_id"] == str(town_a.town.id)


def test_same_barrio_name_in_two_communities_stays_separate(db, api, town_a):
    other_community = Community(town_id=town_a.town.id, name="Otra")
    db.add(other_community)
    db.flush()
    twin = Neighborhood(community_id=other_community.id, name=town_a.neighborhood.name)
    db.add(twin)
    db.flush()
    db.add(Pdr(
        name="twin", community="Otra", neighborhood=twin.name, category="casa",
        lat=18, lng=-70, town_id=town_a.town.id, neighborhood_id=twin.id,
    ))
    db.flush()
    user = make_user(db)
    add_member(db, user, town_a.town, "read")

    url = f"/towns/{town_a.town.id}/dashboard/stats"
    stats = api.as_user(user).get(url).json()
    assert len(stats["pdrs_by_neighborhood"]) == 2
    filtered = api.as_user(user).get(url, params={"neighborhood_id": str(twin.id)})
    assert filtered.status_code == 200


# --- Members ---

def test_add_member_creates_account(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    url = f"/towns/{town_a.town.id}/members"
    response = api.as_user(admin).post(url, json={"email": " New@Example.com ", "name": "Ana", "role": "admin"})
    assert response.status_code == 201
    body = response.json()
    assert (body["email"], body["name"], body["role"]) == ("new@example.com", "Ana", "admin")

    # The account gets no power on the legacy global routes.
    created = db.scalar(select(User).where(User.email == "new@example.com"))
    assert created.role == "read"
    assert created.is_superadmin is False
    assert _logs(db, town_a.town.id, "member")[0].resource_name == "new@example.com"


def test_add_existing_user_only_adds_membership(db, api, town_a, town_b):
    admin_a = make_user(db)
    add_member(db, admin_a, town_a.town, "admin")
    other = make_user(db)
    other.name = "Original"
    add_member(db, other, town_b.town, "write")
    db.flush()

    response = api.as_user(admin_a).post(
        f"/towns/{town_a.town.id}/members",
        json={"email": other.email, "name": "Renamed", "role": "read"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Original"
    db.refresh(other)
    assert other.name == "Original"
    # Their role elsewhere is untouched, and the response doesn't mention it.
    assert db.get(TownMember, (other.id, town_b.town.id)).role == "write"
    assert "towns" not in response.json()


def test_adding_a_member_twice_is_a_conflict(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    member = make_user(db)
    add_member(db, member, town_a.town, "read")
    response = api.as_user(admin).post(
        f"/towns/{town_a.town.id}/members", json={"email": member.email, "role": "write"}
    )
    assert response.status_code == 409
    assert db.get(TownMember, (member.id, town_a.town.id)).role == "read"


def test_add_member_reactivates_deactivated_account(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    former = make_user(db)
    former.deleted_at = datetime.now(timezone.utc)
    db.flush()
    response = api.as_user(admin).post(
        f"/towns/{town_a.town.id}/members", json={"email": former.email, "role": "write"}
    )
    assert response.status_code == 201
    db.refresh(former)
    assert former.deleted_at is None


def test_change_role_and_remove_member(db, api, town_a, town_b):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    member = make_user(db)
    add_member(db, member, town_a.town, "read")
    add_member(db, member, town_b.town, "write")
    client = api.as_user(admin)
    url = f"/towns/{town_a.town.id}/members/{member.id}"

    assert client.put(url, json={"role": "write"}).json()["role"] == "write"
    assert client.delete(url).status_code == 204
    db.expire_all()
    assert db.get(TownMember, (member.id, town_a.town.id)) is None
    # Their account and other town are unaffected.
    assert db.get(User, member.id).deleted_at is None
    assert db.get(TownMember, (member.id, town_b.town.id)).role == "write"
    assert {l.action for l in _logs(db, town_a.town.id, "member")} == {"update", "delete"}


def test_cannot_manage_member_of_another_town_through_own_town(db, api, town_a, town_b):
    admin_a = make_user(db)
    add_member(db, admin_a, town_a.town, "admin")
    member_b = make_user(db)
    add_member(db, member_b, town_b.town, "read")
    client = api.as_user(admin_a)

    url = f"/towns/{town_a.town.id}/members/{member_b.id}"
    assert client.put(url, json={"role": "admin"}).status_code == 404
    assert client.delete(url).status_code == 404
    assert db.get(TownMember, (member_b.id, town_b.town.id)).role == "read"


def test_town_admin_cannot_lock_themselves_out(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    client = api.as_user(admin)
    url = f"/towns/{town_a.town.id}/members/{admin.id}"
    assert client.put(url, json={"role": "read"}).status_code == 400
    assert client.delete(url).status_code == 400
    assert db.get(TownMember, (admin.id, town_a.town.id)).role == "admin"


def test_members_list_excludes_deactivated_users(db, api, town_a):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    gone = make_user(db)
    add_member(db, gone, town_a.town, "read")
    gone.deleted_at = datetime.now(timezone.utc)
    db.flush()
    emails = [m["email"] for m in api.as_user(admin).get(f"/towns/{town_a.town.id}/members").json()]
    assert emails == [admin.email]


# --- Audit log ---

def test_mutations_log_their_town(db, api, town_a, town_b):
    admin = make_user(db)
    add_member(db, admin, town_a.town, "admin")
    client = api.as_user(admin)
    town_id = town_a.town.id

    assert client.post(f"/towns/{town_id}/weights", json={"date": "2026-02-02", "plastic_type": "pet", "weight_lbs": 1}).status_code == 201
    assert client.post(f"/towns/{town_id}/collections/2026/1", json={"entries": [{"pdr_id": str(town_a.pdr.id), "status": "collected"}]}).status_code == 200
    assert client.put(f"/towns/{town_id}/pdrs/{town_a.pdr.id}", json={"name": "x"}).status_code == 200
    assert client.put(f"/towns/{town_id}", json=_town_payload(town_a.town)).status_code == 200
    created = client.post(f"/towns/{town_id}/communities", json={"name": "Nueva"})
    assert created.status_code == 201
    community_id = created.json()["id"]
    barrio = client.post(f"/communities/{community_id}/neighborhoods", json={"name": "Nuevo"})
    assert barrio.status_code == 201

    for resource_type in ("weight", "collection", "pdr", "town", "community", "neighborhood"):
        assert _logs(db, town_id, resource_type), f"No {resource_type} log for this town"
        assert not _logs(db, town_b.town.id, resource_type), f"{resource_type} logged on the other town"


def test_collection_save_logs_one_entry_per_save(db, api, town_a):
    second = Pdr(
        name="second", community="Centro", neighborhood="Barrio", category="casa", lat=18, lng=-70,
        town_id=town_a.town.id, neighborhood_id=town_a.neighborhood.id,
    )
    db.add(second)
    db.flush()
    user = make_user(db)
    add_member(db, user, town_a.town, "write")
    response = api.as_user(user).post(
        f"/towns/{town_a.town.id}/collections/2026/1",
        json={"entries": [
            {"pdr_id": str(town_a.pdr.id), "status": "collected"},
            {"pdr_id": str(second.id), "status": "empty"},
        ]},
    )
    assert response.status_code == 200
    assert len(_logs(db, town_a.town.id, "collection")) == 1
