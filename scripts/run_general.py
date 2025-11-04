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
    ap.add_argument('--timeout', type=int, default=120, help='Fallback timeout seconds (default: 120). Size-specific timeouts are used by default.')
    ap.add_argument('--per_size_timeouts', action='store_true', default=True, help='Use size-specific timeouts (default: on)')
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

    outdir = Path(args.outdir)
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')

    if not args.per_size_timeouts:
        headers, rows = run_general(algs, gen_dir, binary, args.timeout, vlog)
        outfile = outdir / f'general_{timestamp}.csv'
        write_csv(outfile, headers, rows)
        print(f"Wrote: {outfile}")
    else:
        # Size-specific timeouts
        TIMEOUT_MAP = {6: 3, 9: 5, 12: 10, 16: 20, 25: 120}
        from bench_utils import scan_general_groups
        groups = scan_general_groups(gen_dir)
        seen_sizes = sorted({sz for (sz, _f) in groups.keys()})

        def size_to_int(sz):
            try:
                return int(sz.split('x', 1)[0]) if 'x' in sz else int(sz)
            except Exception:
                return None

        for size_str in seen_sizes:
            size_int = size_to_int(size_str)
            if not size_int:
                continue
            timeout = TIMEOUT_MAP.get(size_int, args.timeout)
            def gf(sz, frac, _s=size_str):
                return (str(sz) == _s)
            headers, rows = run_general(algs, gen_dir, binary, timeout, vlog, group_filter=gf)
            outfile = outdir / f'general_{size_int}x{size_int}_{timestamp}.csv'
            write_csv(outfile, headers, rows)
            print(f"Wrote: {outfile}")

if __name__ == '__main__':
    main()

