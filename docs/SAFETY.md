# SAFETY.md — Data Destruction Protocol (read before ANY task)

This file exists because "do testing," "clean up," "reset," and "start
fresh" have ambiguous meanings, and an agent guessing wrong here is
unrecoverable — unlike a bad code change, destroyed user data cannot be
undone by reverting a commit.

## 1. The rule, stated once, absolutely

**No command that deletes, truncates, drops, overwrites, or resets data
may run against anything except a path the agent itself created in the
current session for this sole purpose.** This applies regardless of how
the task was phrased, regardless of confidence the path is "just test
data," and regardless of whether a similar command was run successfully
before in this same conversation.

If you are not 100% certain a path is disposable, it is not disposable.
Stop and ask, naming the exact path and exact command.

## 2. Every data location in this repo is "real" until proven otherwise

Do NOT assume any of the following are safe to delete, even though they
look like dev/test artifacts:

- `.finledge-dev-data/` — **gitignored, meaning untracked**. The user's
  dev-mode desktop build very likely contains real transaction history
  entered during normal development use, not synthetic test data.
- `%APPDATA%\Finledge\` (production desktop data dir) or anything
  `FINLEDGE_DATA_DIR` points to — always real.
- Any mobile SQLite file under the app's `Directory.Data` (`FinLedge/` or
  `FinLedgeDev/` folders), and any `finledge_save.json` /
  `backup/<date>.json` file written by `data/storage.ts`.
- `backups/` under any data directory, including `backups/corrupted/` —
  these exist specifically to recover from the scenario you'd be causing.

The ONLY exception: a path the agent creates fresh in the same task, with
a name that makes its disposability obvious (e.g. a pytest `tmp_path`
fixture, or an explicitly-created `/tmp/finledge-test-<random>/`
directory) — and even then, only delete files inside that path that the
agent itself wrote.

## 3. Commands that require a STOP, every time, no exceptions

Before running any of the following, stop and ask the user — quote the
**exact command** and **exact path** you're about to run, and wait for
explicit confirmation naming that path:

- `git clean` in any form (`-f`, `-fd`, `-fdx`, `-fX`, etc.) — this
  deletes gitignored files, which includes `.finledge-dev-data/`.
- `git reset --hard`, `git checkout -- .` touching anything beyond the
  files you were explicitly asked to revert.
- `rm -rf` / `Remove-Item -Recurse -Force` / `shutil.rmtree` on any
  directory not created by the agent in this session.
- Any raw `DROP TABLE`, `TRUNCATE`, or `DELETE FROM <table>` without a
  `WHERE` clause scoped to rows the agent itself inserted as test data —
  whether against desktop's Excel-via-openpyxl or mobile's SQLite.
- `os.replace()` / `workbook.save()` / any write to a live `.xlsx` path
  (`bank_transactions.xlsx`, `share_transactions.xlsx`, either Personal
  Finance file, `personal_finance_transfer.xlsx`) from anything other than
  the normal service-layer functions already in the codebase.
- Any PowerShell/bash cleanup one-liner you write yourself to "free up
  space" or "remove old test files."

## 4. What "do testing" actually means here

When the user says "test this," "run the tests," "verify this works," or
similar — **without further detail** — it means exactly one of:

- Run the existing test suite as-is (`pytest backend/tests/`,
  `npm run mobile:test`), which already uses the isolated fixtures
  (`backend/tests/conftest.py`'s session-scoped `tmp_path`, mobile's
  equivalent) — never anything else.
- Write NEW tests following the exact same isolation pattern as the
  existing ones in that test file — a fresh temp directory per test run,
  never a path under `.finledge-dev-data/` or any production data dir.

It never means: manually running the app against real/dev data to "see if
it works," deleting existing data to get a clean starting state, or
resetting any data directory — unless the user's message explicitly names
the exact files/directories to delete, in that same message.

## 5. Build-artifact cleanup — the one legitimate exception, scoped exactly

`scripts/finledge.mjs`'s `cleanDesktopArtifacts()` is the one place in the
codebase that legitimately `fs.rmSync()`s a fixed, narrow list
(`desktop/dist`, `desktop/build/sidecar`) as part of the normal build
flow — this is fine and already reviewed. Do not extend this pattern to
new paths, and do not treat "there's precedent for rmSync in this repo" as
license to add more deletion calls elsewhere without going through §3.

## 6. If something looks corrupted or broken during a task

`backend/services/excel_utils.py`'s `repair_or_recover_workbook()` will
quarantine a file it thinks is corrupted and may create a **blank**
replacement workbook if no valid backup exists. If a task ever causes this
path to trigger against a real data directory, stop immediately and tell
the user exactly what happened and what file was touched — do not
silently let auto-recovery run and continue the task as if nothing
happened.

---

# Part 2 — SQLite, Migration and Device-Transfer Safety

**Status:** Phase 1 design. Not implemented yet.
This part extends Part 1; it never weakens it. Where the two overlap, the
stricter rule applies. Data model: `docs/schema.md`. Behaviour:
`docs/rules.md`. Transfer: `docs/device-transfer.md`.

## 7. SQLite backup principles

### 7.1 Never copy a live database file

Do **not** back up SQLite by copying `finledge.db` while the application is
running. In WAL mode the main file may not contain the latest committed
transactions, and the `-wal`/`-shm` sidecars are part of the live state. A plain
file copy can therefore be inconsistent even when no error is reported.

Approved mechanisms, in order of preference:

1. `sqlite3.Connection.backup()` — the online backup API. Produces a
   transactionally consistent copy while readers and the writer continue.
2. `VACUUM INTO 'path.db'` — a consistent compacted snapshot. Requires no
   concurrent schema change and enough free space.
3. A closed-database file copy — only when the application has fully shut down
   and no `-wal`/`-shm` files remain.

Never use `shutil.copy`, `Copy-Item`, `cp`, or a cloud-sync client as the
backup mechanism for a live database.

### 7.2 Backup location

- Live database: the environment data folder (`docs/schema.md` §11).
- Backups: `FINLEDGE_BACKUP_DIR` (`<shared sync dir>/Backups`), never inside
  the live database folder.
- Migration snapshots: `Backups/migration/<YYYY-MM-DD HHMMSSffffff>/`.
- Automatic snapshots: `Backups/auto/<database-stem>/`.
- Safety copies: `Backups/safety-copy/`.
- Quarantine: `Backups/corrupted/<timestamp>/`.
- Each environment uses its own backup root or its own subfolder. A testing
  build must never write into a production backup folder.

### 7.3 Verification

Every backup is verified before it is recorded as usable:

1. Open it read-only.
2. Run `PRAGMA quick_check` (or `integrity_check` for migration backups).
3. Read `PRAGMA user_version` and confirm it matches the expected version.
4. Run `PRAGMA foreign_key_check` and require zero rows.
5. Compare per-table row counts and, where practical, a content checksum with
   the source.
6. Only then update the backup manifest.

A backup that fails verification is moved to `Backups/corrupted/` and is never
offered as a restore source.

### 7.4 Retention

Mirror the existing automatic-snapshot policy rather than inventing a new one:

- Keep every snapshot from the recent window (the current implementation keeps
  dense recent history).
- Keep one per day beyond the recent window.
- Keep one per month beyond the daily window.
- Never prune migration, pre-restore, or pre-Replace backups automatically.
- Never prune backups referenced by the current migration marker.
- Pruning must be logged and must never remove the newest verified backup.

## 8. Snapshot triggers

A full database snapshot before every single-row write is unnecessary and
would itself become a performance and disk-space risk. Each write is protected
by an ACID transaction and WAL. The following operations **must** take a
verified snapshot first:

| Operation | Snapshot |
|---|---|
| Schema migration / `PRAGMA user_version` change | Required |
| Excel import (merge or replace) | Required |
| Legacy workbook migration | Required |
| Transfer commit in Smart Merge | Required once per session |
| Transfer commit in Replace mode | Required before any deletion |
| Manual database repair or rebuild | Required |
| Restore from backup | Required (snapshot the current state first) |
| Application upgrade that may migrate data | Required |
| Routine single-row create/edit/delete | Not required; atomic transaction is the protection |
| Full holdings rebuild | Recommended; required if the rebuild deletes the cache first |

A daily automatic snapshot runs on first launch of the day, matching the
existing "one backup per day" habit. It is skipped if a verified snapshot
already exists for that day.

## 9. Migration safety

### 9.1 Rehearsal

- Run every migration against a **copy** of real data, never the live original.
- Run it twice to prove idempotency.
- Compare source and destination counts and totals per category.
- Compare a sample of rows field-by-field, including UUIDs and both timestamps.
- Record the rehearsal command and result before touching a real profile.

### 9.2 Execution

1. Acquire the single-instance / data-directory lock.
2. Verify free space and write access.
3. Create and verify a pre-migration snapshot.
4. Create the new database in a temporary file.
5. Apply schema, then data, in one transaction per stage.
6. Run integrity and parity checks.
7. Atomically rename the temporary database into place.
8. Write the migration marker with the source fingerprints.
9. Keep the original workbooks and the pre-migration snapshot.

The live workbook is never modified, moved, or deleted by migration.

### 9.3 Rollback

- If any stage fails, delete only the temporary database the migration itself
  created (inside the migration temp directory) and leave the live database
  and workbooks untouched.
- If the final swap fails, the previous database remains in place.
- If the application cannot verify the new database, it opens the previous one
  read-only and reports the failure; it does not delete either.
- "Rollback" never means restoring an old backup over a newer database without
  an explicit user confirmation and a fresh snapshot of the newer state.

### 9.4 Markers and idempotency

- The existing `.finledge-data-migration-version.json` pattern is reused for
  workbook migrations.
- SQLite migrations use `PRAGMA user_version` plus `schema_migrations`.
- A marker is written only after verification succeeds.
- Re-running a completed migration is a no-op.

## 10. Corrupt database recovery

### 10.1 Detection

- On startup, run `PRAGMA quick_check`.
- On failure, do not attempt an in-place repair on the only copy.
- Quarantine the database and its `-wal`/`-shm` files together, into
  `Backups/corrupted/<timestamp>/`, before doing anything else.

### 10.2 Restore precedence

1. Newest verified automatic snapshot.
2. Newest verified migration/pre-Replace snapshot.
3. Newest verified safety copy.
4. Newest verified user export (Excel or JSON).
5. A new empty database — **only** with explicit user confirmation.

### 10.3 The empty-database rule

**An empty database must never silently replace or overwrite an existing
user's recoverable data.** If no verified backup exists:

- Open the existing database read-only if any part is readable.
- Show a clear recovery message naming the quarantined path.
- Offer export of readable rows.
- Require explicit confirmation before creating a fresh database.
- Never delete the quarantined files automatically.

This mirrors the existing Excel rule that a missing workbook is a first-run
state but a corrupted one is quarantined and reported.

### 10.4 WAL-specific recovery

- Do not delete `-wal` or `-shm` to "fix" a database. If SQLite cannot recover
  the WAL, quarantine all three files together.
- After a crash, opening the database normally performs WAL recovery. Only a
  failed `quick_check` triggers the quarantine path.

## 11. Restore behaviour

1. Require an explicit user action and an explicit source backup.
2. Snapshot the current database first, even if it is suspect.
3. Verify the chosen backup.
4. Close all connections.
5. Replace atomically (restore to a temp file, then rename).
6. Reopen, run `quick_check`, and compare `user_version`.
7. Rebuild `share_holdings` from transactions after restore.
8. Report what was restored and from which path.
9. Never delete the replaced database; move it to quarantine.

A restore of one environment must never touch another environment's database
or backups.

## 12. Environment isolation

| Environment | Database root | Backup root |
|---|---|---|
| Development | Development-only user-data root | Development Backups |
| Testing EXE + AppX | One shared per-user root (PROPOSED location) | Testing Backups |
| Production EXE + AppX | One shared per-user root (PROPOSED location) | Production Backups |
Hard rules:

The shared root is PROPOSED — AWAITING USER APPROVAL. It must be a writable per-user location outside AppX package-private storage and AppData virtualization. Verify both packages open the same physical file, cross-visible writes, survival after either package uninstall, and antivirus/App Certification Kit acceptance. If AppData redirection occurs, keep the old EXE folder as migration source only.

Migration identifies old workbooks, creates and verifies a backup in that same source-folder tree first, then creates SQLite and imports from copies. AppX-only first run uses the same resolver and folder structure. Store schema_version and min_app_version; older apps refuse writes to newer schemas and never downgrade.
- A testing process may not open, migrate, back up, restore, or delete a
  production path, even if a user points `FINLEDGE_DATA_DIR` at one.
- The existing channel protection (`getOtherChannelProtectedRoots`,
  `restrictToBuildChannel`) is extended to the database and backup resolvers.
- Development, Testing and Production remain isolated from each other.
- Within Testing, EXE and AppX share one physical SQLite database; within Production, EXE and AppX share one physical database. Device transfer remains user-initiated between devices/environments, not continuous sync.
- No live database, WAL, SHM, or temporary transfer file may live on a
  cloud-synced folder, network share, or removable drive that can disappear
  mid-write.

## 13. Import and Replace safety

- Every import takes a verified snapshot first.
- Import commits as one transaction; a failure rolls back completely.
- Replace mode takes a dedicated pre-Replace snapshot whose path is stored in
  `transfer_sessions.backup_path` / the import report.
- Replace never touches unselected categories.
- Replaced rows are tombstoned, not silently erased.
- A failed Replace restores the pre-Replace snapshot and reports it.
- Original source files are never deleted or overwritten.

## 14. Transaction atomicity and concurrency

- One writer at a time per database; `BEGIN IMMEDIATE` for write transactions.
- `PRAGMA foreign_keys = ON` on every connection, set once in the shared
  connection factory before any transaction starts. SQLite defaults it off and
  it cannot be changed inside an open transaction. A startup self-check reads
  `PRAGMA foreign_keys` and refuses writes when it is not `ON`.
- `PRAGMA journal_mode = WAL`.
- `PRAGMA synchronous = FULL` for financial durability.
- `PRAGMA busy_timeout = 5000` and a bounded retry policy for
  `SQLITE_BUSY`/`SQLITE_LOCKED`.
- A transaction either commits all financial effects (row + holdings +
  tombstones + conflict record) or none.
- Long reads use a read transaction; they never block the writer in WAL mode.
- Both packages may run concurrently. Use WAL, one writer, short transactions, a clear locked/retry message, reread on window focus and periodically check PRAGMA data_version. The Python sidecar uses a per-database single-instance/port rule.

## 15. Device-transfer safety

### 15.1 No blind database copy

A transfer never sends a live `.db` file. It sends logical, validated
records with per-batch checksums. The receiving device writes only through its
service layer.

### 15.2 Staging

- Received records go to `transfer_staged_records`, never directly to canonical
  tables.
- A batch is committed only after: checksum verified, schema/capability
  negotiation passed, every record validated, and the user confirmed.
- An incomplete or corrupt batch is marked and never committed.
- Previously committed batches are idempotent on replay.

### 15.3 Replace safety

- Replace requires a verified pre-Replace snapshot.
- It replaces only selected categories.
- It never wipes unrelated categories.
- It stores the backup path in the session so the user can recover.

### 15.4 Interrupted transfer

- Confirmed records remain committed.
- Unconfirmed records remain staged.
- Reconnecting to the same session resumes from the last acknowledged batch.
- Expired sessions remove staged rows and temporary files; committed records
  stay.
- Session cleanup never deletes canonical records.

### 15.5 Authentication, encryption and secrets

- The pairing token is short-lived, single-use, and stored only as a hash.
- The QR code carries connection/session metadata and the token — never
  financial records.
- Transport is encrypted (TLS with a certificate fingerprint pinned in the QR
  code for the LAN adapter).
- Batch payloads are integrity-checked with SHA-256.
- Tokens, keys, decrypted payloads, and temporary files are removed on
  completion, cancellation, expiry, or crash recovery.
- No secret is ever placed in a frontend `VITE_*` variable or committed to the
  repository.
- The transfer feature is excluded from production builds at build time
  (`docs/device-transfer.md` §12); hiding the menu is not sufficient.

### 15.6 Sensitive temporary data

- Staged payloads live in the database, not in world-readable temp files.
- If a temp file is unavoidable, it is created in the app's private data
  directory with restrictive permissions and deleted in a `finally` block.
- Logs never contain record payloads, tokens, or full financial values.

## 16. Recovery tests (Phase 2–4)

Every item is a required automated or rehearsed test:

1. Kill the process mid-write; reopen; `quick_check` passes; committed rows
   survive, uncommitted rows do not.
2. Kill the process mid-migration; original database and workbooks intact;
   rerun completes.
3. Corrupt the main database; startup quarantines it and offers the newest
   verified backup.
4. Delete the `-wal` file deliberately; recovery refuses to guess and reports.
5. Restore a backup and verify counts, totals and holdings.
6. Run Replace, interrupt it, and verify the pre-Replace snapshot restores.
7. Interrupt a transfer after some batches; confirmed records survive;
   unconfirmed records resume or expire cleanly.
8. Tamper with a batch checksum; it is rejected and never committed.
9. Expire a session; staged rows and temp files are removed; canonical data is
   untouched.
10. Confirm a production build contains no transfer routes, IPC channels,
    preload APIs, or backend transfer package.

## 17. Incident response

If any operation touches a real data path unexpectedly:

1. Stop the task immediately.
2. Do not retry, clean up, or "fix" the path.
3. Record the exact path, command, and observed state.
4. Preserve the quarantined files and backups.
5. Tell the user exactly what happened and what is recoverable.
6. Only proceed with an explicit instruction naming the path.

This applies equally to Excel workbooks, SQLite databases, WAL files, backups,
and mobile app-private storage.