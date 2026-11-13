"""Short SQLite transactions with bounded lock retries."""

from __future__ import annotations

import random
import sqlite3
import time
from contextlib import contextmanager
from typing import Iterator


BUSY_RETRIES = 3
BASE_RETRY_DELAY_SECONDS = 0.05


def _is_busy(error: sqlite3.OperationalError) -> bool:
    code = getattr(error, "sqlite_errorcode", None)
    if code is not None:
        primary_code = code & 0xFF
        if primary_code in {sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED}:
            return True
    message = str(error).casefold()
    return "database is locked" in message or "database is busy" in message


def _retry_delay(attempt: int) -> float:
    exponential = BASE_RETRY_DELAY_SECONDS * (2**attempt)
    return exponential + random.uniform(0, BASE_RETRY_DELAY_SECONDS)


def _begin(connection: sqlite3.Connection, *, immediate: bool) -> None:
    statement = "BEGIN IMMEDIATE" if immediate else "BEGIN"
    for attempt in range(BUSY_RETRIES + 1):
        try:
            connection.execute(statement)
            return
        except sqlite3.OperationalError as error:
            if not _is_busy(error) or attempt == BUSY_RETRIES:
                raise
            time.sleep(_retry_delay(attempt))


def _commit(connection: sqlite3.Connection) -> None:
    for attempt in range(BUSY_RETRIES + 1):
        try:
            connection.commit()
            return
        except sqlite3.OperationalError as error:
            if not _is_busy(error) or attempt == BUSY_RETRIES:
                raise
            time.sleep(_retry_delay(attempt))


@contextmanager
def transaction(
    connection: sqlite3.Connection,
    *,
    immediate: bool = True,
) -> Iterator[sqlite3.Connection]:
    """Commit all work on success; roll back all work when the body fails."""
    if connection.in_transaction:
        raise RuntimeError("Nested transactions are not supported; pass the active connection")
    _begin(connection, immediate=immediate)
    try:
        yield connection
        _commit(connection)
    except BaseException:
        if connection.in_transaction:
            connection.rollback()
        raise

