"""Bank-to-cash transfer repository."""
from .record_repository import RecordRepository, SPECS


class TransferRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["transfer"])
