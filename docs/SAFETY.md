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