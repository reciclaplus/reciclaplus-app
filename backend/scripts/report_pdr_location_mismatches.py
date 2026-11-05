"""List PDRs whose community/neighborhood text has no matching config row.

The multi-town migration links each PDR to a neighborhood by matching this text,
and stops if any PDR doesn't match. Run this first and resolve what it lists.

Read-only (runs in a READ ONLY transaction). Targets DATABASE_URL, prints which
project that is, and refuses production without --allow-production.

Usage, from backend/:
    uv run python -m scripts.report_pdr_location_mismatches
"""

import argparse
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config import settings

PRODUCTION_REF = "fapvtagwtbvdzbqjhvlc"
TOWN_NAME = "Sabana Yegua"

MISMATCHES_SQL = text(
    """
    select
        p.community,
        p.neighborhood,
        count(*) filter (where p.deleted_at is null) as active_pdrs,
        count(*) filter (where p.deleted_at is not null) as deleted_pdrs,
        (
            select string_agg(c2.name, ', ' order by c2.name)
            from public.neighborhoods n2
            join public.communities c2 on c2.id = n2.community_id
            where c2.town_id = t.id and n2.name = p.neighborhood
        ) as neighborhood_exists_under
    from public.pdrs p
    cross join public.towns t
    where t.name = :town
      and not exists (
          select 1
          from public.communities c
          join public.neighborhoods n on n.community_id = c.id
          where c.town_id = t.id
            and c.name = p.community
            and n.name = p.neighborhood
      )
    group by p.community, p.neighborhood, t.id
    order by p.community, p.neighborhood
    """
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help="Allow reading production (needs explicit approval first).",
    )
    args = parser.parse_args()

    url = make_url(settings.database_url)
    is_production = PRODUCTION_REF in f"{url.username} {url.host}"
    print(f"Target: {url.username} @ {url.host}")
    if is_production:
        if not args.allow_production:
            print("This is PRODUCTION. Refusing without --allow-production.")
            return 2
        print("Reading from PRODUCTION (read-only).")

    engine = create_engine(url, connect_args={"connect_timeout": 15})
    with engine.connect() as conn:
        conn.execute(text("set transaction read only"))
        towns = conn.execute(text("select name from public.towns order by name")).scalars().all()
        total = conn.execute(text("select count(*) from public.pdrs")).scalar_one()
        rows = conn.execute(MISMATCHES_SQL, {"town": TOWN_NAME}).all()

    print(f"Towns: {', '.join(towns) or '(none)'}")
    if TOWN_NAME not in towns:
        print(f'"{TOWN_NAME}" not found: the migration would stop.')
        return 1

    unmatched = sum(r.active_pdrs + r.deleted_pdrs for r in rows)
    print(f"PDRs: {total} total, {unmatched} unmatched")
    for r in rows:
        hint = (
            f"  (barrio exists under: {r.neighborhood_exists_under})"
            if r.neighborhood_exists_under
            else ""
        )
        print(
            f"- {r.community} / {r.neighborhood}: "
            f"{r.active_pdrs} active, {r.deleted_pdrs} deleted{hint}"
        )
    return 1 if rows else 0


if __name__ == "__main__":
    sys.exit(main())
