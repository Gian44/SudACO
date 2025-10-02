#!/usr/bin/env python3
"""Run benchmarks on a filtered subset of general Sudoku instances."""

import argparse
from datetime import datetime
from pathlib import Path

from bench_utils import default_binary, run_general, write_csv


def parse_sizes(value):
    if value is None:
        return None
    sizes = [item.strip() for item in value.split(',') if item.strip()]
    return set(sizes) if sizes else None


def make_group_filter(size_set, frac_min, frac_max):
    if not size_set and frac_min is None and frac_max is None:
        return None

    def group_filter(size, frac):
        if size_set and size not in size_set:
            return False
        if frac_min is not None and frac < frac_min:
            return False
        if frac_max is not None and frac > frac_max:
            return False
        return True

    return group_filter


def make_file_filter(idx_min, idx_max):
    if idx_min is None and idx_max is None:
        return None

    def file_filter(size, frac, path):
        stem = path.stem
        parts = stem.split('_')
        if len(parts) < 3:
            return False
        try:
            idx = int(parts[2])
        except ValueError:
            return False
        if idx_min is not None and idx < idx_min:
            return False
        if idx_max is not None and idx > idx_max:
            return False
        return True

    return file_filter


def range_suffix(label, lo, hi):
    if lo is None and hi is None:
        return ''
    if lo is None:
        return f'_{label}max{hi}'
    if hi is None:
        return f'_{label}min{lo}'
    return f'_{label}{lo}-{hi}'



def main():
    ap = argparse.ArgumentParser(
        description='Run Sudoku ACO experiments on selected general instances and export results.'
    )
    ap.add_argument('--binary', default=default_binary(), help='Path to solver binary (default: auto-detect)')
    ap.add_argument('--instances', default='instances', help='Instances root folder (default: instances)')
    ap.add_argument('--timeout', type=int, default=120, help='Per-run timeout seconds (default: 120)')
    ap.add_argument('--algs', default='0,1,2', help='Comma-separated list of alg ids to run (default: 0,1,2)')
    ap.add_argument('--sizes', help='Comma-separated list of grid sizes to include (e.g. 25x25). Default: all sizes')
    ap.add_argument('--frac-min', type=int, help='Minimum filled-percentage filter (inclusive)')
    ap.add_argument('--frac-max', type=int, help='Maximum filled-percentage filter (inclusive)')
    ap.add_argument('--idx-min', type=int, help='Minimum instance index within each group (inclusive)')
    ap.add_argument('--idx-max', type=int, help='Maximum instance index within each group (inclusive)')
    ap.add_argument(
        '--outdir',
        default='results/run_general_subset',
        help='Output directory (default: results/run_general_subset)'
    )
    ap.add_argument('--verbose', action='store_true', help='Print progress while running instances')
    args = ap.parse_args()

    if args.frac_min is not None and args.frac_max is not None and args.frac_min > args.frac_max:
        ap.error('--frac-min must be <= --frac-max')
    if args.idx_min is not None and args.idx_max is not None and args.idx_min > args.idx_max:
        ap.error('--idx-min must be <= --idx-max')

    binary = args.binary
    algs = [int(x.strip()) for x in args.algs.split(',') if x.strip() != '']
    gen_dir = Path(args.instances) / 'general'
    size_set = parse_sizes(args.sizes)
    group_filter = make_group_filter(size_set, args.frac_min, args.frac_max)
    file_filter = make_file_filter(args.idx_min, args.idx_max)

    def vlog(*a, **k):
        if args.verbose:
            print(*a, **k, flush=True)

    headers, rows = run_general(
        algs,
        gen_dir,
        binary,
        args.timeout,
        vlog,
        group_filter=group_filter,
        file_filter=file_filter,
    )

    outdir = Path(args.outdir)
    suffix = 'general_subset'
    if size_set:
        suffix += '_' + '-'.join(sorted(size_set))
    suffix += range_suffix('frac', args.frac_min, args.frac_max)
    suffix += range_suffix('idx', args.idx_min, args.idx_max)
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    outfile = outdir / f'{suffix}_{timestamp}.csv'
    write_csv(outfile, headers, rows)
    if not rows:
        print('No matching instances were found; wrote header-only CSV.')
    print(f"Wrote: {outfile}")


if __name__ == '__main__':
    main()
