"""Read-only selectors for SIP installments that need their first unit entry."""

from __future__ import annotations

import sqlite3


def list_pending_unit_suggestions(connection: sqlite3.Connection) -> list[sqlite3.Row]:
    """Return only pending first installments, in stable plan/date order.

    Redemption rows never qualify because the query is restricted to
    ``sip_installment`` events. Later installments are intentionally excluded:
    the approved review rule presents one initial unit-entry suggestion per plan.
    """
    return list(connection.execute(
        """
        SELECT installment.*
        FROM sip_transactions AS installment
        WHERE installment.transaction_type = 'sip_installment'
          AND installment.units IS NULL
          AND installment.sequence_no = (
              SELECT MIN(first_installment.sequence_no)
              FROM sip_transactions AS first_installment
              WHERE first_installment.sip_plan_id = installment.sip_plan_id
                AND first_installment.transaction_type = 'sip_installment'
          )
        ORDER BY installment.txn_date, installment.sequence_no, installment.row_id
        """
    ))
