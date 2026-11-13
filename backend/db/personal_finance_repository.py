"""Personal finance entry repository."""
from .record_repository import RecordRepository, SPECS


class PersonalFinanceRepository(RecordRepository):
    def __init__(self, connection):
        super().__init__(connection, SPECS["personal_finance"])
