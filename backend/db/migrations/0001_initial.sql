-- Initial Desktop schema generated from docs/schema.md active DDL.
-- The proposed sip_plans master table is excluded; SIP plan identity is the
-- approved UUID plus name stored on sip_transactions and sip_plan_summaries.
PRAGMA foreign_keys = ON;

CREATE TABLE bank_transactions (
    row_id                 TEXT    PRIMARY KEY,
    sequence_no            INTEGER NOT NULL,
    txn_date               TEXT    NOT NULL,
    category               TEXT    NOT NULL,
    amount_scaled          INTEGER NOT NULL,
    description            TEXT,
    created_timestamp      TEXT    NOT NULL,
    last_updated_timestamp TEXT    NOT NULL,
    updated_device         TEXT    NOT NULL,
    metadata_quality       TEXT    NOT NULL DEFAULT 'exact',
    content_hash           TEXT    NOT NULL,
    CHECK (length(row_id) = 36),
    CHECK (txn_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (sequence_no > 0),
    CHECK (updated_device IN ('desktop-exe','desktop-appx','desktop-dev','desktop-test','mobile','legacy')),
    CHECK (metadata_quality IN ('exact','legacy_offset','legacy_naive','legacy_date_only','backfilled','imported_missing')),
    CHECK (content_hash LIKE 'sha256:%'),
    CHECK (category <> '')
);

CREATE UNIQUE INDEX ux_bank_sequence ON bank_transactions(sequence_no);

CREATE INDEX ix_bank_date       ON bank_transactions(txn_date, sequence_no);

CREATE INDEX ix_bank_category   ON bank_transactions(category, txn_date);

CREATE INDEX ix_bank_updated    ON bank_transactions(last_updated_timestamp);

CREATE TABLE personal_finance_entries (
    row_id                 TEXT    PRIMARY KEY,
    sequence_no            INTEGER NOT NULL,
    txn_date               TEXT    NOT NULL,
    flow_type              TEXT    NOT NULL,
    direction              TEXT    NOT NULL,
    category               TEXT    NOT NULL,
    amount_scaled          INTEGER NOT NULL,
    signed_amount_scaled   INTEGER NOT NULL,
    description            TEXT,
    created_timestamp      TEXT    NOT NULL,
    last_updated_timestamp TEXT    NOT NULL,
    updated_device         TEXT    NOT NULL,
    metadata_quality       TEXT    NOT NULL DEFAULT 'exact',
    content_hash           TEXT    NOT NULL,
    CHECK (length(row_id) = 36),
    CHECK (txn_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (sequence_no > 0),
    CHECK (flow_type IN ('bank','cash')),
    CHECK (direction IN ('income','expense')),
    CHECK (amount_scaled > 0),
    CHECK (signed_amount_scaled = CASE WHEN direction = 'income' THEN amount_scaled ELSE -amount_scaled END),
    CHECK (updated_device IN ('desktop-exe','desktop-appx','desktop-dev','desktop-test','mobile','legacy')),
    CHECK (metadata_quality IN ('exact','legacy_offset','legacy_naive','legacy_date_only','backfilled','imported_missing')),
    CHECK (content_hash LIKE 'sha256:%'),
    CHECK (category <> '')
);

CREATE UNIQUE INDEX ux_pf_sequence ON personal_finance_entries(sequence_no);

CREATE INDEX ix_pf_flow_date       ON personal_finance_entries(flow_type, txn_date, sequence_no);

CREATE INDEX ix_pf_category        ON personal_finance_entries(flow_type, category, txn_date);

CREATE INDEX ix_pf_updated         ON personal_finance_entries(last_updated_timestamp);

CREATE TABLE share_transactions (
    row_id                 TEXT    PRIMARY KEY,
    sequence_no            INTEGER NOT NULL,
    txn_date               TEXT    NOT NULL,
    share_id               TEXT    NOT NULL REFERENCES shares(share_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    transaction_type       TEXT    NOT NULL,
    per_unit_price_scaled  INTEGER NOT NULL,
    quantity               INTEGER,
    charge_scaled          INTEGER NOT NULL DEFAULT 0,
    created_timestamp      TEXT    NOT NULL,
    last_updated_timestamp TEXT    NOT NULL,
    updated_device         TEXT    NOT NULL,
    metadata_quality       TEXT    NOT NULL DEFAULT 'exact',
    content_hash           TEXT    NOT NULL,
    CHECK (length(row_id) = 36),
    CHECK (txn_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (sequence_no > 0),
    CHECK (transaction_type IN ('ipo','buy','sell')),
    CHECK (per_unit_price_scaled >= 0),
    CHECK (charge_scaled >= 0),
    CHECK (
        (transaction_type = 'ipo' AND (quantity IS NULL OR quantity > 0))
        OR (transaction_type IN ('buy','sell') AND quantity > 0)
    ),
    CHECK (updated_device IN ('desktop-exe','desktop-appx','desktop-dev','desktop-test','mobile','legacy')),
    CHECK (metadata_quality IN ('exact','legacy_offset','legacy_naive','legacy_date_only','backfilled','imported_missing')),
    CHECK (content_hash LIKE 'sha256:%')
) STRICT;

CREATE UNIQUE INDEX ux_share_sequence ON share_transactions(sequence_no);

CREATE INDEX ix_share_share_date   ON share_transactions(share_id, txn_date, sequence_no);

CREATE INDEX ix_share_date         ON share_transactions(txn_date, sequence_no);

CREATE INDEX ix_share_updated      ON share_transactions(last_updated_timestamp);

CREATE TABLE sip_transactions (
    row_id                 TEXT    PRIMARY KEY,
    sequence_no            INTEGER NOT NULL,
    txn_date               TEXT    NOT NULL,
    investment_name        TEXT    NOT NULL,
    sip_plan_id            TEXT    NOT NULL,  -- PROPOSED: REFERENCES sip_plans(sip_plan_id) ON DELETE RESTRICT ON UPDATE RESTRICT
    transaction_type       TEXT    NOT NULL,
    amount_scaled          INTEGER NOT NULL,
    charge_scaled          INTEGER NOT NULL DEFAULT 0,
    units                  INTEGER,
    created_timestamp      TEXT    NOT NULL,
    last_updated_timestamp TEXT    NOT NULL,
    updated_device         TEXT    NOT NULL,
    metadata_quality       TEXT    NOT NULL DEFAULT 'exact',
    content_hash           TEXT    NOT NULL,
    CHECK (length(row_id) = 36),
    CHECK (length(sip_plan_id) = 36),
    CHECK (txn_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (sequence_no > 0),
    CHECK (transaction_type IN ('sip_installment','sip_redemption')),
    CHECK (amount_scaled > 0),
    CHECK (charge_scaled >= 0),
    CHECK (units IS NULL OR units > 0),
    CHECK (transaction_type <> 'sip_redemption' OR units IS NULL),
    CHECK (updated_device IN ('desktop-exe','desktop-appx','desktop-dev','desktop-test','mobile','legacy')),
    CHECK (metadata_quality IN ('exact','legacy_offset','legacy_naive','legacy_date_only','backfilled','imported_missing')),
    CHECK (content_hash LIKE 'sha256:%'),
    CHECK (trim(investment_name) <> '')
) STRICT;

CREATE UNIQUE INDEX ux_sip_sequence ON sip_transactions(sequence_no);

CREATE INDEX ix_sip_plan_date      ON sip_transactions(sip_plan_id, txn_date, sequence_no);

CREATE INDEX ix_sip_name_date      ON sip_transactions(investment_name, txn_date, sequence_no);

CREATE INDEX ix_sip_date           ON sip_transactions(txn_date, sequence_no);

CREATE INDEX ix_sip_updated        ON sip_transactions(last_updated_timestamp);

CREATE TABLE shares (
    share_id          TEXT PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    created_timestamp TEXT NOT NULL,
    CHECK (length(share_id) = 36),
    CHECK (name = upper(trim(name)) AND trim(name) <> '')
) STRICT;

CREATE TABLE dividend_events (
    row_id                 TEXT    PRIMARY KEY,
    sequence_no            INTEGER NOT NULL,
    txn_date               TEXT    NOT NULL,
    share_id               TEXT    NOT NULL REFERENCES shares(share_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    event_type             TEXT    NOT NULL,
    cash_amount_scaled     INTEGER,
    quantity               INTEGER,
    created_timestamp      TEXT    NOT NULL,
    last_updated_timestamp TEXT    NOT NULL,
    updated_device         TEXT    NOT NULL,
    metadata_quality       TEXT    NOT NULL DEFAULT 'exact',
    content_hash           TEXT    NOT NULL,
    CHECK (length(row_id) = 36),
    CHECK (txn_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (sequence_no > 0),
    CHECK (event_type IN ('cash','bonus')),
    CHECK (
        (event_type = 'cash' AND cash_amount_scaled >= 0 AND quantity IS NULL)
        OR (event_type = 'bonus' AND quantity > 0 AND cash_amount_scaled IS NULL)
    ),
    CHECK (updated_device IN ('desktop-exe','desktop-appx','desktop-dev','desktop-test','mobile','legacy')),
    CHECK (metadata_quality IN ('exact','legacy_offset','legacy_naive','legacy_date_only','backfilled','imported_missing')),
    CHECK (content_hash LIKE 'sha256:%')
) STRICT;

CREATE UNIQUE INDEX ux_dividend_sequence ON dividend_events(sequence_no);

CREATE INDEX ix_dividend_share_date    ON dividend_events(share_id, txn_date, sequence_no);

CREATE INDEX ix_dividend_date          ON dividend_events(txn_date, sequence_no);

CREATE INDEX ix_dividend_updated       ON dividend_events(last_updated_timestamp);

CREATE TABLE share_holdings (
    share_id TEXT PRIMARY KEY REFERENCES shares(share_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    quantity INTEGER NOT NULL CHECK(quantity >= 0),
    total_cost_scaled INTEGER NOT NULL CHECK(total_cost_scaled >= 0),
    average_cost_scaled INTEGER NOT NULL CHECK(average_cost_scaled >= 0),
    realized_profit_loss_scaled INTEGER NOT NULL,
    cash_dividends_scaled INTEGER NOT NULL,
    bonus_units INTEGER NOT NULL CHECK(bonus_units >= 0),
    last_event_sequence_no INTEGER NOT NULL CHECK(last_event_sequence_no >= 0),
    calculation_version INTEGER NOT NULL CHECK(calculation_version > 0),
    summary_updated_timestamp TEXT NOT NULL,
    summary_updated_device TEXT NOT NULL
);

CREATE TABLE sip_plan_summaries (
    sip_plan_id TEXT PRIMARY KEY,
    sip_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    outstanding_principal_scaled INTEGER NOT NULL,
    updated_units_total INTEGER NOT NULL,
    pending_installment_count INTEGER NOT NULL,
    total_redeemed_scaled INTEGER NOT NULL,
    realized_profit_loss_scaled INTEGER NOT NULL,
    plan_status TEXT NOT NULL CHECK(plan_status IN ('open','closed')),
    last_event_sequence_no INTEGER NOT NULL,
    calculation_version INTEGER NOT NULL,
    summary_updated_timestamp TEXT NOT NULL,
    summary_updated_device TEXT NOT NULL
);

CREATE TABLE transfers (
    row_id                 TEXT    PRIMARY KEY,
    sequence_no            INTEGER NOT NULL,
    txn_date               TEXT    NOT NULL,
    direction              TEXT    NOT NULL,
    amount_scaled          INTEGER NOT NULL,
    description            TEXT,
    transfer_ref           TEXT    NOT NULL,
    created_timestamp      TEXT    NOT NULL,
    last_updated_timestamp TEXT    NOT NULL,
    updated_device         TEXT    NOT NULL,
    metadata_quality       TEXT    NOT NULL DEFAULT 'exact',
    content_hash           TEXT    NOT NULL,
    CHECK (length(row_id) = 36),
    CHECK (txn_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (sequence_no > 0),
    CHECK (direction IN ('bank_to_cash','cash_to_bank')),
    CHECK (amount_scaled > 0),
    CHECK (updated_device IN ('desktop-exe','desktop-appx','desktop-dev','desktop-test','mobile','legacy')),
    CHECK (metadata_quality IN ('exact','legacy_offset','legacy_naive','legacy_date_only','backfilled','imported_missing')),
    CHECK (content_hash LIKE 'sha256:%'),
    CHECK (trim(transfer_ref) <> '')
);

CREATE UNIQUE INDEX ux_transfer_sequence ON transfers(sequence_no);

CREATE UNIQUE INDEX ux_transfer_ref      ON transfers(transfer_ref);

CREATE INDEX ix_transfer_date            ON transfers(txn_date, sequence_no);

CREATE TABLE deleted_records (
    row_id             TEXT PRIMARY KEY,
    entity_type        TEXT NOT NULL,
    deleted_timestamp  TEXT NOT NULL,
    deleted_by_device  TEXT NOT NULL,
    sequence_no        INTEGER,
    note               TEXT,
    CHECK (entity_type IN ('bank','personal_finance','share','sip','dividend','transfer')),
    CHECK (deleted_by_device IN ('desktop-exe','desktop-appx','desktop-dev','desktop-test','mobile','legacy'))
);

CREATE INDEX ix_deleted_entity_time ON deleted_records(entity_type, deleted_timestamp);

CREATE TABLE record_conflicts (
    conflict_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    row_id              TEXT NOT NULL,
    entity_type         TEXT NOT NULL,
    losing_values_json  TEXT NOT NULL,
    losing_device       TEXT NOT NULL,
    winning_timestamp   TEXT,
    detected_timestamp  TEXT NOT NULL,
    resolution          TEXT NOT NULL DEFAULT 'pending',
    resolved_timestamp  TEXT,
    CHECK (entity_type IN ('bank','personal_finance','share','sip','dividend','transfer')),
    CHECK (resolution IN ('pending','kept_local','kept_incoming','merged','dismissed'))
);

CREATE UNIQUE INDEX ux_conflict_dedupe ON record_conflicts(row_id, losing_device, losing_values_json);

CREATE INDEX ix_conflict_pending      ON record_conflicts(resolution, detected_timestamp);

CREATE TABLE transfer_sessions (
    session_id              TEXT PRIMARY KEY,
    direction               TEXT NOT NULL,
    peer_device_id          TEXT,
    peer_device_label       TEXT,
    protocol_version        TEXT NOT NULL,
    schema_version          INTEGER NOT NULL,
    capabilities_json       TEXT NOT NULL,
    state                   TEXT NOT NULL,
    mode                    TEXT NOT NULL,
    selection_json          TEXT NOT NULL,
    created_timestamp       TEXT NOT NULL,
    expires_timestamp       TEXT NOT NULL,
    last_activity_timestamp TEXT NOT NULL,
    resume_token_hash       TEXT,
    backup_path             TEXT,
    error_code              TEXT,
    error_message           TEXT,
    CHECK (direction IN ('desktop_to_mobile','mobile_to_desktop')),
    CHECK (state IN ('pairing','active','paused','reviewing','completed','cancelled','expired','failed')),
    CHECK (mode IN ('smart_merge','replace')),
    CHECK (peer_device_label IS NULL OR peer_device_label IN ('desktop-exe','desktop-appx','desktop-dev','desktop-test','mobile','legacy'))
);

CREATE INDEX ix_session_state ON transfer_sessions(state, expires_timestamp);

CREATE TABLE transfer_batches (
    batch_id           TEXT PRIMARY KEY,
    session_id         TEXT NOT NULL REFERENCES transfer_sessions(session_id) ON DELETE CASCADE,
    sequence_no        INTEGER NOT NULL,
    category           TEXT NOT NULL,
    record_count       INTEGER NOT NULL,
    payload_checksum   TEXT NOT NULL,
    received_timestamp TEXT NOT NULL,
    state              TEXT NOT NULL,
    CHECK (sequence_no > 0),
    CHECK (record_count >= 0),
    CHECK (state IN ('receiving','validated','committed','rejected','incomplete')),
    CHECK (payload_checksum LIKE 'sha256:%')
);

CREATE UNIQUE INDEX ux_batch_session_seq ON transfer_batches(session_id, sequence_no);

CREATE INDEX ix_batch_state            ON transfer_batches(session_id, state);

CREATE TABLE transfer_staged_records (
    staged_id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id           TEXT NOT NULL REFERENCES transfer_sessions(session_id) ON DELETE CASCADE,
    batch_id             TEXT NOT NULL REFERENCES transfer_batches(batch_id) ON DELETE CASCADE,
    entity_type          TEXT NOT NULL,
    row_id               TEXT NOT NULL,
    payload_json         TEXT NOT NULL,
    content_hash         TEXT NOT NULL,
    validation_status    TEXT NOT NULL,
    validation_detail    TEXT,
    review_decision      TEXT NOT NULL DEFAULT 'pending',
    edited_payload_json  TEXT,
    committed_timestamp  TEXT,
    CHECK (entity_type IN ('bank','personal_finance','share','sip','dividend','transfer')),
    CHECK (validation_status IN ('valid','already_present','conflict','possible_duplicate','invalid','unsupported')),
    CHECK (review_decision IN ('pending','accept','skip','replace','edit')),
    CHECK (content_hash LIKE 'sha256:%')
);

CREATE UNIQUE INDEX ux_staged_identity ON transfer_staged_records(session_id, entity_type, row_id);

CREATE INDEX ix_staged_review         ON transfer_staged_records(session_id, validation_status, review_decision);

CREATE TABLE legacy_identity_map (
    identity_key      TEXT PRIMARY KEY,
    row_id            TEXT NOT NULL UNIQUE,
    created_timestamp TEXT NOT NULL,
    CHECK (length(row_id) = 36)
);

CREATE TABLE schema_migrations (
    version           INTEGER PRIMARY KEY,
    applied_timestamp TEXT NOT NULL,
    checksum          TEXT NOT NULL,
    description       TEXT NOT NULL
);

CREATE VIEW v_share_history AS
SELECT st.row_id, 'share' AS entity_type, st.sequence_no, st.txn_date,
       sh.name AS investment_name, st.transaction_type,
       st.quantity, NULL AS units, NULL AS amount_scaled, NULL AS sip_plan_id
FROM share_transactions AS st
JOIN shares AS sh ON sh.share_id = st.share_id
UNION ALL
SELECT row_id, 'sip' AS entity_type, sequence_no, txn_date,
       investment_name, transaction_type,
       NULL AS quantity, units, amount_scaled, sip_plan_id
FROM sip_transactions
UNION ALL
SELECT dv.row_id, 'dividend' AS entity_type, dv.sequence_no, dv.txn_date,
       sh.name AS investment_name, dv.event_type AS transaction_type,
       dv.quantity, NULL AS units, dv.cash_amount_scaled AS amount_scaled, NULL AS sip_plan_id
FROM dividend_events AS dv
JOIN shares AS sh ON sh.share_id = dv.share_id;

CREATE VIEW v_investment_names AS
SELECT name AS investment_name FROM shares
UNION
SELECT DISTINCT investment_name FROM sip_transactions;

CREATE TABLE app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
) STRICT;
INSERT INTO app_metadata(key, value) VALUES
    ('schema_version', '1'),
    ('min_app_version', '1.3.0'),
    ('share_sequence_next', '1'),
    ('sip_sequence_next', '1');
