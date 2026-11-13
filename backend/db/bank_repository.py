"""Bank transaction repository."""
from .record_repository import RecordRepository, SPECS


class BankRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["bank"])
