#!/usr/bin/env python3
"""
Run CP-ACS or CP-DCM-ACO tests on 16x16 Sudoku instances.

This script tests either:
- CP-ACS (algorithm 0)
- CP-DCM-ACO (algorithm 2)

On all 16x16 instances, running each instance 100 times (default, configurable via --reps).

Results are saved incrementally to a single CSV file per algorithm. The script
automatically resumes from where it stopped if the output file already exists.

Example usage:
  python scripts/run_16x16.py --alg 0 --verbose          # Run CP-ACS
  python scripts/run_16x16.py --alg 2 --verbose          # Run CP-DCM-ACO

Multiple runs (separate result files for run 1, 2, ... 5):
  python scripts/run_16x16.py --alg 0 --run 1 --verbose   # results_16x16_CP-ACS.csv (default)
  python scripts/run_16x16.py --alg 0 --run 2 --verbose   # results_16x16_CP-ACS_run2.csv
"""

import argparse
import csv
import math
import os
import time
from pathlib import Path

# Cross-platform file locking
try:
    import msvcrt  # Windows
    HAS_MSVCRT = True
except ImportError:
    HAS_MSVCRT = False
    try:
        import fcntl  # Unix/Linux/Mac
        HAS_FCNTL = True
    except ImportError:
        HAS_FCNTL = False

from bench_utils import (
    default_binary,
    run_solver,
    safe_mean,
    safe_std,
)


def lock_file(file_handle):
    """Lock a file handle for exclusive access (cross-platform)."""
    try:
        if HAS_MSVCRT:
            file_size = os.path.getsize(file_handle.name) if hasattr(file_handle, 'name') else 1
            msvcrt.locking(file_handle.fileno(), msvcrt.LK_LOCK, max(1, file_size))
        elif HAS_FCNTL:
            fcntl.flock(file_handle.fileno(), fcntl.LOCK_EX)
    except Exception:
        pass


def unlock_file(file_handle):
    """Unlock a file handle (cross-platform)."""
    try:
        if HAS_MSVCRT:
            file_size = os.path.getsize(file_handle.name) if hasattr(file_handle, 'name') else 1
            msvcrt.locking(file_handle.fileno(), msvcrt.LK_UNLCK, max(1, file_size))
        elif HAS_FCNTL:
            fcntl.flock(file_handle.fileno(), fcntl.LOCK_UN)
    except Exception:
        pass


def scan_instances(instances_dir):
    """Return a sorted list of instance files."""
    return sorted(Path(instances_dir).glob('*.txt'))

def _read_completed_instances_from_summary(outfile: Path):
    """Read completed instances from the summary CSV (one row per instance)."""
    completed = set()
    if not outfile.exists():
        return completed
    try:
        with open(outfile, 'r', newline='') as f:
            lock_file(f)
            reader = csv.DictReader(f)
            for row in reader:
                inst = row.get('instance')
                if inst:
                    completed.add(inst)
            unlock_file(f)
    except Exception:
        return set()
    return completed


def _read_progress(progress_file: Path):
    """Read per-rep progress.

    Returns:
        dict[str, dict[int, tuple[bool, float, float]]]
        mapping instance -> (rep_number -> (success, time, cycles))
    """
    prog = {}
    if not progress_file.exists():
        return prog
    try:
        with open(progress_file, 'r', newline='') as f:
            lock_file(f)
            reader = csv.DictReader(f)
            for row in reader:
                inst = row.get('instance')
                rep_s = row.get('rep')
                if not inst or not rep_s:
                    continue
                try:
                    rep = int(rep_s)
                except ValueError:
                    continue
                success = row.get('success', '').strip() in ('1', 'true', 'True')
                t = math.nan
                cyc = math.nan
                try:
                    if row.get('time', '').strip() != '':
                        t = float(row['time'])
                except Exception:
                    pass
                try:
                    if row.get('cycles', '').strip() != '':
                        cyc = float(row['cycles'])
                except Exception:
                    pass
                prog.setdefault(inst, {})[rep] = (success, t, cyc)
            unlock_file(f)
    except Exception:
        return {}
    return prog


def _ensure_csv_header(path: Path, headers):
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(headers)


