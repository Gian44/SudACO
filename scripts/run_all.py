#!/usr/bin/env python3
"""
Run benchmarks on all Sudoku instance sets (logic-solvable, general, 6x6, 12x12).

This script combines the functionality of run_logic.py and run_general.py to
run all instance sets in a single execution.
"""

import argparse
from datetime import datetime
from pathlib import Path

from bench_utils import (
    default_binary,
    run_logic,
    run_general,
)


def main():
    ap = argparse.ArgumentParser(
        description='Run Sudoku ACO experiments on all instance sets and export results.'
    )
    ap.add_argument('--binary', default=default_binary(), help='Path to solver binary (default: auto-detect)')
    ap.add_argument('--instances', default='instances', help='Instances root folder (default: instances)')
    ap.add_argument('--timeout', type=int, default=120, help='Per-run timeout seconds (default: 120)')
    ap.add_argument('--algs', default='0,1,2', help='Comma-separated list of alg ids to run (default: 0,1,2)')
    ap.add_argument('--reps_logic', type=int, default=100, help='Repetitions for logic-solvable instances (default: 100)')
    ap.add_argument(
        '--outdir',
        default='results/run_all',
        help='Output directory (default: results/run_all)'
    )
    ap.add_argument('--verbose', action='store_true', help='Print progress while running instances')
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
    algs = [int(x.strip()) for x in args.algs.split(',') if x.strip() != '']
    instances_root = Path(args.instances)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    def vlog(*a, **k):
        if args.verbose:
            print(*a, **k, flush=True)

    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
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


    # Single consolidated CSV output
    out_csv = outdir / f'all_{timestamp}.csv'
    out_csv.parent.mkdir(parents=True, exist_ok=True)

    # Helper to append a section with header and rows
    import csv
    def append_section(title: str, headers, rows):
        with open(out_csv, 'a', newline='') as f:
            w = csv.writer(f)
            w.writerow([title])
            if headers:
                w.writerow(headers)
            for r in rows:
                w.writerow(r)
            w.writerow([])  # blank line between sections

    # 1. Run logic-solvable instances
    logic_dir = instances_root / 'logic-solvable'
    if logic_dir.exists() and any(logic_dir.glob("*.txt")):
        vlog("\n" + "="*70)
        vlog("Running logic-solvable instances")
        vlog("="*70)
        headers, rows = run_logic(algs, logic_dir, binary, args.timeout, args.reps_logic, vlog, extra_args=factor_args)
        append_section("[logic-solvable]", headers, rows)
    else:
        vlog(f"Skipping logic-solvable: directory not found or empty")

    # Prepare a group filter to exclude 100% filled puzzles
    def exclude_100(size, frac):
        try:
            return int(frac) != 100
        except Exception:
            return True

    # Size-specific timeouts (match ablation study)
    TIMEOUT_MAP = {6: 3, 9: 5, 12: 10, 16: 20, 25: 120}

    def parse_size_to_int(size_str: str) -> int:
        try:
            if 'x' in size_str:
                return int(size_str.split('x', 1)[0])
            return int(size_str)
        except Exception:
            return 25  # safe default

    # 2. Run general instances (exclude 100%) with per-size timeouts
    gen_dir = instances_root / 'general'
    if gen_dir.exists() and any(gen_dir.glob("*.txt")):
        vlog("\n" + "="*70)
        vlog("Running general instances")
        vlog("="*70)
        # Iterate per size to apply appropriate timeouts
        sizes = ["9x9", "16x16", "25x25"]
        from bench_utils import scan_general_groups
        groups = scan_general_groups(gen_dir)
        seen_sizes = sorted({sz for (sz, _f) in groups.keys()})
        if seen_sizes:
            sizes = seen_sizes
        for size_str in sizes:
            size_int = parse_size_to_int(size_str)
            timeout = TIMEOUT_MAP.get(size_int, args.timeout)
            def gf(sz, frac, _s=size_str):
                return exclude_100(sz, frac) and (str(sz) == _s)
            headers, rows = run_general(algs, gen_dir, binary, timeout, vlog, group_filter=gf, extra_args=factor_args)
            append_section(f"[general size={size_str} timeout={timeout}s]", headers, rows)
    else:
        vlog(f"Skipping general: directory not found or empty")

    # 3. Run 6x6 instances (exclude 100%) with per-size timeouts
    dir_6x6 = instances_root / '6x6'
    if dir_6x6.exists() and any(dir_6x6.glob("*.txt")):
        vlog("\n" + "="*70)
        vlog("Running 6x6 instances")
        vlog("="*70)
        size_int = 6
        timeout = TIMEOUT_MAP.get(size_int, args.timeout)
        headers, rows = run_general(algs, dir_6x6, binary, timeout, vlog, group_filter=exclude_100, extra_args=factor_args)
        append_section(f"[6x6 timeout={timeout}s]", headers, rows)
    else:
        vlog(f"Skipping 6x6: directory not found or empty")

    # 4. Run 12x12 instances (exclude 100%) with per-size timeouts
    dir_12x12 = instances_root / '12x12'
    if dir_12x12.exists() and any(dir_12x12.glob("*.txt")):
        vlog("\n" + "="*70)
        vlog("Running 12x12 instances")
        vlog("="*70)
        size_int = 12
        timeout = TIMEOUT_MAP.get(size_int, args.timeout)
        headers, rows = run_general(algs, dir_12x12, binary, timeout, vlog, group_filter=exclude_100, extra_args=factor_args)
        append_section(f"[12x12 timeout={timeout}s]", headers, rows)
    else:
        vlog(f"Skipping 12x12: directory not found or empty")

    print(f"\nAll benchmarks completed. Consolidated results: {out_csv}")


if __name__ == '__main__':
    main()

