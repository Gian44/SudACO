#!/usr/bin/env python3
"""Run benchmarks on logic-solvable Sudoku instances."""

import argparse
from datetime import datetime
from pathlib import Path

from bench_utils import (
    default_binary,
    run_logic,
    write_csv,
)


def main():
    ap = argparse.ArgumentParser(
        description='Run Sudoku ACO experiments on logic-solvable instances and export results.'
    )
    ap.add_argument('--binary', default=default_binary(), help='Path to solver binary (default: auto-detect)')
    ap.add_argument('--instances', default='instances', help='Instances root folder (default: instances)')
    ap.add_argument('--timeout', type=int, default=10, help='Per-run timeout seconds (default: 10)')
    ap.add_argument('--algs', default='0,1,2', help='Comma-separated list of alg ids to run (default: 0,1,2)')
    ap.add_argument('--reps_logic', type=int, default=100, help='Repetitions per instance (default: 100)')
    ap.add_argument(
        '--outdir',
        default='results/run_logic',
        help='Output directory (default: results/run_logic)'
    )
    ap.add_argument('--verbose', action='store_true', help='Print progress while running instances')
    args = ap.parse_args()

    binary = args.binary
    algs = [int(x.strip()) for x in args.algs.split(',') if x.strip() != '']
    logic_dir = Path(args.instances) / 'logic-solvable'

    def vlog(*a, **k):
        if args.verbose:
            print(*a, **k, flush=True)

    headers, rows = run_logic(algs, logic_dir, binary, args.timeout, args.reps_logic, vlog)
    outdir = Path(args.outdir)
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    outfile = outdir / f'logic-solvable_{timestamp}.csv'
    write_csv(outfile, headers, rows)
    print(f"Wrote: {outfile}")

if __name__ == '__main__':
    main()

