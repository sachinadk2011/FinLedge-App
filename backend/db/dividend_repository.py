"""Cash dividend and bonus event repository."""
from .record_repository import RecordRepository, SPECS, list_dividend_events


class DividendRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["dividend"])

    def list_for_share(self, share_id: str):
        return list_dividend_events(self.connection, share_id)
