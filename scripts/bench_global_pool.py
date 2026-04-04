"""
Single ProcessPoolExecutor for best-config CP-DCM-ACO on 9×9 / 16×16 / 25×25.

**Parallel start, elastic caps:** each selected size gets up to ``--workers-per-size``
concurrent reps at first (e.g. 2×3 sizes → 6 processes). When a size has no work
left, its capacity is added to the **first** remaining size in pipeline order
(9×9 → 16×16 → 25×25), so e.g. when 9×9 finishes, 16×16 can run up to 4 reps at
once if 25×25 still uses 2.

**Within one puzzle file:** all reps for that file finish before reps for the next
file on the same size (instance batches in order).

CSV layout matches ``run_*x*.py`` with ``--best-config`` (best_config_ prefix).
"""

from __future__ import annotations

import argparse
import math
import sys
from collections import deque
from concurrent.futures import FIRST_COMPLETED, ProcessPoolExecutor, wait
from pathlib import Path
from types import SimpleNamespace

import bench_best_config
import bench_pool_jobs
from run_ablation import sort_summary_csv_if_complete

from bench_utils import default_binary

REPO_ROOT = Path(__file__).resolve().parents[1]

ALG = 2
ALG_NAME = 'CP-DCM-ACO'

# (size_name, instances relative to repo, timeout s, outdir relative to repo)
SIZE_DEFS = [
    ('9x9', 'instances/9x9', 5, 'results/9x9'),
    ('16x16', 'instances/16x16', 20, 'results/16x16'),
    ('25x25', 'instances/25x25', 120, 'results/25x25'),
]

SIZE_ORDER = [d[0] for d in SIZE_DEFS]


def global_run_one_rep_job(job: dict) -> dict:
    """Child: one solver call (top-level for Windows spawn)."""
    from pathlib import Path
    from bench_utils import run_solver

    fp = Path(job['instance_path'])
    success, t, cyc, _out = run_solver(
        job['binary'], fp, job['alg'], job['timeout'], extra_args=job['factor_args'])
    return {
        'size_name': job['size_name'],
        'instance': fp.name,
        'rep': job['rep'],
        'success': success,
        'time': t,
        'cycles': cyc,
    }


def _parse_sizes(s: str) -> list[str]:
    raw = s.strip().lower()
    if raw == 'all':
        return [d[0] for d in SIZE_DEFS]
    out = []
    for part in s.split(','):
        p = part.strip()
        if p == '9':
            out.append('9x9')
        elif p == '16':
            out.append('16x16')
        elif p == '25':
            out.append('25x25')
        elif p in ('9x9', '16x16', '25x25'):
            out.append(p)
        else:
            raise ValueError(f'unknown size token: {part!r}')
    return out


def _paths_for_size(size_name: str, run_suffix: str) -> tuple[Path, Path]:
    outdir_rel = None
    for d in SIZE_DEFS:
        if d[0] == size_name:
            outdir_rel = d[3]
            break
    if outdir_rel is None:
        raise ValueError(f'unknown size_name: {size_name!r}')
    outdir = REPO_ROOT / outdir_rel
    outdir.mkdir(parents=True, exist_ok=True)
    prefix = 'best_config_'
    outfile = outdir / f'{prefix}results_{size_name}_{ALG_NAME}{run_suffix}.csv'
    progress_file = outdir / f'{prefix}progress_{size_name}_{ALG_NAME}{run_suffix}.csv'
    return outfile, progress_file


def _trim_front_empty_batches(batches: dict[str, deque], sz: str) -> None:
    q = batches[sz]
    while q and len(q[0]) == 0:
        q.popleft()


def _size_has_pending_work(batches: dict[str, deque], sz: str) -> bool:
    _trim_front_empty_batches(batches, sz)
    return bool(batches[sz])


