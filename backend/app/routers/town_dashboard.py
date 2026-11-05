"""Dashboard statistics endpoint, scoped to one town.

Groups by neighborhood and community ID rather than name, so two barrios with the
same name in different communities stay separate.
"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import TownAccess, require_town_role
from app.db import get_db
from app.models.collection import Collection
from app.models.pdr import Pdr
from app.models.town import Community, Neighborhood
from app.models.weight_entry import WeightEntry
from app.routers.dashboard import (
    CategoryCount,
    CommunityCount,
    DashboardStats,
    MonthWeight,
    NeighborhoodCount,
    StatusBreakdown,
    WeekCollections,
    WeekNeighborhoodCollections,
    WeekRange,
    _range_cutoff,
)

router = APIRouter(prefix="/towns/{town_id}/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    week_range: WeekRange = Query("all", alias="range"),
    neighborhood_id: uuid.UUID | None = Query(None),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("read")),
) -> DashboardStats:
    """This town's dashboard statistics. `range`, `neighborhood_id` and `category`
    narrow the weekly collection series only."""
    town_id = access.town.id
    active_pdr = (Pdr.town_id == town_id, Pdr.deleted_at.is_(None))
    # Falls back to stored text for a PDR not yet linked; removed in the contract
    # phase along with the text columns.
    neighborhood_name = func.coalesce(Neighborhood.name, Pdr.neighborhood).label("neighborhood")
    community_name = func.coalesce(Community.name, Pdr.community).label("community")

    total_pdrs = db.scalar(select(func.count()).select_from(Pdr).where(*active_pdr)) or 0

    by_neighborhood = db.execute(
        select(Pdr.neighborhood_id, neighborhood_name, func.count().label("count"))
        .select_from(Pdr)
        .outerjoin(Neighborhood, Pdr.neighborhood_id == Neighborhood.id)
        .where(*active_pdr)
        .group_by(Pdr.neighborhood_id, neighborhood_name)
        .order_by(func.count().desc())
    ).all()

    by_community = db.execute(
        select(Community.id.label("community_id"), community_name, func.count().label("count"))
        .select_from(Pdr)
        .outerjoin(Neighborhood, Pdr.neighborhood_id == Neighborhood.id)
        .outerjoin(Community, Neighborhood.community_id == Community.id)
        .where(*active_pdr)
        .group_by(Community.id, community_name)
        .order_by(func.count().desc())
    ).all()

    by_category = db.execute(
        select(Pdr.category, func.count().label("count"))
        .where(*active_pdr)
        .group_by(Pdr.category)
        .order_by(func.count().desc())
    ).all()

    # Weekly series keep collections of soft-deleted PDRs: they did happen.
    filters = [Pdr.town_id == town_id]
    if neighborhood_id:
        filters.append(Pdr.neighborhood_id == neighborhood_id)
    if category:
        filters.append(Pdr.category == category)
    cutoff = _range_cutoff(week_range)
    if cutoff:
        filters.append(Collection.date >= cutoff)

    week_rows = db.execute(
        select(
            Collection.year,
            Collection.week,
            func.count().filter(Collection.status == "collected").label("collected"),
            func.count().filter(Collection.status == "empty").label("empty"),
            func.count().filter(Collection.status == "unavailable").label("unavailable"),
            func.count().filter(Collection.status == "closed").label("closed"),
            func.count().label("total"),
        )
        .join(Pdr, Pdr.id == Collection.pdr_id)
        .where(*filters)
        .group_by(Collection.year, Collection.week)
        .order_by(Collection.year, Collection.week)
    ).all()

    week_neighborhood_rows = db.execute(
        select(
            Collection.year,
            Collection.week,
            Pdr.neighborhood_id,
            neighborhood_name,
            func.count().filter(Collection.status == "collected").label("collected"),
        )
        .join(Pdr, Pdr.id == Collection.pdr_id)
        .outerjoin(Neighborhood, Pdr.neighborhood_id == Neighborhood.id)
        .where(*filters)
        .group_by(Collection.year, Collection.week, Pdr.neighborhood_id, neighborhood_name)
        .order_by(Collection.year, Collection.week)
    ).all()

    month_rows = db.execute(
        select(
            func.extract("year", WeightEntry.date).label("year"),
            func.extract("month", WeightEntry.date).label("month"),
            WeightEntry.plastic_type,
            func.sum(WeightEntry.weight_lbs).label("weight_lbs"),
        )
        .where(WeightEntry.town_id == town_id)
        .group_by("year", "month", WeightEntry.plastic_type)
        .order_by("year", "month")
    ).all()

    # The latest week with collections in this town, not across all towns.
    latest = db.execute(
        select(Collection.year, Collection.week)
        .join(Pdr, Pdr.id == Collection.pdr_id)
        .where(Pdr.town_id == town_id)
        .order_by(Collection.year.desc(), Collection.week.desc())
        .limit(1)
    ).one_or_none()

    status_breakdown: list[StatusBreakdown] = []
    if latest:
        rows = db.execute(
            select(Collection.status, func.count().label("count"))
            .join(Pdr, Pdr.id == Collection.pdr_id)
            .where(
                Pdr.town_id == town_id,
                Collection.year == latest.year,
                Collection.week == latest.week,
            )
            .group_by(Collection.status)
        ).all()
        status_breakdown = [StatusBreakdown(status=r.status, count=r.count) for r in rows]

    return DashboardStats(
        total_pdrs=total_pdrs,
        pdrs_by_neighborhood=[
            NeighborhoodCount(neighborhood_id=r.neighborhood_id, neighborhood=r.neighborhood, count=r.count)
            for r in by_neighborhood
        ],
        pdrs_by_community=[
            CommunityCount(community_id=r.community_id, community=r.community, count=r.count)
            for r in by_community
        ],
        pdrs_by_category=[CategoryCount(category=r.category, count=r.count) for r in by_category],
        collections_by_week=[
            WeekCollections(
                year=r.year,
                week=r.week,
                collected=r.collected,
                empty=r.empty,
                unavailable=r.unavailable,
                closed=r.closed,
                total=r.total,
            )
            for r in week_rows
        ],
        collections_by_week_by_neighborhood=[
            WeekNeighborhoodCollections(
                year=r.year,
                week=r.week,
                neighborhood_id=r.neighborhood_id,
                neighborhood=r.neighborhood,
                collected=r.collected,
            )
            for r in week_neighborhood_rows
        ],
        current_status_breakdown=status_breakdown,
        weight_by_month=[
            MonthWeight(
                year=int(r.year),
                month=int(r.month),
                plastic_type=r.plastic_type,
                weight_lbs=float(r.weight_lbs),
            )
            for r in month_rows
        ],
    )