def _append_csv_row(path: Path, row, vlog):
    max_retries = 10
    retry_delay = 0.1
    for attempt in range(max_retries):
        try:
            with open(path, 'a', newline='') as f:
                lock_file(f)
                writer = csv.writer(f)
                writer.writerow(row)
                unlock_file(f)
            return True
        except (IOError, OSError) as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
            else:
                vlog(f"  WARNING: Failed to write after {max_retries} attempts: {e}")
                return False


def main():
    ap = argparse.ArgumentParser(
        description='Run CP-ACS or CP-DCM-ACO tests on 16x16 Sudoku instances with 100 repetitions per instance. Automatically resumes from existing results.'
    )
    ap.add_argument('--alg', type=int, required=True, choices=[0, 2],
                    help='Algorithm to run: 0=CP-ACS, 2=CP-DCM-ACO')
    ap.add_argument('--binary', default=default_binary(), help='Path to solver binary (default: auto-detect)')
    ap.add_argument('--instances', default='instances/16x16', help='Instances folder (default: instances/16x16)')
    ap.add_argument('--timeout', type=int, default=20, help='Per-run timeout seconds (default: 20)')
    ap.add_argument('--outdir', default='results/16x16', help='Output directory (default: results/16x16)')
    ap.add_argument('--reps', type=int, default=100, help='Repetitions per instance (default: 100)')
    ap.add_argument('--run', type=int, default=1, help='Run index (1=default; 2+ use results_*_runN.csv for separate runs)')
    ap.add_argument('--verbose', action='store_true', help='Print progress while running instances')
    # Factor overrides (optional)
    ap.add_argument('--nAnts', type=int, help='Override nAnts (int)')
    ap.add_argument('--q0', type=float, help='Override q0 (float)')
    ap.add_argument('--rho', type=float, help='Override rho/p (float)')
    ap.add_argument('--evap', type=float, help='Override evap/BVE (float)')
    ap.add_argument('--numACS', type=int, help='Override numACS (int)')
    ap.add_argument('--convThresh', type=float, help='Override convThresh (float)')
    ap.add_argument('--entropyThreshold', type=float, help='Override entropyThreshold (float)')
    args = ap.parse_args()
    if args.run < 1:
        ap.error('--run must be >= 1')

    binary = args.binary
    instances_dir = Path(args.instances)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    alg_names = {0: 'CP-ACS', 2: 'CP-DCM-ACO'}
    alg_name = alg_names[args.alg]

    def vlog(*a, **k):
        if args.verbose:
            print(*a, **k, flush=True)

    # Output filenames: run 1 = legacy names; run 2+ = results_*_runN.csv
    run_suffix = f'_run{args.run}' if args.run > 1 else ''
    outfile = outdir / f'results_16x16_{alg_name}{run_suffix}.csv'
    progress_file = outdir / f'progress_16x16_{alg_name}{run_suffix}.csv'
    vlog(f"Output file: {outfile}")
    vlog(f"Progress file: {progress_file} (temporary; deleted when all instances complete)")

    # Read existing summary + per-rep progress
    completed_instances = _read_completed_instances_from_summary(outfile)
    progress = _read_progress(progress_file)
    if completed_instances:
        vlog(f"Auto-resuming: Found {len(completed_instances)} completed instance(s) in summary CSV")
    if progress:
        vlog(f"Auto-resuming: Found per-rep progress for {len(progress)} instance(s)")

    # Build extra factor args
    factor_args = []
    if args.nAnts is not None:
        factor_args += ['--nAnts', str(int(args.nAnts))]
    if args.q0 is not None:
        factor_args += ['--q0', str(float(args.q0))]
    if args.rho is not None:
        factor_args += ['--rho', str(float(args.rho))]
    if args.evap is not None:
        factor_args += ['--evap', str(float(args.evap))]
    if args.numACS is not None:
        num_acs = int(args.numACS)
        factor_args += ['--numACS', str(num_acs)]
        factor_args += ['--numColonies', str(num_acs + 1)]
    if args.convThresh is not None:
        factor_args += ['--convThresh', str(float(args.convThresh))]
    if args.entropyThreshold is not None:
        factor_args += ['--entropyThreshold', str(float(args.entropyThreshold))]

    # Scan instances
    instance_files = scan_instances(instances_dir)
    if not instance_files:
        print(f"Error: No instances found in {instances_dir}")
        return

    vlog(f"Found {len(instance_files)} instances in {instances_dir}")
    vlog(f"Running algorithm: {alg_name} (alg={args.alg})")
    vlog(f"Repetitions per instance: {args.reps}")

    # Summary CSV (one row per instance, only when all reps are finished)
    summary_headers = ['instance', 'alg', 'alg_name', 'success_%', 'time_mean', 'time_std', 'cycles_mean', 'cycles_std']
    _ensure_csv_header(outfile, summary_headers)

    # Progress CSV (one row per rep)
    progress_headers = ['instance', 'alg', 'alg_name', 'rep', 'success', 'time', 'cycles']
    _ensure_csv_header(progress_file, progress_headers)

    # Process each instance
    total_instances = len(instance_files)
    for idx, fp in enumerate(instance_files, start=1):
        # Skip if already completed in summary
        if fp.name in completed_instances:
            vlog(f"[{idx}/{total_instances}] {fp.name} [SKIPPED - already completed]")
            continue

        rep_map = progress.get(fp.name, {})
        done_reps = set(rep_map.keys())

        successes = 0
        times = []
        cycles_solved = []
        for _rep, (succ, t, cyc) in sorted(rep_map.items()):
            if succ:
                successes += 1
                times.append(t)
                if not math.isnan(cyc):
                    cycles_solved.append(cyc)

        if done_reps:
            vlog(f"[{idx}/{total_instances}] {fp.name} [RESUME reps={len(done_reps)}/{args.reps}]")
        else:
            vlog(f"[{idx}/{total_instances}] {fp.name}")

        for rep in range(1, args.reps + 1):
            if rep in done_reps:
                continue
            if args.verbose and rep % 10 == 0:
                vlog(f"  Rep {rep}/{args.reps}")

            success, t, cyc, out = run_solver(binary, fp, args.alg, args.timeout, extra_args=factor_args)

            progress_row = [
                fp.name,
                args.alg,
                alg_name,
                rep,
                1 if success else 0,
                '' if math.isnan(t) else t,
                '' if math.isnan(cyc) else cyc,
            ]
            if not _append_csv_row(progress_file, progress_row, vlog):
                vlog("  ERROR: Could not write progress row; continuing anyway.")

            rep_map[rep] = (success, t, cyc)
            done_reps.add(rep)
            if success:
                successes += 1
                times.append(t)
                if not math.isnan(cyc):
                    cycles_solved.append(cyc)

        if len(done_reps) < args.reps:
            vlog(f"  => partial progress saved ({len(done_reps)}/{args.reps} reps).")
            progress[fp.name] = rep_map
            continue

        succ_pct = (successes / float(args.reps)) * 100.0
        time_mean = safe_mean(times)
        time_std = safe_std(times)
        cycles_mean = safe_mean(cycles_solved)
        cycles_std = safe_std(cycles_solved)

        summary_row = [
            fp.name,
            args.alg,
            alg_name,
            round(succ_pct, 2),
            round(time_mean, 6) if not math.isnan(time_mean) else '',
            round(time_std, 6) if not math.isnan(time_std) else '',
            round(cycles_mean, 3) if not math.isnan(cycles_mean) else '',
            round(cycles_std, 3) if not math.isnan(cycles_std) else '',
        ]

        written = _append_csv_row(outfile, summary_row, vlog)
        if written:
            completed_instances.add(fp.name)
        else:
            vlog(f"  ERROR: Could not write result to CSV file!")

        vlog(
            f"  => success%={round(succ_pct, 2)} "
            f"time_mean={round(time_mean, 6) if not math.isnan(time_mean) else 'N/A'} "
            f"cycles_mean={round(cycles_mean, 3) if not math.isnan(cycles_mean) else 'N/A'} "
            f"[Saved]"
        )
        progress[fp.name] = rep_map

    # Delete progress file when fully done (no longer needed)
    if len(completed_instances) == total_instances and progress_file.exists():
        try:
            progress_file.unlink()
            print(f"Progress file removed: {progress_file}")
        except OSError as e:
            print(f"Could not remove progress file: {e}")

    # Summary
    print(f"\n{'='*70}")
    print(f"Completed. Results saved to: {outfile}")
    print(f"Total instances: {total_instances}")
    print(f"Completed: {len(completed_instances)}/{total_instances}")
    if len(completed_instances) < total_instances:
        print(f"Remaining: {total_instances - len(completed_instances)}")
        print("To resume, run the script again with the same parameters (it will pick up from the last completed rep).")
    print(f"{'='*70}")


if __name__ == '__main__':
    main()
