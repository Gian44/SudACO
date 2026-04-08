#!/usr/bin/env python3
"""
Run four additional CP comparison benchmark runs for:
- CP-ACS (alg 0)
- CP-DCM-ACO (alg 2)

Execution model:
- Runs 2..5 by default (assuming run 1 already exists)
- For each size: finish runs 2..5, then move to next size
- Size order: 9x9 -> 16x16 -> 25x25
- For each size: start alg 0 and alg 2 in parallel
- Each algorithm uses pool workers (default: 4)

This script orchestrates existing benchmark scripts:
- scripts/run_9x9.py
- scripts/run_16x16.py
- scripts/run_25x25.py
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path


SIZES = [
    ("9x9", "scripts/run_9x9.py"),
    ("16x16", "scripts/run_16x16.py"),
    ("25x25", "scripts/run_25x25.py"),
]

ALGS = [
    (0, "CP-ACS"),
    (2, "CP-DCM-ACO"),
]


def _now() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def _build_cmd(
    python_exe: str,
    script_rel: str,
    alg: int,
    run_idx: int,
    pool_workers: int,
    binary: str | None,
    verbose: bool,
) -> list[str]:
    cmd = [
        python_exe,
        script_rel,
        "--alg",
        str(int(alg)),
        "--run",
        str(int(run_idx)),
        "--pool-workers",
        str(int(pool_workers)),
    ]
    if binary:
        cmd.extend(["--binary", binary])
    if verbose:
        cmd.append("--verbose")
    return cmd


def _terminate(proc: subprocess.Popen, timeout_s: float = 5.0) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=timeout_s)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


def _run_size_phase(
    *,
    repo_root: Path,
    python_exe: str,
    size_name: str,
    script_rel: str,
    run_idx: int,
    pool_workers: int,
    binary: str | None,
    verbose: bool,
    dry_run: bool,
) -> int:
    cmds = []
    for alg, alg_name in ALGS:
        cmd = _build_cmd(
            python_exe=python_exe,
            script_rel=script_rel,
            alg=alg,
            run_idx=run_idx,
            pool_workers=pool_workers,
            binary=binary,
            verbose=verbose,
        )
        cmds.append((alg, alg_name, cmd))

    print(
        f"[{_now()}] [RUN {run_idx}] [SIZE {size_name}] "
        f"starting {len(cmds)} algorithm processes in parallel",
        flush=True,
    )
    for _, alg_name, cmd in cmds:
        print(f"  - {alg_name}: {' '.join(cmd)}", flush=True)

    if dry_run:
        return 0

    procs: dict[int, tuple[str, subprocess.Popen]] = {}
    for alg, alg_name, cmd in cmds:
        procs[alg] = (
            alg_name,
            subprocess.Popen(cmd, cwd=str(repo_root)),
        )

    first_failure: tuple[int, str, int] | None = None
    try:
        while procs:
            completed = []
            for alg, (alg_name, proc) in procs.items():
                rc = proc.poll()
                if rc is None:
                    continue
                completed.append(alg)
                print(
                    f"[{_now()}] [RUN {run_idx}] [SIZE {size_name}] "
                    f"{alg_name} finished with exit_code={rc}",
                    flush=True,
                )
                if rc != 0 and first_failure is None:
                    first_failure = (alg, alg_name, rc)

            for alg in completed:
                procs.pop(alg, None)

            if first_failure is not None:
                # Stop peers if one process failed.
                for _, proc in procs.values():
                    _terminate(proc)
                procs.clear()
                break

            if procs:
                time.sleep(0.25)
    except KeyboardInterrupt:
        print(f"[{_now()}] Interrupted. Terminating running processes...", flush=True)
        for _, proc in procs.values():
            _terminate(proc)
        raise

    if first_failure is not None:
        _alg, alg_name, rc = first_failure
        print(
            f"[{_now()}] [RUN {run_idx}] [SIZE {size_name}] "
            f"FAILED due to {alg_name} exit_code={rc}",
            flush=True,
        )
        return int(rc)

    print(
        f"[{_now()}] [RUN {run_idx}] [SIZE {size_name}] completed",
        flush=True,
    )
    return 0


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    default_python = sys.executable

    ap = argparse.ArgumentParser(
        description=(
            "Run CP-ACS (alg 0) and CP-DCM-ACO (alg 2) for runs 2..5 "
            "across 9x9 -> 16x16 -> 25x25, with parallel workers."
        )
    )
    ap.add_argument("--run-start", type=int, default=2, help="First run index (default: 2)")
    ap.add_argument("--run-end", type=int, default=5, help="Last run index inclusive (default: 5)")
    ap.add_argument(
        "--pool-workers",
        type=int,
        default=4,
        help="Pool workers per algorithm process (default: 4)",
    )
    ap.add_argument(
        "--binary",
        default=None,
        help="Optional explicit solver binary path passed to child scripts",
    )
    ap.add_argument(
        "--python",
        default=default_python,
        help="Python executable for child script invocations (default: current interpreter)",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned commands only; do not execute child processes",
    )
    ap.add_argument("--verbose", action="store_true", help="Pass --verbose to child scripts")
    args = ap.parse_args()

    if args.run_start < 1:
        ap.error("--run-start must be >= 1")
    if args.run_end < args.run_start:
        ap.error("--run-end must be >= --run-start")
    if args.pool_workers < 1:
        ap.error("--pool-workers must be >= 1")

    print(
        f"[{_now()}] Starting CP comparison reruns: "
        f"runs={args.run_start}..{args.run_end}, pool_workers={args.pool_workers}",
        flush=True,
    )

    for size_name, script_rel in SIZES:
        print(f"\n[{_now()}] ===== SIZE {size_name} START =====", flush=True)
        for run_idx in range(args.run_start, args.run_end + 1):
            print(f"[{_now()}] ----- SIZE {size_name} | RUN {run_idx} START -----", flush=True)
            rc = _run_size_phase(
                repo_root=repo_root,
                python_exe=args.python,
                size_name=size_name,
                script_rel=script_rel,
                run_idx=run_idx,
                pool_workers=args.pool_workers,
                binary=args.binary,
                verbose=args.verbose,
                dry_run=args.dry_run,
            )
            if rc != 0:
                return rc
            print(f"[{_now()}] ----- SIZE {size_name} | RUN {run_idx} DONE -----", flush=True)
        print(f"[{_now()}] ===== SIZE {size_name} DONE =====", flush=True)

    print(f"\n[{_now()}] All requested runs completed successfully.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
