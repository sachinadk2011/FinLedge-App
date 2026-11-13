"""Share master identity and canonical share transaction repository."""
from .record_repository import RecordRepository, SPECS, ensure_share, list_share_transactions


class ShareRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["share"])

    def ensure_share(self, *, share_id: str, name: str, created_timestamp: str | None = None):
        return ensure_share(self.connection, share_id=share_id, name=name, created_timestamp=created_timestamp)

    def list_for_share(self, share_id: str):
        return list_share_transactions(self.connection, share_id)
