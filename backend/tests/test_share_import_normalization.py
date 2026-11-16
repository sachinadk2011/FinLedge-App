from __future__ import annotations

import pytest

from backend.services.settings.data.workbook_import import _remap_share_rows
from backend.services.share import HEADERS, normalize_ipo_quantity


@pytest.mark.parametrize("value", [None, "", "   ", 0, 0.0, "0", "0.0"])
def test_blank_and_zero_ipo_quantity_normalize_to_null(value):
    assert normalize_ipo_quantity(value) is None


@pytest.mark.parametrize(("value", "expected"), [(1, 1), ("4", 4), ("4.0", 4), ("1,200", 1200)])
def test_positive_whole_ipo_quantity_is_preserved_as_integer(value, expected):
    assert normalize_ipo_quantity(value) == expected


@pytest.mark.parametrize("value", [-1, "-1", 1.5, "1.5", "invalid", True])
def test_invalid_ipo_quantity_is_rejected(value):
    with pytest.raises(ValueError, match="IPO allotted quantity"):
        normalize_ipo_quantity(value)


def test_share_workbook_import_normalizes_only_ipo_allotments():
    source_headers = ["Date", "Share Name", "Category", "Per Unit Price", "Allotted", "Buy/Sell"]
    source_rows = [
        ["2026-01-01", "Example", "IPO", 100, 0, "cash"],
        ["2026-01-02", "Example", "IPO", 100, None, "cash"],
        ["2026-01-03", "Example", "IPO", 100, 5, "cash"],
        ["2026-01-04", "Example", "Buy", 100, 2, "buy"],
    ]

    imported = _remap_share_rows(source_rows, source_headers, HEADERS, "2026-11-16T00:00:00Z")
    allotted_index = HEADERS.index("Allotted")

    assert [row[allotted_index] for row in imported] == [None, None, 5, 2]
