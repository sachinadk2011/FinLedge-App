"""Bank transaction repository."""
from decimal import Decimal
from typing import Mapping

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
