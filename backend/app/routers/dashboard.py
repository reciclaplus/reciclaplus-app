"""Dashboard statistics endpoint."""

import calendar
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.auth import require_role
from app.db import get_db
from app.models.collection import Collection
from app.models.pdr import Pdr
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

WeekRange = Literal["3m", "6m", "1y", "all"]

_RANGE_MONTHS: dict[str, int] = {"3m": 3, "6m": 6, "1y": 12}


def _months_ago(d: date, months: int) -> date:
    """Subtract `months` from `d`, clamping the day to the target month's length."""
    total = d.month - 1 - months
    year = d.year + total // 12
    month = total % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _range_cutoff(week_range: WeekRange) -> date | None:
    months = _RANGE_MONTHS.get(week_range)
    return _months_ago(date.today(), months) if months else None


class NeighborhoodCount(BaseModel):
    neighborhood: str
    count: int


class CommunityCount(BaseModel):
    community: str
    count: int


class CategoryCount(BaseModel):
    category: str
    count: int


class WeekCollections(BaseModel):
    year: int
    week: int
    collected: int
    empty: int
    unavailable: int
    closed: int
    total: int


class StatusBreakdown(BaseModel):
    status: str
    count: int


class DashboardStats(BaseModel):
    total_pdrs: int
    pdrs_by_neighborhood: list[NeighborhoodCount]
    pdrs_by_community: list[CommunityCount]
    pdrs_by_category: list[CategoryCount]
    collections_by_week: list[WeekCollections]
    current_status_breakdown: list[StatusBreakdown]


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    week_range: WeekRange = Query("all", alias="range"),
    neighborhood: str | None = Query(None),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("read")),
) -> DashboardStats:
    total_pdrs = db.scalar(select(func.count()).select_from(Pdr)) or 0

    by_neighborhood = db.execute(
        select(Pdr.neighborhood, func.count().label("count"))
        .group_by(Pdr.neighborhood)
        .order_by(func.count().desc())
    ).all()

    by_community = db.execute(
        select(Pdr.community, func.count().label("count"))
        .group_by(Pdr.community)
        .order_by(func.count().desc())
    ).all()

    by_category = db.execute(
        select(Pdr.category, func.count().label("count"))
        .group_by(Pdr.category)
        .order_by(func.count().desc())
    ).all()

    week_query = select(
        Collection.year,
        Collection.week,
        func.count().filter(Collection.status == "collected").label("collected"),
        func.count().filter(Collection.status == "empty").label("empty"),
        func.count().filter(Collection.status == "unavailable").label("unavailable"),
        func.count().filter(Collection.status == "closed").label("closed"),
        func.count().label("total"),
    )
    if neighborhood or category:
        week_query = week_query.join(Pdr, Pdr.id == Collection.pdr_id)
        if neighborhood:
            week_query = week_query.where(Pdr.neighborhood == neighborhood)
        if category:
            week_query = week_query.where(Pdr.category == category)
    cutoff = _range_cutoff(week_range)
    if cutoff:
        week_query = week_query.where(Collection.date >= cutoff)
    week_query = week_query.group_by(Collection.year, Collection.week).order_by(
        Collection.year, Collection.week
    )
    week_rows = db.execute(week_query).all()

    latest = db.execute(
        select(Collection.year, Collection.week)
        .order_by(Collection.year.desc(), Collection.week.desc())
        .limit(1)
    ).one_or_none()

    status_breakdown: list[StatusBreakdown] = []
    if latest:
        sb = db.execute(
            select(Collection.status, func.count().label("count"))
            .where(Collection.year == latest.year, Collection.week == latest.week)
            .group_by(Collection.status)
        ).all()
        status_breakdown = [StatusBreakdown(status=r.status, count=r.count) for r in sb]

    return DashboardStats(
        total_pdrs=total_pdrs,
        pdrs_by_neighborhood=[NeighborhoodCount(neighborhood=r.neighborhood, count=r.count) for r in by_neighborhood],
        pdrs_by_community=[CommunityCount(community=r.community, count=r.count) for r in by_community],
        pdrs_by_category=[CategoryCount(category=r.category, count=r.count) for r in by_category],
        collections_by_week=[
            WeekCollections(year=r.year, week=r.week, collected=r.collected, empty=r.empty, unavailable=r.unavailable, closed=r.closed, total=r.total)
            for r in week_rows
        ],
        current_status_breakdown=status_breakdown,
    )
