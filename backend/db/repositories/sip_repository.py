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
