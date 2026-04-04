#!/usr/bin/env python3
"""
Run login pipeline in background without a console window:
1) best-config global pool
2) timeout comparison

Best-config output goes to logs/login_pipeline.log.
Timeout study writes detailed logs under logs/timeout_comparison/
(timeout_orchestrator.log, timeout_alg0.log, timeout_alg2.log).
"""

from __future__ import annotations

import datetime as _dt
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = REPO_ROOT / "logs"
LOG_FILE = LOG_DIR / "login_pipeline.log"
TIMEOUT_LOG_DIR = LOG_DIR / "timeout_comparison"


def _run_step(
    cmd: list[str],
    log_fh,
    *,
    proc_stdout=None,
) -> int:
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    log_fh.write(f"\n{'=' * 80}\n")
    log_fh.write(f"CMD: {' '.join(cmd)}\n")
    log_fh.write(f"{'=' * 80}\n")
    log_fh.flush()
    out = log_fh if proc_stdout is None else proc_stdout
    proc = subprocess.Popen(
        cmd,
        cwd=str(REPO_ROOT),
        stdout=out,
        stderr=subprocess.STDOUT,
        creationflags=creationflags,
    )
    return proc.wait()


def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8", newline="\n") as log_fh:
        log_fh.write(f"\n[{_dt.datetime.now().isoformat(timespec='seconds')}] Login pipeline start\n")
        py = sys.executable

        rc = _run_step(
            [py, "scripts/run_best_config_global_pool.py", "--workers-per-size", "2", "--verbose"],
            log_fh,
        )
        log_fh.write(f"best-config exit code: {rc}\n")
        log_fh.flush()
        if rc != 0:
            log_fh.write("Stopping pipeline because best-config failed.\n")
            return rc

        TIMEOUT_LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_fh.write(
            "Timeout comparison logs: "
            f"{TIMEOUT_LOG_DIR / 'timeout_orchestrator.log'}, "
            f"{TIMEOUT_LOG_DIR / 'timeout_alg0.log'}, "
            f"{TIMEOUT_LOG_DIR / 'timeout_alg2.log'}\n"
        )
        log_fh.flush()
        rc = _run_step(
            [
                py,
                "scripts/run_algo_timeout_comparison.py",
                "--workers-per-alg",
                "4",
                "--verbose",
                "--log-dir",
                str(TIMEOUT_LOG_DIR),
            ],
            log_fh,
            proc_stdout=subprocess.DEVNULL,
        )
        log_fh.write(f"timeout-study exit code: {rc}\n")
        log_fh.write(f"[{_dt.datetime.now().isoformat(timespec='seconds')}] Login pipeline end\n")
        return rc


if __name__ == "__main__":
    raise SystemExit(main())

