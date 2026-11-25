"""Stable public API for shared Desktop services."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "consume_recovery_warnings": (".excel_utils", "consume_recovery_warnings"),
    "snapshot_before_write": (".excel_utils", "snapshot_before_write"),
    "snapshot_before_operation": (".sqlite_snapshots", "snapshot_before_operation"),
    "replace_records_for_reviewed_import": (".sqlite_snapshots", "replace_records_for_reviewed_import"),
    "mirror_data_directory_to_safety_copy": (".excel_utils", "mirror_data_directory_to_safety_copy"),
    "safe_load_workbook": (".excel_utils", "safe_load_workbook"),
    "find_most_recent_valid_backup": (".excel_utils", "find_most_recent_valid_backup"),
    "ensure_workbook_exists": (".excel_utils", "ensure_workbook_exists"),
    "workbook_for_update": (".excel_utils", "workbook_for_update"),
    "commit_workbook_write": (".excel_utils", "commit_workbook_write"),
    "iter_sheet_rows_as_dicts": (".excel_utils", "iter_sheet_rows_as_dicts"),
    "to_float": (".excel_utils", "to_float"),
    "to_int": (".excel_utils", "to_int"),
    "current_timestamp": (".excel_utils", "current_timestamp"),
    "current_timestamp_us": (".excel_utils", "current_timestamp_us"),
    "api_response": (".excel_utils", "api_response"),
    "get_data_dir": (".path_utils", "get_data_dir"),
    "migrate_legacy_workbooks": (".data_directory_service", "migrate_legacy_workbooks"),
    "cleanup_migrated_root_sources": (".data_directory_service", "cleanup_migrated_root_sources"),
    "backup_root_workbooks_before_data_folder": (".data_directory_service", "backup_root_workbooks_before_data_folder"),
    "run_pending_data_migrations": (".data_migration_service", "run_pending_data_migrations"),
    "record_migration_state": (".data_migration_service", "record_migration_state"),
    "migrate_share_workbook": (".data_migration_service", "migrate_share_workbook"),
    "migrate_bank_workbook": (".data_migration_service", "migrate_bank_workbook"),
    "migrate_sync_metadata_workbook_locked": (".data_migration_service", "migrate_sync_metadata_workbook_locked"),
    "start_metadata_backfill_worker": (".metadata_backfill_service", "start_metadata_backfill_worker"),
    "synchronize_data_directories": (".shared_sync_service", "synchronize_data_directories"),
    "start_shared_sync_worker": (".shared_sync_service", "start_shared_sync_worker"),
    "initialize_data_workbooks": (".workbook_initialization", "initialize_data_workbooks"),
    "get_device_label": (".workbook_merge", "get_device_label"),
    "new_row_id": (".workbook_merge", "new_row_id"),
    "calculate_content_hash": (".workbook_merge", "calculate_content_hash"),
    "ensure_row_metadata": (".workbook_merge", "ensure_row_metadata"),
    "refresh_sheet_metadata": (".workbook_merge", "refresh_sheet_metadata"),
    "append_tombstone": (".workbook_merge", "append_tombstone"),
    "ensure_tombstone_and_conflict_sheets": (".workbook_merge", "ensure_tombstone_and_conflict_sheets"),
    "map_row": (".workbook_merge", "map_row"),
    "header_key": (".workbook_headers", "header_key"),
    "normalize_header": (".workbook_headers", "normalize_header"),
    "header_indexes": (".workbook_headers", "header_indexes"),
    "map_workbook_row": (".workbook_headers", "map_workbook_row"),
    "HEADER_ALIASES": (".workbook_headers", "HEADER_ALIASES"),
    "get_header_value": (".workbook_headers", "get_header_value"),
    "merge_row_sets": (".workbook_merge", "merge_row_sets"),
    "normalize_device_label": (".workbook_merge", "normalize_device_label"),
    "read_conflicts": (".workbook_merge", "read_conflicts"),
    "read_tombstones": (".workbook_merge", "read_tombstones"),
    "recompute_derived": (".workbook_merge", "recompute_derived"),
    "ROW_ID_HEADER": (".workbook_merge", "ROW_ID_HEADER"),
    "get_backup_directory": (".excel_utils", "get_backup_directory"),
    "mirror_workbook_to_safety_copy": (".excel_utils", "mirror_workbook_to_safety_copy"),
    "readable_backup_timestamp": (".excel_utils", "readable_backup_timestamp"),
    "clear_module_rows": (".dev_data_clear_service", "clear_module_rows"),
    "clear_tool_status": (".dev_data_clear_service", "clear_tool_status"),
    "build_combined_position_png": (".summary_graph_service", "build_combined_position_png"),
    "build_monthly_bank_png": (".summary_graph_service", "build_monthly_bank_png"),
    "build_monthly_overview_png": (".summary_graph_service", "build_monthly_overview_png"),
    "build_monthly_share_png": (".summary_graph_service", "build_monthly_share_png"),
    "build_yearly_bank_png": (".summary_graph_service", "build_yearly_bank_png"),
    "build_yearly_overview_png": (".summary_graph_service", "build_yearly_overview_png"),
    "build_yearly_share_png": (".summary_graph_service", "build_yearly_share_png"),
    "merge_workbook_files": (".workbook_merge", "merge_workbook_files"),
    "ImportConflictResolution": (".import_conflicts", "ImportConflictResolution"),
    "resolve_import_record_conflict": (".import_conflicts", "resolve_import_record_conflict"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
