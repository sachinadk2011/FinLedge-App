"""Read and rebuild APIs for derived holdings summaries."""
from .record_repository import list_share_holdings, replace_share_holding


def list_holdings(connection):
    return list_share_holdings(connection)


def replace_rebuilt_holding(connection, values):
    replace_share_holding(connection, values)
