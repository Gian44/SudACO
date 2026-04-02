#!/usr/bin/env python3
"""
Compare ACO (algorithm 0) vs CP-DCM-ACO (algorithm 2) at multiple wall-clock timeouts.

Hyperparameters come from ``results/ablation/best_config.json``, written when you run
``python scripts/run_ablation.py --consolidate`` (per-parameter winners pooled across all
puzzle sizes in the ablation). The same CLI args are passed
to both algorithms; unused DCM-only flags are ignored by the single-colony ACO binary.

Outputs (default ``results/timeout_algo_comparison``):
  alg_<id>/<timeout>_<size>_summary.csv — same row schema as ablation summaries
  timeout_comparison.xlsx — aggregated sheet per puzzle size (after consolidation)
  results/ablation/ablation_results.xlsx — updated with timeout tables:
    - ACO table
    - CP-DCM-ACO table
    - consolidated timeout summary (CSV-like columns)

Parallel mode:
  --workers-per-alg 4
    Runs both algorithms simultaneously with 4 shard workers each
    (8 Python processes per (size, timeout) phase), with resume-safe progress CSVs.

  pip install openpyxl
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from bench_utils import default_binary, run_solver, safe_mean, safe_std  # noqa: E402

from scripts.run_ablation import (  # noqa: E402
    DEFAULTS,
    PROGRESS_HEADERS,
    SIZE_CONFIGS,
    SUMMARY_HEADERS,
    append_csv_row,
    build_solver_args_from_full_config,
    delete_ablation_progress_if_summary_done,
    ensure_csv_header,
    format_param_value,
    read_completed_from_summary,
    read_progress,
    scan_instances,
    sort_summary_csv_if_complete,
)

DEFAULT_OUTDIR = Path('results') / 'timeout_algo_comparison'
DEFAULT_BEST_CONFIG = Path('results') / 'ablation' / 'best_config.json'
DEFAULT_EXCEL = DEFAULT_OUTDIR / 'timeout_comparison.xlsx'
DEFAULT_ABLATION_EXCEL = Path('results') / 'ablation' / 'ablation_results.xlsx'

# Wall-clock timeouts (seconds) to compare; same grid as the former ablation timeout sweep.
TIMEOUTS_PER_SIZE = OrderedDict([
    ('9x9', [1, 3, 7, 9]),
    ('16x16', [10, 15, 25, 30]),
    ('25x25', [60, 90, 150, 180]),
])

ALGORITHMS = (
    (0, 'ACO'),
    (2, 'CP-DCM-ACO'),
)

SIZE_SHORT = {'9x9': '9', '16x16': '16', '25x25': '25'}
SIZE_SORT = {'9x9': 0, '16x16': 1, '25x25': 2}


def load_best_config(path: Path) -> dict:
    """
    Return ``{ '9x9': cfg, '16x16': cfg, '25x25': cfg }`` with the same hyperparameters
    for every size (from a flat ``best_config.json``). Legacy per-size JSON is still
    accepted if top-level keys are puzzle sizes.
    """
    if not path.exists():
        raise SystemExit(
            f'Missing {path}. Run: python scripts/run_ablation.py --consolidate'
        )
    with open(path, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    def merged_cfg(update: dict) -> dict:
        m = dict(DEFAULTS)
        m.update(update)
        return m

    # Legacy: {"9x9": {...}, "16x16": {...}, ...}
    if any(k in SIZE_CONFIGS for k in raw):
        out = {}
        for size, cfg in raw.items():
            if size not in SIZE_CONFIGS:
                continue
            out[size] = merged_cfg(cfg if isinstance(cfg, dict) else {})
        for size in SIZE_CONFIGS:
            if size not in out:
                out[size] = dict(DEFAULTS)
        return out

    # Current: flat {"nAnts": 5, ...}
    single = merged_cfg(raw)
    return {sz: dict(single) for sz in SIZE_CONFIGS}


def run_timeout_job(
    binary,
    alg: int,
    alg_name: str,
    timeout_sec: int,
    size_name: str,
    size_cfg: dict,
    extra_args: list,
    reps: int,
    outdir: Path,
    vlog,
    worker_id: int = 0,
    num_workers: int = 1,
):
    """One (algorithm, timeout, size) matrix; param_value column stores timeout for traceability."""
    val_str = format_param_value('timeout', timeout_sec)
    tag = f'alg{alg} timeout={val_str}s [{size_name}]'

    sub = outdir / f'alg_{alg}'
    sub.mkdir(parents=True, exist_ok=True)

    progress_file = sub / f'{val_str}_{size_name}_progress.csv'
    summary_file = sub / f'{val_str}_{size_name}_summary.csv'
    timeout = int(timeout_sec)

    instances_all = scan_instances(size_cfg['dir'])
    if not instances_all:
        vlog(f'  No instances in {size_cfg["dir"]}')
        return

    all_instance_names = {fp.name for fp in instances_all}
    num_workers = max(1, int(num_workers))
    worker_id = int(worker_id) % num_workers
    instances = [
        fp for i, fp in enumerate(instances_all)
        if (i % num_workers) == worker_id
    ]
    if not instances:
        vlog(f'  Worker {worker_id}/{num_workers} has no instances')
        return

    completed = read_completed_from_summary(summary_file)
    completed_overall = len(completed.intersection(all_instance_names))
    if completed_overall == len(instances_all):
        sort_summary_csv_if_complete(summary_file, [fp.name for fp in instances_all])
        delete_ablation_progress_if_summary_done(
            progress_file, summary_file, all_instance_names, vlog, tag)
        vlog(f'  [{tag}] Already complete. Skipping.')
        return

    progress = read_progress(progress_file)
    ensure_csv_header(summary_file, SUMMARY_HEADERS)
    ensure_csv_header(progress_file, PROGRESS_HEADERS)

    subset_names = {fp.name for fp in instances}
    completed_in_subset = completed.intersection(subset_names)
    total = len(instances)

    if completed_in_subset:
        vlog(f'  [{tag}] Worker {worker_id}/{num_workers} resuming '
             f'{len(completed_in_subset)}/{total} instances')

    for idx, fp in enumerate(instances, 1):
        if fp.name in completed:
            continue

        rep_map = progress.get(fp.name, {})
        done_reps = set(rep_map.keys())

        successes = 0
        times = []
        cycles_solved = []
        for _r, (succ, t, cyc) in sorted(rep_map.items()):
            if succ:
                successes += 1
                times.append(t)
                if not math.isnan(cyc):
                    cycles_solved.append(cyc)

        status = f'RESUME {len(done_reps)}/{reps}' if done_reps else ''
        vlog(f'  [{tag}] ({idx}/{total}) {fp.name} {status}')

        for rep in range(1, reps + 1):
            if rep in done_reps:
                continue

            success, t, cyc, out = run_solver(
                binary, fp, alg, timeout, extra_args=extra_args)

            status_str = 'OK' if success else 'FAIL'
            t_str = f'{t:.4f}s' if not math.isnan(t) else 'N/A'
            vlog(f'    Rep {rep}/{reps}: {status_str} (time={t_str})')

            prog_row = [fp.name, rep, 1 if success else 0,
                        '' if math.isnan(t) else t,
                        '' if math.isnan(cyc) else cyc]
            append_csv_row(progress_file, prog_row)

            rep_map[rep] = (success, t, cyc)
            done_reps.add(rep)
            if success:
                successes += 1
                times.append(t)
                if not math.isnan(cyc):
                    cycles_solved.append(cyc)

        if len(done_reps) < reps:
            vlog(f'    => partial ({len(done_reps)}/{reps})')
            progress[fp.name] = rep_map
            continue

        succ_pct = (successes / float(reps)) * 100.0
        tm = safe_mean(times)
        ts = safe_std(times)
        cm = safe_mean(cycles_solved)
        cs = safe_std(cycles_solved)

        row = [
            timeout_sec, size_name, fp.name,
            alg, alg_name,
            round(succ_pct, 2),
            round(tm, 6) if not math.isnan(tm) else '',
            round(ts, 6) if not math.isnan(ts) else '',
            round(cm, 3) if not math.isnan(cm) else '',
            round(cs, 3) if not math.isnan(cs) else '',
        ]

        if append_csv_row(summary_file, row):
            completed.add(fp.name)
            completed_now = read_completed_from_summary(summary_file)
            if all_instance_names <= completed_now:
                sort_summary_csv_if_complete(summary_file, [p.name for p in instances_all])
                delete_ablation_progress_if_summary_done(
                    progress_file, summary_file, all_instance_names, vlog, tag)
        else:
            vlog(f'    ERROR: could not write summary for {fp.name}')

        progress[fp.name] = rep_map

    delete_ablation_progress_if_summary_done(
        progress_file, summary_file, all_instance_names, vlog, tag)


def collect_timeout_aggregates(outdir: Path):
    """
    Aggregate summary CSVs into rows per (timeout, puzzle_size, algorithm).
    """
    rows_agg = []
    for alg_id, alg_name in ALGORITHMS:
        sub = outdir / f'alg_{alg_id}'
        if not sub.exists():
            continue
        for csv_file in sorted(sub.glob('*_summary.csv')):
            base = csv_file.name[:-len('_summary.csv')]
            try:
                timeout_part_s, size_name = base.split('_', 1)
                timeout_part = int(float(timeout_part_s))
            except Exception:
                continue
            if size_name not in SIZE_CONFIGS:
                continue

            succ_vals = []
            tmean_vals = []
            tstd_vals = []
            cmean_vals = []
            cstd_vals = []
            try:
                with open(csv_file, 'r', newline='') as f:
                    for row in csv.DictReader(f):
                        try:
                            succ_vals.append(float(row.get('success_%') or 'nan'))
                        except Exception:
                            succ_vals.append(float('nan'))
                        try:
                            tmean_vals.append(float(row.get('time_mean') or 'nan'))
                        except Exception:
                            tmean_vals.append(float('nan'))
                        try:
                            tstd_vals.append(float(row.get('time_std') or 'nan'))
                        except Exception:
                            tstd_vals.append(float('nan'))
                        try:
                            cmean_vals.append(float(row.get('cycles_mean') or 'nan'))
                        except Exception:
                            cmean_vals.append(float('nan'))
                        try:
                            cstd_vals.append(float(row.get('cycles_std') or 'nan'))
                        except Exception:
                            cstd_vals.append(float('nan'))
            except Exception:
                continue

            if not succ_vals:
                continue

            rows_agg.append({
                'timeout_s': timeout_part,
                'puzzle_size': size_name,
                'alg': alg_id,
                'alg_name': alg_name,
                'instances': len(succ_vals),
                'success_mean': safe_mean(succ_vals),
                'time_mean_mean': safe_mean(tmean_vals),
                'time_std_mean': safe_mean(tstd_vals),
                'cycles_mean_mean': safe_mean(cmean_vals),
                'cycles_std_mean': safe_mean(cstd_vals),
            })

    rows_agg.sort(key=lambda r: (SIZE_SORT.get(r['puzzle_size'], 99), r['timeout_s'], r['alg']))
    return rows_agg


def _write_sheet_table(ws, row_idx, title, headers, rows, header_font, header_fill, thin_border):
    ws.cell(row=row_idx, column=1, value=title).font = header_font
    row_idx += 1
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=row_idx, column=c, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = thin_border
    row_idx += 1
    for r in rows:
        for c, v in enumerate(r, 1):
            cell = ws.cell(row=row_idx, column=c, value=v)
            cell.border = thin_border
        row_idx += 1
    return row_idx + 1


def consolidate_timeout_excel(outdir: Path, excel_path: Path) -> bool:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Border, Side
    except ImportError:
        print('ERROR: openpyxl required. pip install openpyxl')
        return False

    rows_agg = collect_timeout_aggregates(outdir)
    if not rows_agg:
        print('No timeout comparison summaries found to consolidate.')
        return False

    wb = Workbook()
    wb.remove(wb.active)
    header_font = Font(bold=True)
    header_fill = PatternFill(start_color='D9E1F2', end_color='D9E1F2', fill_type='solid')
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin'))

    for size_name in SIZE_CONFIGS:
        size_rows = [r for r in rows_agg if r['puzzle_size'] == size_name]
        if not size_rows:
            continue
        title = f'Timeout cmp {size_name}'[:31]
        ws = wb.create_sheet(title=title)
        headers = [
            'Timeout (s)', 'Algorithm ID', 'Algorithm',
            'Instances', 'Mean success %', 'Mean time (s)',
        ]
        for c, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=c, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
        for r_idx, r in enumerate(size_rows, 2):
            vals = [
                r['timeout_s'], r['alg'], r['alg_name'],
                r['instances'],
                round(r['success_mean'], 5) if not math.isnan(r['success_mean']) else '',
                round(r['time_mean_mean'], 5) if not math.isnan(r['time_mean_mean']) else '',
            ]
            for c, v in enumerate(vals, 1):
                cell = ws.cell(row=r_idx, column=c, value=v)
                cell.border = thin_border
        ws.freeze_panes = 'A2'

    excel_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(str(excel_path))
    print(f'Saved: {excel_path}')
    return True


def merge_timeout_into_ablation_workbook(outdir: Path, ablation_excel_path: Path) -> bool:
    try:
        from openpyxl import Workbook, load_workbook
        from openpyxl.styles import Font, PatternFill, Border, Side
    except ImportError:
        print('ERROR: openpyxl required. pip install openpyxl')
        return False

    rows_agg = collect_timeout_aggregates(outdir)
    if not rows_agg:
        print('No timeout comparison summaries found to merge into ablation workbook.')
        return False

    if ablation_excel_path.exists():
        wb = load_workbook(str(ablation_excel_path))
    else:
        wb = Workbook()

    if 'Timeout results' in wb.sheetnames:
        del wb['Timeout results']
    if 'Sheet' in wb.sheetnames and len(wb.sheetnames) == 1:
        ws0 = wb['Sheet']
        if ws0.max_row <= 1 and ws0.max_column <= 1 and ws0['A1'].value is None:
            del wb['Sheet']

    ws = wb.create_sheet(title='Timeout results')
    header_font = Font(bold=True)
    header_fill = PatternFill(start_color='D9E1F2', end_color='D9E1F2', fill_type='solid')
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin'))

    aco_rows = []
    dcm_rows = []
    for r in rows_agg:
        out_row = [
            r['puzzle_size'], r['timeout_s'], r['instances'],
            round(r['success_mean'], 5) if not math.isnan(r['success_mean']) else '',
            round(r['time_mean_mean'], 5) if not math.isnan(r['time_mean_mean']) else '',
            round(r['time_std_mean'], 5) if not math.isnan(r['time_std_mean']) else '',
            round(r['cycles_mean_mean'], 5) if not math.isnan(r['cycles_mean_mean']) else '',
            round(r['cycles_std_mean'], 5) if not math.isnan(r['cycles_std_mean']) else '',
        ]
        if r['alg'] == 0:
            aco_rows.append(out_row)
        elif r['alg'] == 2:
            dcm_rows.append(out_row)

    table_headers = [
        'Puzzle size', 'Timeout (s)', 'Instances',
        'Mean success %', 'Mean time (s)', 'Mean time std (s)',
        'Mean cycles', 'Mean cycles std',
    ]
    row_idx = 1
    row_idx = _write_sheet_table(
        ws, row_idx, 'ACO timeout results', table_headers, aco_rows,
        header_font, header_fill, thin_border)
    row_idx = _write_sheet_table(
        ws, row_idx, 'CP-DCM-ACO timeout results', table_headers, dcm_rows,
        header_font, header_fill, thin_border)

    consolidated_headers = [
        'param_name', 'param_value', 'puzzle_size', 'alg', 'alg_name',
        'instances', 'success_mean', 'time_mean_mean', 'time_std_mean',
        'cycles_mean_mean', 'cycles_std_mean',
    ]
    consolidated_rows = []
    for r in rows_agg:
        consolidated_rows.append([
            'timeout',
            r['timeout_s'],
            r['puzzle_size'],
            r['alg'],
            r['alg_name'],
            r['instances'],
            round(r['success_mean'], 5) if not math.isnan(r['success_mean']) else '',
            round(r['time_mean_mean'], 5) if not math.isnan(r['time_mean_mean']) else '',
            round(r['time_std_mean'], 5) if not math.isnan(r['time_std_mean']) else '',
            round(r['cycles_mean_mean'], 5) if not math.isnan(r['cycles_mean_mean']) else '',
            round(r['cycles_std_mean'], 5) if not math.isnan(r['cycles_std_mean']) else '',
        ])
    _write_sheet_table(
        ws, row_idx, 'Consolidated timeout summary', consolidated_headers, consolidated_rows,
        header_font, header_fill, thin_border)

    for col_idx in range(1, len(consolidated_headers) + 1):
        ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = 18
    ws.freeze_panes = 'A3'

    ablation_excel_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(str(ablation_excel_path))
    print(f'Updated: {ablation_excel_path}')
    return True


def run_parallel_timeout_shards(args, sizes, algs):
    """
    Parent orchestration mode:
    For each (size, timeout), launch workers-per-alg shards for each algorithm.
    """
    workers_per_alg = max(1, int(args.workers_per_alg))
    script_path = Path(__file__).resolve()
    best_config = str(Path(args.best_config))
    outdir = str(Path(args.outdir))
    binary = str(args.binary)

    print(
        f'Parallel timeout mode: {workers_per_alg} worker(s)/algorithm, '
        f'{workers_per_alg * len(algs)} total process(es) per (size, timeout) phase.'
    )

    for size_name, _size_cfg in sizes.items():
        size_short = SIZE_SHORT[size_name]
        timeouts = TIMEOUTS_PER_SIZE.get(size_name, [])
        if args.timeout is not None:
            if args.timeout not in timeouts:
                raise SystemExit(
                    f'--timeout {args.timeout} not in grid for {size_name}: {timeouts}')
            timeouts = [args.timeout]

        for t in timeouts:
            print(f'\n=== Phase: {size_name} timeout={t}s ===')
            procs = []
            for alg, alg_name in algs:
                for worker_id in range(workers_per_alg):
                    cmd = [
                        sys.executable,
                        str(script_path),
                        '--binary', binary,
                        '--best-config', best_config,
                        '--outdir', outdir,
                        '--reps', str(int(args.reps)),
                        '--size', size_short,
                        '--timeout', str(int(t)),
                        '--alg', str(int(alg)),
                        '--worker-id', str(worker_id),
                        '--num-workers', str(workers_per_alg),
                        '--no-consolidate',
                    ]
                    if args.quiet:
                        cmd.append('--quiet')
                    elif args.verbose:
                        cmd.append('--verbose')
                    else:
                        cmd.append('--quiet')
                    print(f'  Launch {alg_name} worker {worker_id + 1}/{workers_per_alg}')
                    procs.append((alg_name, worker_id, subprocess.Popen(cmd, cwd=str(REPO_ROOT))))

            failed = []
            for alg_name, worker_id, proc in procs:
                rc = proc.wait()
                if rc != 0:
                    failed.append((alg_name, worker_id, rc))
            if failed:
                print('ERROR: some workers failed in this phase:', file=sys.stderr)
                for alg_name, worker_id, rc in failed:
                    print(f'  {alg_name} worker {worker_id}: exit {rc}', file=sys.stderr)
                raise SystemExit(1)
            print(f'Completed phase: {size_name} timeout={t}s')


def main():
    ap = argparse.ArgumentParser(
        description='ACO vs CP-DCM-ACO across timeouts (uses best_config.json).')
    ap.add_argument('--binary', default=default_binary(), help='Solver binary path')
    ap.add_argument('--best-config', type=str, default=str(DEFAULT_BEST_CONFIG),
                    help='JSON from run_ablation.py --consolidate')
    ap.add_argument('--outdir', type=str, default=str(DEFAULT_OUTDIR),
                    help='Output directory for CSVs')
    ap.add_argument('--reps', type=int, default=100, help='Repetitions per instance')
    ap.add_argument('--size', choices=['9', '16', '25'], default=None,
                    help='Single puzzle size (default: all)')
    ap.add_argument('--timeout', type=int, default=None,
                    help='Single timeout value (must belong to that size grid)')
    ap.add_argument('--alg', type=int, default=None, choices=[0, 2],
                    help='Run only this algorithm ID (default: both)')
    ap.add_argument('--workers-per-alg', type=int, default=1,
                    help='When >1, parent spawns shard workers per algorithm per (size, timeout) phase')
    ap.add_argument('--consolidate', action='store_true',
                    help='Only build timeout_comparison.xlsx from existing CSVs')
    ap.add_argument('--no-consolidate', action='store_true',
                    help='Skip Excel after runs')
    ap.add_argument('--excel-path', type=str, default=str(DEFAULT_EXCEL),
                    help='Excel output path')
    ap.add_argument('--ablation-excel-path', type=str, default=str(DEFAULT_ABLATION_EXCEL),
                    help='Ablation workbook to update with timeout tables')
    ap.add_argument('--worker-id', type=int, default=0)
    ap.add_argument('--num-workers', type=int, default=1)
    ap.add_argument('--verbose', action='store_true', default=True)
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args()

    outdir = Path(args.outdir)
    excel_path = Path(args.excel_path)
    ablation_excel_path = Path(args.ablation_excel_path)
    verbose = args.verbose and not args.quiet

    def vlog(*a, **k):
        if verbose:
            print(*a, **k, flush=True)

    if args.consolidate:
        consolidate_timeout_excel(outdir, excel_path)
        merge_timeout_into_ablation_workbook(outdir, ablation_excel_path)
        return

    binary = args.binary
    if not Path(binary).exists():
        print(f'ERROR: binary not found: {binary}')
        sys.exit(1)

    best_path = Path(args.best_config)
    per_size_cfg = load_best_config(best_path)

    size_map = {'9': '9x9', '16': '16x16', '25': '25x25'}
    if args.size:
        sizes = OrderedDict([
            (size_map[args.size], SIZE_CONFIGS[size_map[args.size]]),
        ])
    else:
        sizes = SIZE_CONFIGS

    algs = ALGORITHMS if args.alg is None else tuple(
        (a, n) for a, n in ALGORITHMS if a == args.alg)

    if args.workers_per_alg > 1 and args.num_workers == 1:
        run_parallel_timeout_shards(args, sizes, algs)
        if not args.no_consolidate:
            vlog('\nConsolidating timeout comparison Excel...')
            consolidate_timeout_excel(outdir, excel_path)
            merge_timeout_into_ablation_workbook(outdir, ablation_excel_path)
        return

    for size_name, size_cfg in sizes.items():
        timeouts = TIMEOUTS_PER_SIZE.get(size_name, [])
        if args.timeout is not None:
            if args.timeout not in timeouts:
                raise SystemExit(
                    f'--timeout {args.timeout} not in grid for {size_name}: {timeouts}')
            timeouts = [args.timeout]

        cfg = per_size_cfg[size_name]
        extra_args, _ = build_solver_args_from_full_config(cfg)
        vlog(f'Config {size_name}: {cfg}')

        for alg, alg_name in algs:
            for t in timeouts:
                vlog(f'\n=== {alg_name} (alg={alg}) timeout={t}s {size_name} ===')
                run_timeout_job(
                    binary, alg, alg_name, t, size_name, size_cfg,
                    extra_args, args.reps, outdir, vlog,
                    worker_id=args.worker_id, num_workers=args.num_workers)

    if not args.no_consolidate:
        vlog('\nConsolidating timeout comparison Excel...')
        consolidate_timeout_excel(outdir, excel_path)
        merge_timeout_into_ablation_workbook(outdir, ablation_excel_path)


if __name__ == '__main__':
    main()
