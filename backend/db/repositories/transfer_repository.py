"""Bank-to-cash transfer repository."""
from .record_repository import RecordRepository, SPECS


class TransferRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["transfer"])

    def find_possible_duplicates(
        self,
        *,
        txn_date: str,
        direction: str,
        amount_scaled: int,
        description: str | None,
        excluding_row_id: str | None = None,
    ) -> list[dict[str, object]]:
        from backend.db.core.content_hash import normalize_hash_text

        rows = self.connection.execute(
            "SELECT * FROM transfers WHERE txn_date = ? AND direction = ? AND amount_scaled = ? "
            "ORDER BY sequence_no", (txn_date, direction, amount_scaled)
        )
        normalized_description = normalize_hash_text(description) if description is not None else None
        matches = []
        for row in rows:
            if excluding_row_id and str(row["row_id"]) == excluding_row_id:
                continue
            candidate_description = str(row["description"]) if row["description"] is not None else None
            if candidate_description is not None:
                candidate_description = normalize_hash_text(candidate_description)
            if candidate_description == normalized_description:
                matches.append(dict(row))
        return matches
