"""Allowlisted, connection-scoped repositories for canonical records."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Mapping
from uuid import UUID, uuid4

from ..core.content_hash import content_hash, normalize_hash_text
from ..core.metadata import stamp_create, stamp_material_edit, utc_timestamp_now
from ..share.identity import normalize_share_name
from .support_repository import DEVICE_LABELS, add_tombstone, allocate_sequence


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


def find_other_entity_owner(connection: sqlite3.Connection, row_id: str, entity_type: str) -> str | None:
    """Return the owning entity when a UUID is already used outside this entity."""
    for spec in SPECS.values():
        if spec.entity_type == entity_type:
            continue
        if connection.execute(
            f"SELECT 1 FROM {spec.table} WHERE row_id = ? LIMIT 1", (row_id,)
        ).fetchone() is not None:
            return spec.entity_type
    return None


class RecordRepository:
    """CRUD over one fixed schema table; writes require caller-owned transaction."""

    def __init__(self, connection: sqlite3.Connection, spec: RecordSpec):
        self.connection = connection
        self.spec = spec

    def get(self, row_id: str) -> sqlite3.Row | None:
        normalized_row_id = _canonical_uuid(row_id, "row_id")
        return self.connection.execute(
            f"SELECT * FROM {self.spec.table} WHERE row_id = ?", (normalized_row_id,)
        ).fetchone()

    def list(self, *, limit: int = 500, offset: int = 0) -> list[sqlite3.Row]:
        if not 1 <= limit <= 5000 or offset < 0:
            raise ValueError("limit must be 1..5000 and offset must be nonnegative")
        return list(self.connection.execute(
            f"SELECT * FROM {self.spec.table} ORDER BY sequence_no LIMIT ? OFFSET ?", (limit, offset)
        ))

    def create(
        self,
        values: Mapping[str, object],
        *,
        device: str,
        timestamp: str | None = None,
    ) -> str:
        self._require_transaction()
        record = dict(values)
        allowed = set(self.spec.columns) - {
            "sequence_no", "created_timestamp", "last_updated_timestamp", "updated_device",
            "metadata_quality", "content_hash", "signed_amount_scaled",
        }
        self._validate_allowed(record, allowed, operation="create")
        defaults = {
            "bank": {"description": None},
            "personal_finance": {"description": None},
            "share": {"quantity": None, "charge_scaled": 0},
            "sip": {"charge_scaled": 0, "units": None},
            "dividend": {"cash_amount_scaled": None, "quantity": None},
            "transfer": {"description": None},
        }[self.spec.entity_type]
        for name, value in defaults.items():
            record.setdefault(name, value)
        record["row_id"] = _canonical_uuid(record.get("row_id") or str(uuid4()), "row_id")
        self._validate_financial_types(record)
        self._ensure_global_row_id_unique(str(record["row_id"]))
        if self.spec.entity_type == "sip":
            record["sip_plan_id"] = _canonical_uuid(record.get("sip_plan_id"), "sip_plan_id")
            record["investment_name"] = " ".join(str(record.get("investment_name") or "").split()).upper()
            if not record["investment_name"]:
                raise ValueError("investment_name cannot be blank")
        if self.spec.sequence_scope:
            allocated = allocate_sequence(self.connection, self.spec.sequence_scope)
            record["sequence_no"] = allocated
        else:
            record["sequence_no"] = self._next_sequence()
        if self.spec.entity_type == "personal_finance":
            direction = str(record.get("direction", "")).strip().casefold()
            amount = record.get("amount_scaled")
            if direction not in {"income", "expense"} or isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
                raise ValueError("Personal Finance requires a positive amount and income/expense direction")
            record["signed_amount_scaled"] = amount if direction == "income" else -amount
        record["metadata_quality"] = "exact"
        record.update(stamp_create(device, timestamp=timestamp))
        record["content_hash"] = self._content_hash(record)
        columns = tuple(record)
        placeholders = ", ".join("?" for _ in columns)
        names = ", ".join(columns)
        self.connection.execute(
            f"INSERT INTO {self.spec.table} ({names}) VALUES ({placeholders})",
            tuple(record[name] for name in columns),
        )
        return str(record["row_id"])

    def update(
        self,
        row_id: str,
        values: Mapping[str, object],
        *,
        device: str,
        timestamp: str | None = None,
    ) -> bool:
        self._require_transaction()
        normalized_row_id = _canonical_uuid(row_id, "row_id")
        existing = self.get(normalized_row_id)
        if existing is None:
            return False
        record = dict(values)
        self._validate_allowed(record, set(self.spec.mutable_columns) - {
            "signed_amount_scaled", "last_updated_timestamp", "updated_device", "metadata_quality", "content_hash",
        }, operation="update")
        if not record:
            return True
        candidate = dict(existing)
        candidate.update(record)
        self._validate_financial_types(record)
        if self.spec.entity_type == "sip" and "sip_plan_id" in candidate:
            candidate["sip_plan_id"] = _canonical_uuid(candidate["sip_plan_id"], "sip_plan_id")
        if self.spec.entity_type == "sip" and "investment_name" in candidate:
            candidate["investment_name"] = " ".join(str(candidate["investment_name"] or "").split()).upper()
            if not candidate["investment_name"]:
                raise ValueError("investment_name cannot be blank")
        if self.spec.entity_type == "personal_finance":
            direction = str(candidate.get("direction", "")).strip().casefold()
            amount = candidate.get("amount_scaled")
            if direction not in {"income", "expense"} or isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
                raise ValueError("Personal Finance requires a positive amount and income/expense direction")
            candidate["signed_amount_scaled"] = amount if direction == "income" else -amount
        next_hash = self._content_hash(candidate)
        existing_business_hash = self._content_hash(dict(existing))
        if next_hash == existing_business_hash:
            if next_hash != str(existing["content_hash"]):
                self.connection.execute(
                    f"UPDATE {self.spec.table} SET content_hash = ? WHERE row_id = ?",
                    (next_hash, normalized_row_id),
                )
            return True
        if self.spec.entity_type == "personal_finance":
            record["signed_amount_scaled"] = candidate["signed_amount_scaled"]
        record["content_hash"] = next_hash
        stamps = stamp_material_edit(
            dict(existing), device, changed=True, timestamp=timestamp
        )
        record.update({
            "last_updated_timestamp": stamps["last_updated_timestamp"],
            "updated_device": stamps["updated_device"],
        })
        names = tuple(record)
        assignments = ", ".join(f"{name} = ?" for name in names)
        cursor = self.connection.execute(
            f"UPDATE {self.spec.table} SET {assignments} WHERE row_id = ?",
            tuple(record[name] for name in names) + (normalized_row_id,),
        )
        return cursor.rowcount == 1

    def delete(self, row_id: str, *, deleted_by_device: str, note: str | None = None) -> sqlite3.Row | None:
        """Tombstone and physically delete atomically; caller commits the transaction."""
        self._require_transaction()
        row_id = _canonical_uuid(row_id, "row_id")
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

    def import_existing(self, values: Mapping[str, object]) -> bool:
        """Insert a fully reviewed historical row, preserving its canonical fields."""
        self._require_transaction()
        record = dict(values)
        required = set(self.spec.columns)
        if set(record) != required:
            missing = required - set(record)
            extra = set(record) - required
            raise ValueError(f"Imported {self.spec.entity_type} row fields mismatch (missing={sorted(missing)}, extra={sorted(extra)})")

        normalized_row_id = _canonical_uuid(record["row_id"], "row_id")
        if str(record["row_id"]) != normalized_row_id:
            raise ValueError("Imported row_id must be lowercase canonical text")
        record["row_id"] = normalized_row_id
        sequence_no = record["sequence_no"]
        if isinstance(sequence_no, bool) or not isinstance(sequence_no, int) or sequence_no <= 0:
            raise ValueError("Imported sequence_no must be a positive integer")
        self._validate_financial_types(record)

        if str(record["metadata_quality"]) not in {
            "exact", "legacy_offset", "legacy_naive", "legacy_date_only", "backfilled", "imported_missing"
        }:
            raise ValueError("Imported metadata_quality is unsupported")
        if str(record["updated_device"]) not in DEVICE_LABELS:
            raise ValueError("Imported updated_device is unsupported")
        for timestamp_name in ("created_timestamp", "last_updated_timestamp"):
            if not str(record[timestamp_name] or "").strip():
                raise ValueError(f"Imported {timestamp_name} cannot be blank")

        self._validate_imported_record(record)
        computed_hash = self._content_hash(record)
        if str(record["content_hash"]) != computed_hash:
            raise ValueError(f"Imported {self.spec.entity_type} canonical content_hash does not match the authoritative fields")

        existing = self.get(normalized_row_id)
        if existing is not None:
            if all(existing[column] == record[column] for column in self.spec.columns):
                return False
            raise ValueError(f"{self.spec.entity_type} row {normalized_row_id} already exists with different imported values")
        sequence_owner = self.connection.execute(
            f"SELECT row_id FROM {self.spec.table} WHERE sequence_no = ?", (sequence_no,)
        ).fetchone()
        if sequence_owner is not None:
            raise ValueError(f"{self.spec.entity_type} sequence_no {sequence_no} is already assigned to another row")
        self._ensure_global_row_id_unique(normalized_row_id)

        columns = self.spec.columns
        names = ", ".join(columns)
        placeholders = ", ".join("?" for _ in columns)
        self.connection.execute(
            f"INSERT INTO {self.spec.table} ({names}) VALUES ({placeholders})",
            tuple(record[column] for column in columns),
        )
        return True

    def _validate_imported_record(self, record: Mapping[str, object]) -> None:
        """Subclass hook for module-specific import invariants."""

    def _next_sequence(self) -> int:
        row = self.connection.execute(f"SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM {self.spec.table}").fetchone()
        return int(row[0])

    def next_sequence_no(self) -> int:
        """Return the next sequence value; call inside a write transaction before import."""
        self._require_transaction()
        return self._next_sequence()

    def _validate_allowed(self, values: Mapping[str, object], allowed: set[str], *, operation: str) -> None:
        invalid = set(values) - allowed
        if invalid:
            raise ValueError(f"immutable or unknown {operation} fields: {', '.join(sorted(invalid))}")

    def _content_hash(self, record: Mapping[str, object]) -> str:
        entity = self.spec.entity_type
        if entity == "bank":
            fields = ("txn_date", "category", "amount_scaled", "description")
            casefold_fields = {"category"}
            payload = _hash_payload(record, fields, casefold_fields=casefold_fields)
        elif entity == "personal_finance":
            fields = ("txn_date", "flow_type", "direction", "category", "amount_scaled", "description", "source", "source_ref")
            casefold_fields = {"flow_type", "direction", "category", "source"}
            payload = _hash_payload(
                {**record, "source": "manual", "source_ref": None},
                fields,
                casefold_fields=casefold_fields,
            )
        elif entity == "share":
            name = self._share_name(str(record["share_id"]))
            fields = ("txn_date", "share_name", "transaction_type", "per_unit_price_scaled", "charge_scaled", "quantity")
            payload = _hash_payload({**record, "share_name": name}, fields, casefold_fields={"transaction_type"})
        elif entity == "sip":
            fields = ("txn_date", "investment_name", "sip_plan_id", "transaction_type", "amount_scaled", "charge_scaled", "units")
            payload = _hash_payload(record, fields, casefold_fields={"transaction_type"})
        elif entity == "dividend":
            name = self._share_name(str(record["share_id"]))
            fields = ("txn_date", "share_name", "event_type", "cash_amount_scaled", "quantity")
            payload = _hash_payload({**record, "share_name": name}, fields, casefold_fields={"event_type"})
        else:
            fields = ("txn_date", "direction", "amount_scaled", "description", "source_ref")
            payload = _hash_payload(
                {**record, "source_ref": record.get("transfer_ref")},
                fields,
                casefold_fields={"direction"},
            )
        return content_hash(payload, tuple(payload))

    def canonical_content_hash(self, record: Mapping[str, object]) -> str:
        """Return the entity's canonical hash for an existing or staged row mapping."""
        return self._content_hash(record)

    def _ensure_global_row_id_unique(self, row_id: str) -> None:
        for spec in SPECS.values():
            if spec.table == self.spec.table:
                continue
            if self.connection.execute(
                f"SELECT 1 FROM {spec.table} WHERE row_id = ? LIMIT 1", (row_id,)
            ).fetchone() is not None:
                raise ValueError(f"row_id already belongs to another entity: {row_id}")

    def _validate_financial_types(self, values: Mapping[str, object]) -> None:
        for column, value in values.items():
            if column.endswith("_scaled") or column in {"quantity", "units"}:
                if value is None:
                    continue
                if isinstance(value, bool) or not isinstance(value, int):
                    raise TypeError(f"{column} must be an integer in canonical scaled units")

    def _share_name(self, share_id: str) -> str:
        row = self.connection.execute("SELECT name FROM shares WHERE share_id = ?", (share_id,)).fetchone()
        if row is None:
            raise ValueError(f"Unknown share_id: {share_id}")
        return str(row["name"])

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
    canonical = normalize_share_name(name)
    share_id = _canonical_uuid(share_id, "share_id")
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


def _canonical_uuid(value: object, field: str) -> str:
    try:
        return str(UUID(str(value).strip().strip("{}")))
    except (TypeError, ValueError, AttributeError) as error:
        raise ValueError(f"{field} must be a valid UUID") from error


def _hash_payload(
    record: Mapping[str, object],
    fields: tuple[str, ...],
    *,
    casefold_fields: set[str] | None = None,
) -> dict[str, object]:
    casefold_fields = casefold_fields or set()
    payload: dict[str, object] = {}
    for field in fields:
        if field not in record:
            raise ValueError(f"Cannot hash a record missing authoritative field {field!r}")
        value = record[field]
        if isinstance(value, str):
            value = normalize_hash_text(value, casefold=field in casefold_fields)
        payload[field] = value
    return payload
