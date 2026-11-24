"""Bank transaction repository."""
from decimal import Decimal
from typing import Mapping
from uuid import UUID

from backend.db.core import normalize_hash_text
from ...models import BankCategory
from .record_repository import RecordRepository, SPECS


class BankRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["bank"])

    def create(self, values: Mapping[str, object], *, device: str, timestamp: str | None = None) -> str:
        self._require_transaction()
        record = dict(values)
        self._validate_category_sign(record)
        return super().create(record, device=device, timestamp=timestamp)

    def update(self, row_id: str, values: Mapping[str, object], *, device: str, timestamp: str | None = None) -> bool:
        self._require_transaction()
        existing = self.get(row_id)
        if existing is None:
            return False
        candidate = dict(existing)
        candidate.update(values)
        self._validate_category_sign(candidate)
        return super().update(row_id, values, device=device, timestamp=timestamp)

    def import_existing(self, values: Mapping[str, object]) -> bool:
        """Insert one reviewed historical row, preserving its identity and ordering."""
        self._require_transaction()
        record = dict(values)
        required = set(self.spec.columns)
        if set(record) != required:
            missing = required - set(record)
            extra = set(record) - required
            raise ValueError(f"Imported Bank row fields mismatch (missing={sorted(missing)}, extra={sorted(extra)})")

        try:
            row_id = str(UUID(str(record["row_id"])))
        except (TypeError, ValueError, AttributeError) as error:
            raise ValueError("Imported Bank row_id must be a valid UUID") from error
        if str(record["row_id"]) != row_id:
            raise ValueError("Imported Bank row_id must be lowercase canonical text")
        record["row_id"] = row_id
        sequence_no = record["sequence_no"]
        if isinstance(sequence_no, bool) or not isinstance(sequence_no, int) or sequence_no <= 0:
            raise ValueError("Imported Bank sequence_no must be a positive integer")
        amount_scaled = record["amount_scaled"]
        if isinstance(amount_scaled, bool) or not isinstance(amount_scaled, int):
            raise TypeError("Imported Bank amount_scaled must be an integer")
        category = str(record["category"] or "").strip()
        if category.casefold() == "income":
            if amount_scaled <= 0:
                raise ValueError("Legacy Income rows must have a positive amount")
        else:
            self._validate_category_sign({"category": category, "amount_scaled": amount_scaled})
        if str(record["metadata_quality"]) not in {
            "exact", "legacy_offset", "legacy_naive", "legacy_date_only", "backfilled", "imported_missing"
        }:
            raise ValueError("Imported Bank metadata_quality is unsupported")
        if str(record["updated_device"]) not in {
            "desktop-exe", "desktop-appx", "desktop-dev", "desktop-test", "mobile", "legacy"
        }:
            raise ValueError("Imported Bank updated_device is unsupported")

        record["category"] = category
        computed_hash = self._content_hash(record)
        if str(record["content_hash"]) != computed_hash:
            raise ValueError("Imported Bank canonical content_hash does not match the authoritative fields")

        existing = self.get(row_id)
        if existing is not None:
            if all(existing[column] == record[column] for column in self.spec.columns):
                return False
            raise ValueError(f"Bank row {row_id} already exists with different imported values")
        sequence_owner = self.connection.execute(
            "SELECT row_id FROM bank_transactions WHERE sequence_no = ?", (sequence_no,)
        ).fetchone()
        if sequence_owner is not None:
            raise ValueError(f"Bank sequence_no {sequence_no} is already assigned to another row")
        self._ensure_global_row_id_unique(row_id)

        columns = self.spec.columns
        names = ", ".join(columns)
        placeholders = ", ".join("?" for _ in columns)
        self.connection.execute(
            f"INSERT INTO bank_transactions ({names}) VALUES ({placeholders})",
            tuple(record[column] for column in columns),
        )
        return True

    def find_possible_duplicates(
        self,
        *,
        txn_date: str,
        category: str,
        amount_scaled: int,
        description: str | None,
        excluding_row_id: str | None = None,
    ) -> list[dict[str, object]]:
        """Find exact business-field matches whose UUID differs from the staged row."""
        candidates = self.connection.execute(
            "SELECT * FROM bank_transactions "
            "WHERE txn_date = ? AND amount_scaled = ? AND category = ? COLLATE NOCASE "
            "ORDER BY sequence_no",
            (txn_date, amount_scaled, category),
        )
        normalized_description = _normalized_optional_text(description)
        matches = []
        for candidate in candidates:
            if excluding_row_id and str(candidate["row_id"]) == excluding_row_id:
                continue
            if _normalized_optional_text(candidate["description"]) == normalized_description:
                matches.append(dict(candidate))
        return matches

    def list_with_cumulative(self):
        """Return canonical rows with cumulative balance derived by sequence order."""
        return list(self.connection.execute(
            """
            SELECT bank_transactions.*,
                   SUM(amount_scaled) OVER (
                       ORDER BY sequence_no ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                   ) AS cumulative_amount_scaled
            FROM bank_transactions
            ORDER BY sequence_no
            """
        ))

    def summarize(self) -> dict:
        """Summarize the canonical signed ledger without binary floating-point math."""
        records = self.connection.execute(
            "SELECT category, amount_scaled FROM bank_transactions ORDER BY sequence_no"
        )
        income_scaled = 0
        expenses_scaled = 0
        category_totals_scaled: dict[str, int] = {category.value: 0 for category in BankCategory}
        for row in records:
            category = str(row["category"] or "").strip()
            amount_scaled = int(row["amount_scaled"])
            if category.casefold() in {"interest earned", "income"}:
                income_scaled += amount_scaled
                category_totals_scaled[category] = category_totals_scaled.get(category, 0) + amount_scaled
            else:
                expense = abs(amount_scaled)
                expenses_scaled += expense
                if category:
                    category_totals_scaled[category] = category_totals_scaled.get(category, 0) + expense

        def currency(value: int) -> Decimal:
            return Decimal(value) / Decimal(10_000)

        return {
            "total_income": currency(income_scaled),
            "total_expenses": currency(expenses_scaled),
            "net_balance": currency(income_scaled - expenses_scaled),
            "category_totals": {
                category: currency(value) for category, value in category_totals_scaled.items()
            },
        }

    @staticmethod
    def _validate_category_sign(values: Mapping[str, object]) -> None:
        category = str(values.get("category") or "").strip()
        known_categories = {item.value for item in BankCategory}
        if category not in known_categories:
            raise ValueError(f"Unsupported Bank Services category: {category or '(blank)'}")
        amount = values.get("amount_scaled")
        if isinstance(amount, bool) or not isinstance(amount, int):
            raise TypeError("amount_scaled must be an integer in canonical scaled units")
        if category == BankCategory.interest_earned.value and amount <= 0:
            raise ValueError("Interest Earned must have a positive amount")
        if category != BankCategory.interest_earned.value and amount >= 0:
            raise ValueError("Bank Services charge categories must have a negative amount")


def _normalized_optional_text(value: object | None) -> str | None:
    if value is None:
        return None
    return normalize_hash_text(str(value))
