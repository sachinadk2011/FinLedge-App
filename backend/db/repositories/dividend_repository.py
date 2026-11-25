"""Cash dividend and bonus event repository."""
from .record_repository import RecordRepository, SPECS, list_dividend_events


class DividendRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["dividend"])

    def list_for_share(self, share_id: str):
        return list_dividend_events(self.connection, share_id)

    def find_possible_duplicates(
        self,
        *,
        txn_date: str,
        share_name: str,
        event_type: str,
        cash_amount_scaled: int | None,
        quantity: int | None,
        excluding_row_id: str | None = None,
    ) -> list[dict[str, object]]:
        rows = self.connection.execute(
            "SELECT d.*, s.name AS share_name FROM dividend_events d "
            "JOIN shares s USING (share_id) WHERE d.txn_date = ? AND s.name = ? COLLATE NOCASE "
            "AND d.event_type = ? AND d.cash_amount_scaled IS ? AND d.quantity IS ? ORDER BY d.sequence_no",
            (txn_date, share_name, event_type, cash_amount_scaled, quantity),
        )
        return [dict(row) for row in rows if not excluding_row_id or str(row["row_id"]) != excluding_row_id]
