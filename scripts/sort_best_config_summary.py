#!/usr/bin/env python3
"""
Rewrite a best_config_*_results_* CSV in **instance-folder order** (sorted ``*.txt`` paths).

Parallel pool benchmarks append summary rows as instances finish; this restores the same
ordering as ``run_ablation.sort_summary_csv_if_complete`` (used after ablation runs).

Examples (from repo root):

  python scripts/sort_best_config_summary.py --size 25x25
  python scripts/sort_best_config_summary.py --size 25x25 --remove-progress
  python scripts/sort_best_config_summary.py --results results/25x25/best_config_results_25x25_CP-DCM-ACO.csv
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT / 'scripts') not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / 'scripts'))

from run_ablation import sort_summary_csv_if_complete  # noqa: E402

import bench_pool_jobs  # noqa: E402

DEFAULT_RESULTS = {
    '9x9': REPO_ROOT / 'results/9x9/best_config_results_9x9_CP-DCM-ACO.csv',
    '16x16': REPO_ROOT / 'results/16x16/best_config_results_16x16_CP-DCM-ACO.csv',
    '25x25': REPO_ROOT / 'results/25x25/best_config_results_25x25_CP-DCM-ACO.csv',
}
INSTANCE_DIR = {
    '9x9': REPO_ROOT / 'instances/9x9',
    '16x16': REPO_ROOT / 'instances/16x16',
    '25x25': REPO_ROOT / 'instances/25x25',
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--size', choices=list(DEFAULT_RESULTS), help='Puzzle size (default paths)')
    ap.add_argument(
        '--results',
        type=Path,
        default=None,
        help='Summary CSV path (default: results/<size>/best_config_results_*_CP-DCM-ACO.csv)',
    )
    ap.add_argument(
        '--instances-dir',
        type=Path,
        default=None,
        help='Directory of *.txt puzzles (default: instances/<size>)',
    )
    ap.add_argument(
        '--remove-progress',
        action='store_true',
        help='Delete best_config_progress_* CSV when summary lists all instances (same check as pool cleanup)',
    )
    args = ap.parse_args()

    if args.results is not None:
        summary_path = Path(args.results)
        if not summary_path.is_file():
            print(f'ERROR: not a file: {summary_path}', file=sys.stderr)
            return 1
        inst_dir = args.instances_dir
        if inst_dir is None:
            print('ERROR: pass --instances-dir when using --results without --size', file=sys.stderr)
            return 1
        inst_dir = Path(inst_dir)
    else:
        if args.size is None:
            ap.error('pass --size or --results')
        summary_path = DEFAULT_RESULTS[args.size]
        inst_dir = args.instances_dir or INSTANCE_DIR[args.size]

    if not inst_dir.is_dir():
        print(f'ERROR: not a directory: {inst_dir}', file=sys.stderr)
        return 1

    canon = [p.name for p in sorted(inst_dir.glob('*.txt'))]
    if not canon:
        print(f'ERROR: no *.txt in {inst_dir}', file=sys.stderr)
        return 1

    sorted_ok = sort_summary_csv_if_complete(summary_path, canon)
    if sorted_ok:
        print(f'OK: rewrote {len(canon)} rows in instance order: {summary_path}')
    else:
        print(
            f'Note: summary not rewritten (missing file, wrong shape, or not exactly '
            f'{len(canon)} instances matching {inst_dir}).',
            file=sys.stderr,
        )

    if args.remove_progress:
        if '_results_' not in summary_path.name:
            print(
                'ERROR: --remove-progress expects *_results_* in the summary filename.',
                file=sys.stderr,
            )
            return 1
        progress_path = summary_path.parent / summary_path.name.replace(
            '_results_', '_progress_', 1
        )
        inst_paths = sorted(inst_dir.glob('*.txt'))
        if bench_pool_jobs.remove_best_config_progress_if_done(
            summary_path, progress_path, inst_paths
        ):
            return 0
        print(
            f'Progress not removed (summary instances must match all *.txt in {inst_dir}; '
            f'expected progress file {progress_path}).',
            file=sys.stderr,
        )
        return 3

    if not sorted_ok:
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