def _pop_next_job(batches: dict[str, deque], sz: str) -> dict | None:
    _trim_front_empty_batches(batches, sz)
    if not batches[sz]:
        return None
    job = batches[sz][0].popleft()
    _trim_front_empty_batches(batches, sz)
    return job


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description='Shared solver pool for best-config CP-DCM-ACO: parallel sizes, elastic worker caps.')
    ap.add_argument(
        '--workers-per-size',
        type=int,
        default=2,
        help='Max concurrent reps per size; pool size = this times (selected sizes). '
             'When a size finishes, its slots move to the next busy size (default: 2).',
    )
    ap.add_argument(
        '--workers',
        type=int,
        default=None,
        help=argparse.SUPPRESS,
    )
    ap.add_argument('--sizes', type=str, default='all',
                    help='all or comma-separated 9,16,25 (default: all)')
    ap.add_argument(
        '--best-config',
        nargs='?',
        const='results/ablation/best_config.json',
        default='results/ablation/best_config.json',
        help='Path to best_config.json',
    )
    ap.add_argument('--reps', type=int, default=100)
    ap.add_argument('--run', type=int, default=1, help='Run index (same as run_9x9 --run)')
    ap.add_argument('--binary', default=None, help='Solver binary (default: auto)')
    ap.add_argument(
        '--verbose',
        action='store_true',
        help='Print capacity shifts, per-job lines (if at most 400 total reps else every 50), CSV warnings.',
    )
    if argv is not None:
        args = ap.parse_args(argv)
    else:
        args = ap.parse_args()

    wps = args.workers_per_size if args.workers is None else args.workers
    workers_per_size = max(1, int(wps))
    if args.run < 1:
        ap.error('--run must be >= 1')

    try:
        selected = _parse_sizes(args.sizes)
    except ValueError as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return 1

    selected_set = frozenset(selected)
    sizes_order = [s for s in SIZE_ORDER if s in selected_set]

    run_suffix = f'_run{args.run}' if args.run > 1 else ''
    binary = args.binary or default_binary()
    binary_path = str(Path(binary).resolve())
    if not Path(binary_path).exists():
        print(f'ERROR: binary not found: {binary_path}', file=sys.stderr)
        return 1

    bc_path = Path(args.best_config)
    if not bc_path.is_file():
        print(f'ERROR: best-config file not found: {bc_path}', file=sys.stderr)
        return 1

    cfg = bench_best_config.load_merged_config(bc_path)
    factor_args = bench_best_config.factor_args_from_cfg(cfg)

    summary_ns = SimpleNamespace(alg=ALG, reps=int(args.reps))

    def vlog(*a, **k):
        if args.verbose:
            print(*a, **k, flush=True)

    size_state: dict[str, dict] = {}
    instance_job_blocks: list[tuple[str, Path, list[dict]]] = []
    total_pending = 0

    for size_name, inst_rel, timeout, _out in SIZE_DEFS:
        if size_name not in selected_set:
            continue
        inst_dir = REPO_ROOT / inst_rel
        outfile, progress_file = _paths_for_size(size_name, run_suffix)
        instance_files = sorted(inst_dir.glob('*.txt'))
        if not instance_files:
            print(f'WARNING: no instances in {inst_dir}', file=sys.stderr)
            continue

        completed = bench_pool_jobs._read_completed_instances_from_summary(outfile)
        progress = bench_pool_jobs._read_progress(progress_file)

        summary_headers = [
            'instance', 'alg', 'alg_name', 'success_%', 'time_mean', 'time_std',
            'cycles_mean', 'cycles_std',
        ]
        progress_headers = ['instance', 'alg', 'alg_name', 'rep', 'success', 'time', 'cycles']
        bench_pool_jobs._ensure_csv_header(outfile, summary_headers)
        bench_pool_jobs._ensure_csv_header(progress_file, progress_headers)

        size_state[size_name] = {
            'outfile': outfile,
            'progress_file': progress_file,
            'instance_files': instance_files,
            'timeout': timeout,
            'completed': completed,
            'progress': {k: dict(v) for k, v in progress.items()},
        }

        for fp in instance_files:
            if fp.name in completed:
                continue
            rep_map = size_state[size_name]['progress'].setdefault(fp.name, {})
            done_reps = set(rep_map.keys())
            jobs: list[dict] = []
            for rep in range(1, summary_ns.reps + 1):
                if rep in done_reps:
                    continue
                jobs.append({
                    'binary': binary_path,
                    'instance_path': str(fp.resolve()),
                    'rep': rep,
                    'alg': ALG,
                    'timeout': timeout,
                    'factor_args': list(factor_args),
                    'size_name': size_name,
                })
            if jobs:
                instance_job_blocks.append((size_name, fp, jobs))
                total_pending += len(jobs)

    if not instance_job_blocks:
        print('Nothing to run (all selected sizes already complete or empty).')
        for st in size_state.values():
            outfile = st['outfile']
            instance_files = st['instance_files']
            canon = [fp.name for fp in instance_files]
            if sort_summary_csv_if_complete(outfile, canon):
                print(f'Sorted summary rows to instance-folder order ({len(canon)}): {outfile}')
            bench_pool_jobs.remove_best_config_progress_if_done(
                outfile, st['progress_file'], instance_files)
        return 0

    batches: dict[str, deque] = {s: deque() for s in selected}
    for size_name, _fp, jobs in instance_job_blocks:
        batches[size_name].append(deque(jobs))

    # Keep total pool fixed by selected sizes (e.g., all sizes with 2 => always 6),
    # then redistribute slots from sizes that are already complete at startup.
    max_workers = workers_per_size * max(1, len(sizes_order))
    max_parallel = {
        s: workers_per_size
        for s in selected
    }
    in_flight = {s: 0 for s in selected}

    def redistribute_capacity(finished_sz: str, reason: str = 'finished') -> None:
        bonus = max_parallel.get(finished_sz, 0)
        if bonus <= 0:
            return
        max_parallel[finished_sz] = 0
        for sz in sizes_order:
            if sz == finished_sz:
                continue
            if _size_has_pending_work(batches, sz) or in_flight[sz] > 0:
                max_parallel[sz] = max_parallel.get(sz, 0) + bonus
                print(
                    f'Size {finished_sz} {reason} — moved {bonus} worker slot(s) to {sz} '
                    f'(max concurrent reps on {sz} is now {max_parallel[sz]}).',
                    flush=True,
                )
                vlog(f'  max_parallel: {dict(max_parallel)}')
                return

    # Startup rebalance: if a selected size has no pending work at launch,
    # move its slots immediately so remaining sizes can use the full pool.
    for sz in sizes_order:
        if not _size_has_pending_work(batches, sz):
            redistribute_capacity(sz, reason='already complete at startup')

    print(
        f'Unified pool: {max_workers} solver process(es), {workers_per_size} cap per size at start, '
        f'{total_pending} rep-run(s), {len(instance_job_blocks)} instance batch(es).'
    )
    print(f'Sizes (pipeline order): {", ".join(sizes_order)}')
    print(f'best-config: {bc_path}')

    if args.verbose:
        by_sz: dict[str, int] = {}
        for _sn, _fp, jobs in instance_job_blocks:
            by_sz[_sn] = by_sz.get(_sn, 0) + len(jobs)
        vlog('Verbose mode on.')
        vlog(f'Binary: {binary_path}')
        vlog(f'Extra solver args: {factor_args}')
        for sz in sizes_order:
            n = by_sz.get(sz, 0)
            if n:
                vlog(f'  Pending rep-runs {sz}: {n}')
        vlog(f'  max_parallel (initial): {dict(max_parallel)}')

    done_count = 0

    def handle_completed(fut, job_by_fut: dict) -> None:
        nonlocal done_count
        job = job_by_fut.pop(fut)
        sz_done = job['size_name']
        in_flight[sz_done] -= 1
        try:
            r = fut.result()
        except Exception as e:
            print(
                f'ERROR {job.get("size_name")} {job.get("instance_path")} rep {job.get("rep")}: {e}',
                file=sys.stderr,
                flush=True,
            )
        else:
            sz = r['size_name']
            st = size_state[sz]
            outfile = st['outfile']
            progress_file = st['progress_file']
            inst = r['instance']
            rep = r['rep']
            success = r['success']
            t = r['time']
            cyc = r['cycles']

            progress_row = [
                inst,
                ALG,
                ALG_NAME,
                rep,
                1 if success else 0,
                '' if math.isnan(t) else t,
                '' if math.isnan(cyc) else cyc,
            ]
            if not bench_pool_jobs._append_csv_row(progress_file, progress_row, vlog):
                vlog('  ERROR: progress row not written')

            st['progress'].setdefault(inst, {})[rep] = (success, t, cyc)

            if bench_pool_jobs._try_write_summary_if_complete(
                    outfile, progress_file, inst, summary_ns, ALG_NAME, vlog):
                st['completed'].add(inst)

            done_count += 1
            if args.verbose:
                if total_pending <= 400:
                    ts = f'{t:.6g}' if not math.isnan(t) else 'nan'
                    vlog(f'  done {sz} {inst} rep={rep} success={success} time={ts}')
                elif done_count % 50 == 0:
                    vlog(f'  Unified pool: {done_count}/{total_pending} rep-runs done')

        if (
            in_flight[sz_done] == 0
            and not _size_has_pending_work(batches, sz_done)
            and sz_done in max_parallel
        ):
            redistribute_capacity(sz_done, reason='finished')

    def submit_round(ex: ProcessPoolExecutor, job_by_fut: dict) -> None:
        """Fair fill: one submission per size per inner sweep so 9/16/25 start together."""
        while len(job_by_fut) < max_workers:
            any_sub = False
            for sz in sizes_order:
                if in_flight[sz] < max_parallel.get(sz, 0):
                    job = _pop_next_job(batches, sz)
                    if job:
                        fut = ex.submit(global_run_one_rep_job, job)
                        job_by_fut[fut] = job
                        in_flight[sz] += 1
                        any_sub = True
                if len(job_by_fut) >= max_workers:
                    break
            if not any_sub:
                break

    with ProcessPoolExecutor(max_workers=max_workers) as ex:
        job_by_fut: dict = {}
        submit_round(ex, job_by_fut)
        while job_by_fut:
            done, _ = wait(job_by_fut.keys(), return_when=FIRST_COMPLETED)
            for fut in done:
                handle_completed(fut, job_by_fut)
            submit_round(ex, job_by_fut)

    for size_name, st in size_state.items():
        outfile = st['outfile']
        instance_files = st['instance_files']
        canon = [fp.name for fp in instance_files]
        if sort_summary_csv_if_complete(outfile, canon):
            print(f'Sorted summary rows to instance-folder order ({len(canon)}): {outfile}')
        bench_pool_jobs.remove_best_config_progress_if_done(
            outfile, st['progress_file'], instance_files)

    print(f"\n{'='*70}")
    print('Unified pool finished.')
    for size_name, st in size_state.items():
        n = len(st['instance_files'])
        c = len(st['completed'])
        print(f'  {size_name}: {c}/{n} instances -> {st["outfile"]}')
    print(f"{'='*70}")
    return 0


if __name__ == '__main__':
    import multiprocessing
    multiprocessing.freeze_support()
    raise SystemExit(main())
