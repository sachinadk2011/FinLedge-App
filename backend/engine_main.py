import ctypes
import os
import argparse
import json
import threading
import time
from pathlib import Path

import uvicorn


def _watch_parent_process() -> None:
    """Exit the sidecar if its Electron owner is gone (including force-close)."""
    raw_parent_pid = str(os.getenv("FINLEDGE_PARENT_PID") or "").strip()
    if not raw_parent_pid.isdigit():
        return
    parent_pid = int(raw_parent_pid)

    def monitor() -> None:
        if os.name == "nt":
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel32.OpenProcess.argtypes = (ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32)
            kernel32.OpenProcess.restype = ctypes.c_void_p
            kernel32.WaitForSingleObject.argtypes = (ctypes.c_void_p, ctypes.c_uint32)
            kernel32.WaitForSingleObject.restype = ctypes.c_uint32
            kernel32.CloseHandle.argtypes = (ctypes.c_void_p,)
            kernel32.CloseHandle.restype = ctypes.c_int
            synchronize = 0x00100000
            wait_object_0 = 0
            wait_timeout = 258

            while True:
                handle = kernel32.OpenProcess(synchronize, False, parent_pid)
                if not handle:
                    # Windows reports ERROR_INVALID_PARAMETER when the PID no longer exists.
                    if ctypes.get_last_error() == 87:
                        os._exit(0)
                    time.sleep(2)
                    continue
                try:
                    wait_result = kernel32.WaitForSingleObject(handle, 0)
                finally:
                    kernel32.CloseHandle(handle)
                if wait_result == wait_object_0:
                    os._exit(0)
                if wait_result != wait_timeout:
                    time.sleep(2)
                    continue
                time.sleep(2)

        while True:
            try:
                os.kill(parent_pid, 0)
            except OSError:
                os._exit(0)
            time.sleep(2)

    threading.Thread(target=monitor, name="finledge-parent-watch", daemon=True).start()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare-data", action="store_true")
    options = parser.parse_args()
    if options.prepare_data:
        from backend.services.data_directory_service import migrate_legacy_workbooks
        from backend.services.path_utils import get_data_dir
        from backend.services.workbook_initialization import initialize_data_workbooks

        raw_sources = os.getenv("FINLEDGE_LEGACY_DATA_DIRS", "[]")
        try:
            sources = [Path(item) for item in json.loads(raw_sources)]
        except (TypeError, ValueError) as exc:
            raise RuntimeError("Invalid legacy data folder configuration") from exc
        migration = migrate_legacy_workbooks(get_data_dir(), sources)
        workbooks = initialize_data_workbooks(get_data_dir())
        print(json.dumps({**migration, "workbooks": workbooks}))
        return

    from backend.main import app
    _watch_parent_process()
    host = os.getenv("FINLEDGE_BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("FINLEDGE_BACKEND_PORT", "8000"))
    log_level = os.getenv("FINLEDGE_BACKEND_LOG_LEVEL", "info")

    uvicorn.run(app, host=host, port=port, log_level=log_level)


if __name__ == "__main__":
    main()
