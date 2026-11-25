"""SIP canonical transaction repository."""
from .record_repository import RecordRepository, SPECS, get_sip_plan_summary, list_sip_transactions, replace_sip_plan_summary


class SipRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["sip"])

    def list_for_plan(self, sip_plan_id: str):
        return list_sip_transactions(self.connection, sip_plan_id)

    def get_plan_summary(self, sip_plan_id: str):
        return get_sip_plan_summary(self.connection, sip_plan_id)

    def replace_plan_summary(self, values):
        replace_sip_plan_summary(self.connection, values)

    def find_possible_duplicates(
        self,
        *,
        txn_date: str,
        investment_name: str,
        transaction_type: str,
        amount_scaled: int,
        charge_scaled: int,
        units: int | None,
        excluding_row_id: str | None = None,
    ) -> list[dict[str, object]]:
        rows = self.connection.execute(
            "SELECT * FROM sip_transactions WHERE txn_date = ? "
            "AND investment_name = ? COLLATE NOCASE AND transaction_type = ? "
            "AND amount_scaled = ? AND charge_scaled = ? AND units IS ? ORDER BY sequence_no",
            (txn_date, investment_name, transaction_type, amount_scaled, charge_scaled, units),
        )
        return [dict(row) for row in rows if not excluding_row_id or str(row["row_id"]) != excluding_row_id]
