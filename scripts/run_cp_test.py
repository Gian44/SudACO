#!/usr/bin/env python3
"""
Run CP-ACO and CP-DCM-ACO tests on 25x25 instances with 40-50% fill.

This script tests:
- CP-ACO (algorithm 0, ACS)
- CP-DCM-ACO (algorithm 2, DCM-ACO)

On 25x25 instances with fill percentages between 40-50%, running each
instance 10 times per algorithm per F% (default, configurable via --reps).

Parallel Execution:
This script supports running multiple instances in parallel across different
terminals. All instances write to the same CSV file safely using file locking.

Example parallel execution:
  Terminal 1: python scripts/run_cp_test.py --alg 0 --frac-min 45 --frac-max 50 --resume results/run_cp_test/cp_test_25x25_40-50pct_20260123-133410.csv
  Terminal 2: python scripts/run_cp_test.py --alg 2 --resume results/run_cp_test/cp_test_25x25_40-50pct_20260123-133410.csv

The script automatically skips already completed tests and refreshes the
completed list periodically to see progress from other terminals.
"""

import argparse
import csv
import math
import os
import time
import sys
from datetime import datetime
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
    scan_general_groups,
    safe_mean,
    safe_std,
    write_csv,
)


def lock_file(file_handle):
    """Lock a file handle for exclusive access (cross-platform)."""
    try:
        if HAS_MSVCRT:
            # Windows - lock the entire file
            file_size = os.path.getsize(file_handle.name) if hasattr(file_handle, 'name') else 1
            msvcrt.locking(file_handle.fileno(), msvcrt.LK_LOCK, max(1, file_size))
        elif HAS_FCNTL:
            # Unix/Linux/Mac
            fcntl.flock(file_handle.fileno(), fcntl.LOCK_EX)
    except Exception:
        # If locking fails, proceed anyway (better than crashing)
        pass


def unlock_file(file_handle):
    """Unlock a file handle (cross-platform)."""
    try:
        if HAS_MSVCRT:
            # Windows
            file_size = os.path.getsize(file_handle.name) if hasattr(file_handle, 'name') else 1
            msvcrt.locking(file_handle.fileno(), msvcrt.LK_UNLCK, max(1, file_size))
        elif HAS_FCNTL:
            # Unix/Linux/Mac
            fcntl.flock(file_handle.fileno(), fcntl.LOCK_UN)
    except Exception:
        # If unlocking fails, ignore
        pass


def sort_csv_file(csv_path):
    """Sort CSV file by algorithm (CP-ACO first, then CP-DCM-ACO), then by F%, then by instance name."""
    if not csv_path.exists():
        return
    
    max_retries = 10
    retry_delay = 0.1
    
    for attempt in range(max_retries):
        try:
            # Read all rows
            with open(csv_path, 'r', newline='') as f:
                lock_file(f)
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                rows = list(reader)
                unlock_file(f)
            
            if not rows:
                return  # Empty file, nothing to sort
            
            # Sort: first by alg (0 before 2), then by F%, then by instance name
            def sort_key(row):
                alg = int(row.get('alg', 999))
                frac = int(row.get('F%', 999))
                instance = row.get('instance', '')
                return (alg, frac, instance)
            
            rows_sorted = sorted(rows, key=sort_key)
            
            # Write back sorted rows
            with open(csv_path, 'w', newline='') as f:
                lock_file(f)
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows_sorted)
                unlock_file(f)
            
            return  # Success
        except (IOError, OSError) as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
            else:
                print(f"Warning: Could not sort CSV file after {max_retries} attempts: {e}")
                return


