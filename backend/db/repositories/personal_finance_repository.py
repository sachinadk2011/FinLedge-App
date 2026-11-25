"""Personal finance entry repository."""

from typing import Mapping

from backend.db.core import normalize_hash_text
from backend.models import PF_EXPENSE_CATEGORIES, PF_INCOME_CATEGORIES, PersonalFinanceCategory

from .record_repository import RecordRepository, SPECS


class PersonalFinanceRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["personal_finance"])

    def _validate_imported_record(self, record: Mapping[str, object]) -> None:
        flow_type = str(record["flow_type"] or "").strip().casefold()
        direction = str(record["direction"] or "").strip().casefold()
        category = str(record["category"] or "").strip()
        amount_scaled = record["amount_scaled"]
        signed_amount_scaled = record["signed_amount_scaled"]
        if flow_type not in {"bank", "cash"}:
            raise ValueError("Imported Personal Finance flow_type must be bank or cash")
        if direction not in {"income", "expense"}:
            raise ValueError("Imported Personal Finance direction must be income or expense")
        if category != record["category"]:
            raise ValueError("Imported Personal Finance category must be trimmed")
        try:
            category_value = PersonalFinanceCategory(category)
        except ValueError as error:
            raise ValueError(f"Unsupported Personal Finance category: {category!r}") from error
        allowed = PF_INCOME_CATEGORIES if direction == "income" else PF_EXPENSE_CATEGORIES
        if category_value not in allowed:
            raise ValueError(f"Imported category {category!r} is not valid for {direction}")
        if isinstance(amount_scaled, bool) or not isinstance(amount_scaled, int) or amount_scaled <= 0:
            raise ValueError("Imported Personal Finance amount_scaled must be a positive integer")
        expected_signed = amount_scaled if direction == "income" else -amount_scaled
        if signed_amount_scaled != expected_signed:
            raise ValueError("Imported Personal Finance signed amount must match its direction")
        if str(record["flow_type"]) != flow_type or str(record["direction"]) != direction:
            raise ValueError("Imported Personal Finance flow_type and direction must be normalized")

    def find_possible_duplicates(
        self,
        *,
        txn_date: str,
        flow_type: str,
        direction: str,
        category: str,
        amount_scaled: int,
        description: str | None,
        excluding_row_id: str | None = None,
    ) -> list[dict[str, object]]:
        """Find exact Personal Finance business-field matches with a different UUID."""
        candidates = self.connection.execute(
            "SELECT * FROM personal_finance_entries "
            "WHERE txn_date = ? AND flow_type = ? AND direction = ? AND category = ? COLLATE NOCASE "
            "AND amount_scaled = ? ORDER BY sequence_no",
            (txn_date, flow_type, direction, category, amount_scaled),
        )
        normalized_description = _normalized_optional_text(description)
        matches = []
        for candidate in candidates:
            if excluding_row_id and str(candidate["row_id"]) == excluding_row_id:
                continue
            if _normalized_optional_text(candidate["description"]) == normalized_description:
                matches.append(dict(candidate))
        return matches


def _normalized_optional_text(value: object | None) -> str | None:
    if value is None:
        return None
    return normalize_hash_text(str(value))
