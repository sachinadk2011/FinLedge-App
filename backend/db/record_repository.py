"""Allowlisted, connection-scoped repositories for canonical records."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Iterable, Mapping

from .metadata import utc_timestamp_now
from .support_repository import add_tombstone, allocate_sequence


@dataclass(frozen=True)
class RecordSpec:
    table: str
    entity_type: str
    columns: tuple[str, ...]
    mutable_columns: tuple[str, ...]
    sequence_scope: str | None = None


SPECS = {
    "bank": RecordSpec("bank_transactions", "bank", (
        "row_id", "sequence_no", "txn_date", "category", "amount_scaled", "description",
        "created_timestamp", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash",
    ), ("txn_date", "category", "amount_scaled", "description", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash")),
    "personal_finance": RecordSpec("personal_finance_entries", "personal_finance", (
        "row_id", "sequence_no", "txn_date", "flow_type", "direction", "category", "amount_scaled",
        "signed_amount_scaled", "description", "created_timestamp", "last_updated_timestamp", "updated_device",
        "metadata_quality", "content_hash",
    ), ("txn_date", "flow_type", "direction", "category", "amount_scaled", "signed_amount_scaled", "description", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash")),
    "share": RecordSpec("share_transactions", "share", (
        "row_id", "sequence_no", "txn_date", "share_id", "transaction_type", "per_unit_price_scaled", "quantity",
        "charge_scaled", "created_timestamp", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash",
    ), ("txn_date", "share_id", "per_unit_price_scaled", "quantity", "charge_scaled", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash"), "share"),
    "sip": RecordSpec("sip_transactions", "sip", (
        "row_id", "sequence_no", "txn_date", "investment_name", "sip_plan_id", "transaction_type", "amount_scaled",
        "charge_scaled", "units", "created_timestamp", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash",
    ), ("txn_date", "investment_name", "amount_scaled", "charge_scaled", "units", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash"), "sip"),
    "dividend": RecordSpec("dividend_events", "dividend", (
        "row_id", "sequence_no", "txn_date", "share_id", "event_type", "cash_amount_scaled", "quantity",
        "created_timestamp", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash",
    ), ("txn_date", "share_id", "cash_amount_scaled", "quantity", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash"), "share"),
    "transfer": RecordSpec("transfers", "transfer", (
        "row_id", "sequence_no", "txn_date", "direction", "amount_scaled", "description", "transfer_ref",
        "created_timestamp", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash",
    ), ("txn_date", "direction", "amount_scaled", "description", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash")),
}


class RecordRepository:
    """CRUD over one fixed schema table; writes require caller-owned transaction."""

    def __init__(self, connection: sqlite3.Connection, spec: RecordSpec):
        self.connection = connection
        self.spec = spec

    def get(self, row_id: str) -> sqlite3.Row | None:
        return self.connection.execute(
            f"SELECT * FROM {self.spec.table} WHERE row_id = ?", (row_id,)
        ).fetchone()

    def list(self, *, limit: int = 500, offset: int = 0) -> list[sqlite3.Row]:
        if not 1 <= limit <= 5000 or offset < 0:
            raise ValueError("limit must be 1..5000 and offset must be nonnegative")
        return list(self.connection.execute(
            f"SELECT * FROM {self.spec.table} ORDER BY sequence_no LIMIT ? OFFSET ?", (limit, offset)
        ))

    def create(self, values: Mapping[str, object]) -> None:
        self._require_transaction()
        record = dict(values)
        if self.spec.sequence_scope:
            allocated = allocate_sequence(self.connection, self.spec.sequence_scope)
            supplied = record.setdefault("sequence_no", allocated)
            if supplied != allocated:
                raise ValueError("sequence_no is allocated by the repository")
        else:
            record.setdefault("sequence_no", self._next_sequence())
        self._validate_columns(record, allow_immutable=True)
        columns = tuple(record)
        placeholders = ", ".join("?" for _ in columns)
        names = ", ".join(columns)
        self.connection.execute(
            f"INSERT INTO {self.spec.table} ({names}) VALUES ({placeholders})",
            tuple(record[name] for name in columns),
        )

    def update(self, row_id: str, values: Mapping[str, object]) -> bool:
        self._require_transaction()
        record = dict(values)
        forbidden = set(record) - set(self.spec.mutable_columns)
        if forbidden:
            raise ValueError(f"immutable or unknown update columns: {', '.join(sorted(forbidden))}")
        if not record:
            return self.get(row_id) is not None
        names = tuple(record)
        assignments = ", ".join(f"{name} = ?" for name in names)
        cursor = self.connection.execute(
            f"UPDATE {self.spec.table} SET {assignments} WHERE row_id = ?",
            tuple(record[name] for name in names) + (row_id,),
        )
        return cursor.rowcount == 1

    def delete(self, row_id: str, *, deleted_by_device: str, note: str | None = None) -> sqlite3.Row | None:
        """Tombstone and physically delete atomically; caller commits the transaction."""
        self._require_transaction()
        existing = self.get(row_id)
        if existing is None:
            return None
        add_tombstone(
            self.connection,
            row_id=row_id,
            entity_type=self.spec.entity_type,
            sequence_no=int(existing["sequence_no"]),
            deleted_by_device=deleted_by_device,
            note=note,
        )
        self.connection.execute(f"DELETE FROM {self.spec.table} WHERE row_id = ?", (row_id,))
        return existing

    def _next_sequence(self) -> int:
        row = self.connection.execute(f"SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM {self.spec.table}").fetchone()
        return int(row[0])

    def _validate_columns(self, values: Mapping[str, object], *, allow_immutable: bool) -> None:
        allowed = set(self.spec.columns if allow_immutable else self.spec.mutable_columns)
        invalid = set(values) - allowed
        if invalid:
            raise ValueError(f"unknown columns: {', '.join(sorted(invalid))}")

    def _require_transaction(self) -> None:
        if not self.connection.in_transaction:
            raise RuntimeError("Repository writes require an active caller-owned transaction")


def _summary(connection: sqlite3.Connection, table: str, key_column: str, key: str) -> sqlite3.Row | None:
    return connection.execute(f"SELECT * FROM {table} WHERE {key_column} = ?", (key,)).fetchone()


def _replace_summary(connection: sqlite3.Connection, table: str, key_column: str, values: Mapping[str, object]) -> None:
    if not connection.in_transaction:
        raise RuntimeError("Summary writes require an active caller-owned transaction")
    record = dict(values)
    if key_column not in record:
        raise ValueError(f"summary requires {key_column}")
    # Summary tables are fixed and deliberately writable only through this full-row replace API.
    allowed = {
        "share_holdings": {"share_id", "quantity", "total_cost_scaled", "average_cost_scaled", "realized_profit_loss_scaled", "cash_dividends_scaled", "bonus_units", "last_event_sequence_no", "calculation_version", "summary_updated_timestamp", "summary_updated_device"},
        "sip_plan_summaries": {"sip_plan_id", "sip_name", "start_date", "outstanding_principal_scaled", "updated_units_total", "pending_installment_count", "total_redeemed_scaled", "realized_profit_loss_scaled", "plan_status", "last_event_sequence_no", "calculation_version", "summary_updated_timestamp", "summary_updated_device"},
    }[table]
    invalid = set(record) - allowed
    if invalid or set(record) != allowed:
        raise ValueError("summary rebuild must provide exactly its complete column set")
    columns = tuple(record)
    names = ", ".join(columns)
    marks = ", ".join("?" for _ in columns)
    updates = ", ".join(f"{column}=excluded.{column}" for column in columns if column != key_column)
    connection.execute(
        f"INSERT INTO {table} ({names}) VALUES ({marks}) ON CONFLICT({key_column}) DO UPDATE SET {updates}",
        tuple(record[column] for column in columns),
    )


def replace_share_holding(connection: sqlite3.Connection, values: Mapping[str, object]) -> None:
    _replace_summary(connection, "share_holdings", "share_id", values)


def replace_sip_plan_summary(connection: sqlite3.Connection, values: Mapping[str, object]) -> None:
    _replace_summary(connection, "sip_plan_summaries", "sip_plan_id", values)


def list_share_holdings(connection: sqlite3.Connection) -> list[sqlite3.Row]:
    return list(connection.execute("SELECT h.*, s.name FROM share_holdings h JOIN shares s USING(share_id) ORDER BY s.name"))


def get_sip_plan_summary(connection: sqlite3.Connection, sip_plan_id: str) -> sqlite3.Row | None:
    return _summary(connection, "sip_plan_summaries", "sip_plan_id", sip_plan_id)


def ensure_share(connection: sqlite3.Connection, *, share_id: str, name: str, created_timestamp: str | None = None) -> sqlite3.Row:
    if not connection.in_transaction:
        raise RuntimeError("Share identity writes require an active caller-owned transaction")
    canonical = " ".join(name.split()).upper()
    if not canonical:
        raise ValueError("share name cannot be blank")
    connection.execute(
        "INSERT INTO shares(share_id, name, created_timestamp) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING",
        (share_id, canonical, created_timestamp or utc_timestamp_now()),
    )
    return connection.execute("SELECT * FROM shares WHERE name = ?", (canonical,)).fetchone()


def list_share_transactions(connection: sqlite3.Connection, share_id: str) -> list[sqlite3.Row]:
    return list(connection.execute(
        "SELECT * FROM share_transactions WHERE share_id = ? ORDER BY txn_date, sequence_no", (share_id,)
    ))


def list_dividend_events(connection: sqlite3.Connection, share_id: str) -> list[sqlite3.Row]:
    return list(connection.execute(
        "SELECT * FROM dividend_events WHERE share_id = ? ORDER BY txn_date, sequence_no", (share_id,)
    ))


def list_sip_transactions(connection: sqlite3.Connection, sip_plan_id: str) -> list[sqlite3.Row]:
    return list(connection.execute(
        "SELECT * FROM sip_transactions WHERE sip_plan_id = ? ORDER BY txn_date, sequence_no", (sip_plan_id,)
    ))
