"""Stable public API for SQLite infrastructure."""

from backend._package_api import package_dir, resolve_export

_EXPORTS = {
    "BUSY_TIMEOUT_MS": (".connection", "BUSY_TIMEOUT_MS"),
    "SUPPORTED_SCHEMA_VERSION": (".connection", "SUPPORTED_SCHEMA_VERSION"),
    "FinLedgeConnection": (".connection", "FinLedgeConnection"),
    "connect_database": (".connection", "connect_database"),
    "DATABASE_DIRECTORY": (".database_path", "DATABASE_DIRECTORY"),
    "DATABASE_FILENAME": (".database_path", "DATABASE_FILENAME"),
    "resolve_database_path": (".database_path", "resolve_database_path"),
    "resolve_application_database_path": (".database_path", "resolve_application_database_path"),
    "SnapshotReport": (".backup", "SnapshotReport"),
    "create_verified_snapshot": (".backup", "create_verified_snapshot"),
    "content_hash": (".content_hash", "content_hash"),
    "normalize_hash_text": (".content_hash", "normalize_hash_text"),
    "stamp_create": (".metadata", "stamp_create"),
    "stamp_material_edit": (".metadata", "stamp_material_edit"),
    "Migration": (".migration_runner", "Migration"),
    "apply_migrations": (".migration_runner", "apply_migrations"),
    "discover_migrations": (".migration_runner", "discover_migrations"),
    "MONEY_SCALE": (".row_mapping", "MONEY_SCALE"),
    "PRICE_SCALE": (".row_mapping", "PRICE_SCALE"),
    "decimal_to_scaled": (".row_mapping", "decimal_to_scaled"),
    "scaled_to_decimal": (".row_mapping", "scaled_to_decimal"),
    "MINIMUM_SQLITE_VERSION": (".schema", "MINIMUM_SQLITE_VERSION"),
    "migrate_database": (".schema", "migrate_database"),
    "verify_sqlite_engine": (".schema", "verify_sqlite_engine"),
    "transaction": (".transactions", "transaction"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    return resolve_export(globals(), _EXPORTS, name)


def __dir__():
    return package_dir(globals())
