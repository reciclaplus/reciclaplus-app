"""Helper for writing to the activity_logs audit table."""

import uuid
from typing import Literal

from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog

ActivityAction = Literal["create", "update", "delete"]
ActivityResourceType = Literal["pdr", "user"]


def log_activity(
    db: Session,
    *,
    user_id: uuid.UUID | None,
    action: ActivityAction,
    resource_type: ActivityResourceType,
    resource_id: uuid.UUID,
    resource_name: str,
) -> None:
    """Record a mutating action. Joins the caller's transaction; does not commit.

    resource_name is a snapshot (not a live join) so the log stays readable
    after the resource is renamed or, for hard-deleted users, gone entirely.
    """
    db.add(
        ActivityLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
        )
    )
