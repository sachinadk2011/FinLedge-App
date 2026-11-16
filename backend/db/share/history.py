"""Read-only, stably ordered queries for the unified Share Portfolio history."""

from __future__ import annotations

import sqlite3

from .identity import normalize_share_name


def list_share_history(
    connection: sqlite3.Connection,
    *,
    investment_name: str | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[sqlite3.Row]:
    """Read canonical events from the view without combining their write paths."""
    if not 1 <= limit <= 5000 or offset < 0:
        raise ValueError("limit must be 1..5000 and offset must be nonnegative")
    order = """
        ORDER BY txn_date,
                 CASE entity_type WHEN 'sip' THEN 1 ELSE 0 END,
                 sequence_no,
                 row_id
        LIMIT ? OFFSET ?
    """
    if investment_name is None:
        return list(connection.execute(
            f"SELECT * FROM v_share_history {order}", (limit, offset)
        ))
    canonical_name = normalize_share_name(investment_name)
    return list(connection.execute(
        f"SELECT * FROM v_share_history WHERE investment_name = ? {order}",
        (canonical_name, limit, offset),
    ))
