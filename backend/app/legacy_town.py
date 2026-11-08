"""Transitional helpers while the app still behaves as a single town.

Until routes become town-scoped, writes have no town in their request, so new
rows are attributed to the one existing town. Everything here is removed in the
multi-town contract phase (issue 62).
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.town import Community, Neighborhood, Town

logger = logging.getLogger(__name__)

LEGACY_TOWN_NAME = "Sabana Yegua"


def legacy_town_id(db: Session) -> uuid.UUID | None:
    """The single existing town's id, or None if it can't be found.

    The town columns are nullable during the transition and the contract phase
    re-backfills, so a failed lookup must not block the write.
    """
    return db.execute(select(Town.id).where(Town.name == LEGACY_TOWN_NAME)).scalar_one_or_none()


def resolve_neighborhood_id(
    db: Session, town_id: uuid.UUID | None, community: str, neighborhood: str
) -> uuid.UUID | None:
    """Match a PDR's community/neighborhood text to its config row.

    Text isn't validated yet, so a combination with no config row is still
    accepted and left unlinked. The contract migration stops on any of these.
    """
    if town_id is None:
        return None
    neighborhood_id = db.execute(
        select(Neighborhood.id)
        .join(Community, Neighborhood.community_id == Community.id)
        .where(
            Community.town_id == town_id,
            Community.name == community,
            Neighborhood.name == neighborhood,
        )
    ).scalar_one_or_none()
    if neighborhood_id is None:
        logger.warning("PDR location has no config row: %s / %s", community, neighborhood)
    return neighborhood_id
