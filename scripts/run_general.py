#!/usr/bin/env python3
"""Run benchmarks on general Sudoku instances."""

import argparse
from datetime import datetime
from pathlib import Path

from bench_utils import default_binary, run_general, write_csv


def main():
    ap = argparse.ArgumentParser(
        description='Run Sudoku ACO experiments on general instances and export results.'
    )
    ap.add_argument('--binary', default=default_binary(), help='Path to solver binary (default: auto-detect)')
    ap.add_argument('--instances', default='instances', help='Instances root folder (default: instances)')
    ap.add_argument('--timeout', type=int, default=120, help='Per-run timeout seconds (default: 120)')
    ap.add_argument('--algs', default='0,1,2', help='Comma-separated list of alg ids to run (default: 0,1,2)')
    ap.add_argument(
        '--outdir',
        default='results/run_general',
        help='Output directory (default: results/run_general)'
    )
    ap.add_argument('--verbose', action='store_true', help='Print progress while running instances')
    args = ap.parse_args()

    binary = args.binary
    algs = [int(x.strip()) for x in args.algs.split(',') if x.strip() != '']
    gen_dir = Path(args.instances) / 'general'

    def vlog(*a, **k):
        if args.verbose:
            print(*a, **k, flush=True)

    headers, rows = run_general(algs, gen_dir, binary, args.timeout, vlog)
    outdir = Path(args.outdir)
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    outfile = outdir / f'general_{timestamp}.csv'
    write_csv(outfile, headers, rows)
    print(f"Wrote: {outfile}")

if __name__ == '__main__':
    main()