def main():
    ap = argparse.ArgumentParser(
        description='Run CP-ACO and CP-DCM-ACO tests on 25x25 instances (40-50% fill) with 10 repetitions per instance (default).'
    )
    ap.add_argument('--binary', default=default_binary(), help='Path to solver binary (default: auto-detect)')
    ap.add_argument('--instances', default='instances', help='Instances root folder (default: instances)')
    ap.add_argument('--timeout', type=int, default=120, help='Per-run timeout seconds (default: 120)')
    ap.add_argument(
        '--outdir',
        default='results/run_cp_test',
        help='Output directory (default: results/run_cp_test)'
    )
    ap.add_argument('--reps', type=int, default=10, help='Repetitions per instance (default: 10)')
    ap.add_argument('--verbose', action='store_true', help='Print progress while running instances')
    ap.add_argument('--resume', help='Resume from existing CSV file (default: auto-detect or create new)')
    ap.add_argument('--no-resume', action='store_true', help='Force creating a new file (ignore existing)')
    ap.add_argument('--alg', type=int, help='Run only specific algorithm (0=CP-ACO, 2=CP-DCM-ACO). Default: run both.')
    ap.add_argument('--frac-min', type=int, help='Minimum F% to process (inclusive, default: 40)')
    ap.add_argument('--frac-max', type=int, help='Maximum F% to process (inclusive, default: 50)')
    # Factor overrides (optional). If omitted, solver defaults (C++) are used.
    ap.add_argument('--nAnts', type=int, help='Override nAnts (int)')
    ap.add_argument('--q0', type=float, help='Override q0 (float)')
    ap.add_argument('--rho', type=float, help='Override rho/p (float)')
    ap.add_argument('--evap', type=float, help='Override evap/BVE (float)')
    ap.add_argument('--numACS', type=int, help='Override numACS (int). numColonies will be set to numACS+1')
    ap.add_argument('--convThresh', type=float, help='Override convThresh (float)')
    ap.add_argument('--entropyThreshold', type=float, help='Override entropyThreshold (float)')
    ap.add_argument('--useACSOnly', action='store_true', help='Use homogeneous ACS-only ablation mode (default: False, uses MMAS)')
    args = ap.parse_args()

    binary = args.binary
    instances_root = Path(args.instances)
    gen_dir = instances_root / 'general'
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    def vlog(*a, **k):
        if args.verbose:
            print(*a, **k, flush=True)

    # Determine output filename (use fixed name for resuming, or timestamped for new runs)
    if args.resume:
        outfile = Path(args.resume)
        if not outfile.is_absolute():
            # Resolve relative path from current working directory (not from outdir)
            # This allows users to specify paths like "results/run_cp_test/file.csv"
            outfile = Path.cwd() / args.resume
        resume_mode = True
        vlog(f"Resuming from existing file: {outfile}")
    elif args.no_resume:
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        outfile = outdir / f'cp_test_25x25_40-50pct_{timestamp}.csv'
        resume_mode = False
    else:
        # Auto-detect: look for existing file with standard name pattern
        existing_files = sorted(outdir.glob('cp_test_25x25_40-50pct_*.csv'))
        if existing_files:
            outfile = existing_files[-1]  # Use most recent
            resume_mode = True
            vlog(f"Auto-detected existing file: {outfile}")
        else:
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            outfile = outdir / f'cp_test_25x25_40-50pct_{timestamp}.csv'
            resume_mode = False
    
    # Read existing results if resuming (with file locking for concurrent access)
    completed_tests = set()  # (alg, instance_filename) tuples
    if resume_mode and outfile.exists():
        try:
            with open(outfile, 'r', newline='') as f:
                lock_file(f)
                reader = csv.DictReader(f)
                for row in reader:
                    alg = int(row['alg'])
                    instance = row['instance']
                    completed_tests.add((alg, instance))
                unlock_file(f)
            vlog(f"Found {len(completed_tests)} already completed test(s)")
        except Exception as e:
            vlog(f"Warning: Could not read existing file: {e}. Starting fresh.")
            completed_tests = set()
            resume_mode = False
    
    # Build extra factor args to pass to the solver (only if provided).
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
        # Enforce exactly one MMAS colony by setting numColonies=numACS+1
        factor_args += ['--numColonies', str(num_acs + 1)]
    if args.convThresh is not None:
        factor_args += ['--convThresh', str(float(args.convThresh))]
    if args.entropyThreshold is not None:
        factor_args += ['--entropyThreshold', str(float(args.entropyThreshold))]
    if args.useACSOnly:
        factor_args += ['--useACSOnly']

    # Algorithms to test: CP-ACO (0) and CP-DCM-ACO (2)
    alg_names = {0: 'CP-ACO', 2: 'CP-DCM-ACO'}
    if args.alg is not None:
        if args.alg not in alg_names:
            print(f"Error: Invalid algorithm {args.alg}. Must be 0 (CP-ACO) or 2 (CP-DCM-ACO).")
            return
        algs = [args.alg]
        vlog(f"Running only algorithm {args.alg} ({alg_names[args.alg]})")
    else:
        algs = [0, 2]
        vlog(f"Running both algorithms: {algs}")

    # Filter for 25x25 instances with 40-50% fill
    groups = scan_general_groups(gen_dir)
    
    # Filter groups: size must be 25x25, F% must be in specified range
    frac_min = args.frac_min if args.frac_min is not None else 40
    frac_max = args.frac_max if args.frac_max is not None else 50
    filtered_groups = {}
    for (size, frac), files in groups.items():
        if size == '25x25' and frac is not None and frac_min <= frac <= frac_max:
            filtered_groups[(size, frac)] = files
    
    if args.frac_min is not None or args.frac_max is not None:
        vlog(f"Filtering F% range: {frac_min}-{frac_max}%")

    if not filtered_groups:
        print(f"Warning: No 25x25 instances with 40-50% fill found in {gen_dir}")
        return

    vlog(f"Found {len(filtered_groups)} F% groups for 25x25 instances (40-50%)")
    for (size, frac), files in sorted(filtered_groups.items()):
        vlog(f"  F%={frac}: {len(files)} instances")

    # Prepare CSV output
    headers = ['alg', 'alg_name', 'instance', 'F%', 'success_%', 'time_mean', 'time_std', 'cycles_mean', 'cycles_std']
    
    # Initialize CSV file if it doesn't exist
    file_exists = outfile.exists() and resume_mode
    if not file_exists:
        with open(outfile, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
        vlog(f"Created new output file: {outfile}")
    else:
        vlog(f"Appending to existing file: {outfile}")

    # Run tests for each algorithm
    for alg in algs:
        alg_name = alg_names[alg]
        vlog(f"\n{'='*70}")
        vlog(f"Testing {alg_name} (algorithm {alg})")
        vlog(f"{'='*70}")

        # Process each F% group
        for (size, frac), files in sorted(filtered_groups.items()):
            vlog(f"\nF%={frac}: Processing {len(files)} instances")
            
            # Process each instance
            for instance_idx, fp in enumerate(sorted(files), start=1):
                # Check if this test is already completed (refresh from file periodically)
                test_key = (alg, fp.name)
                
                # Refresh completed_tests from file every few instances to see other processes' progress
                if instance_idx % 5 == 1 and resume_mode and outfile.exists():
                    try:
                        with open(outfile, 'r', newline='') as f:
                            lock_file(f)
                            reader = csv.DictReader(f)
                            new_completed = set()
                            for row in reader:
                                a = int(row['alg'])
                                inst = row['instance']
                                new_completed.add((a, inst))
                            completed_tests.update(new_completed)  # Merge with existing
                            unlock_file(f)
                    except Exception:
                        pass  # Ignore errors during refresh
                
                if test_key in completed_tests:
                    vlog(f"  Instance {instance_idx}/{len(files)}: {fp.name} [SKIPPED - already completed]")
                    continue
                
                vlog(f"  Instance {instance_idx}/{len(files)}: {fp.name}")
                
                successes = 0
                times = []
                cycles_solved = []
                
                # Run repetitions per instance
                for rep in range(args.reps):
                    if args.verbose and (rep + 1) % 10 == 0:
                        vlog(f"    Rep {rep + 1}/{args.reps}")
                    
                    success, t, cyc, out = run_solver(
                        binary, fp, alg, args.timeout, extra_args=factor_args
                    )
                    
                    if success:
                        successes += 1
                        times.append(t)
                        if not math.isnan(cyc):
                            cycles_solved.append(cyc)
                
                # Calculate statistics
                succ_pct = (successes / float(args.reps)) * 100.0
                time_mean = safe_mean(times)
                time_std = safe_std(times)
                cycles_mean = safe_mean(cycles_solved)
                cycles_std = safe_std(cycles_solved)
                
                # Prepare row data
                row = [
                    alg,
                    alg_name,
                    fp.name,
                    frac,
                    round(succ_pct, 2),
                    round(time_mean, 6) if not math.isnan(time_mean) else '',
                    round(time_std, 6) if not math.isnan(time_std) else '',
                    round(cycles_mean, 3) if not math.isnan(cycles_mean) else '',
                    round(cycles_std, 3) if not math.isnan(cycles_std) else '',
                ]
                
                # Write immediately to CSV (append mode with file locking for concurrent access)
                max_retries = 10
                retry_delay = 0.1
                written = False
                for attempt in range(max_retries):
                    try:
                        with open(outfile, 'a', newline='') as f:
                            lock_file(f)  # Lock file for exclusive write access
                            writer = csv.writer(f)
                            writer.writerow(row)
                            unlock_file(f)  # Unlock file
                            written = True
                            break
                    except (IOError, OSError) as e:
                        if attempt < max_retries - 1:
                            time.sleep(retry_delay * (attempt + 1))  # Exponential backoff
                        else:
                            vlog(f"    WARNING: Failed to write after {max_retries} attempts: {e}")
                
                if written:
                    # Mark as completed
                    completed_tests.add(test_key)
                else:
                    vlog(f"    ERROR: Could not write result to CSV file!")
                
                vlog(
                    f"    => success%={round(succ_pct,2)} "
                    f"time_mean={round(time_mean,6) if not math.isnan(time_mean) else 'N/A'} "
                    f"time_std={round(time_std,6) if not math.isnan(time_std) else 'N/A'} "
                    f"cycles_mean={round(cycles_mean,3) if not math.isnan(cycles_mean) else 'N/A'} "
                    f"[Saved to CSV]"
                )

    # Calculate summary statistics
    total_instances = sum(len(files) for files in filtered_groups.values())
    total_tests = total_instances * len(algs)
    completed_count = len(completed_tests)
    
    # Sort the CSV file: CP-ACO (alg 0) first, then CP-DCM-ACO (alg 2)
    vlog("\nSorting results by algorithm (CP-ACO first, then CP-DCM-ACO)...")
    sort_csv_file(outfile)
    vlog("Results sorted successfully.")
    
    print(f"\n{'='*70}")
    print(f"Test session completed. Results saved to: {outfile}")
    print(f"Total instances: {total_instances}")
    print(f"Total test combinations (instances × algorithms): {total_tests}")
    print(f"Completed: {completed_count}/{total_tests}")
    if completed_count < total_tests:
        print(f"Remaining: {total_tests - completed_count}")
        print(f"\nTo resume, run the script again with the same parameters.")
    print(f"Results have been sorted: CP-ACO (alg 0) appears first, followed by CP-DCM-ACO (alg 2).")
    print(f"{'='*70}")


if __name__ == '__main__':
    main()
