"""Share master identity and canonical share transaction repository."""
from .record_repository import RecordRepository, SPECS, ensure_share, list_share_transactions


class ShareRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["share"])

    def ensure_share(self, *, share_id: str, name: str, created_timestamp: str | None = None):
        return ensure_share(self.connection, share_id=share_id, name=name, created_timestamp=created_timestamp)

    def list_for_share(self, share_id: str):
        return list_share_transactions(self.connection, share_id)

    def find_possible_duplicates(
        self,
        *,
        txn_date: str,
        share_name: str,
        transaction_type: str,
        per_unit_price_scaled: int,
        quantity: int | None,
        charge_scaled: int,
        excluding_row_id: str | None = None,
    ) -> list[dict[str, object]]:
        rows = self.connection.execute(
            "SELECT t.*, s.name AS share_name FROM share_transactions t "
            "JOIN shares s USING (share_id) WHERE t.txn_date = ? AND s.name = ? COLLATE NOCASE "
            "AND t.transaction_type = ? AND t.per_unit_price_scaled = ? "
            "AND t.quantity IS ? AND t.charge_scaled = ? ORDER BY t.sequence_no",
            (txn_date, share_name, transaction_type, per_unit_price_scaled, quantity, charge_scaled),
        )
        return [dict(row) for row in rows if not excluding_row_id or str(row["row_id"]) != excluding_row_id]
