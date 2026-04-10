"""
Process-pool execution for benchmark scripts: N worker processes pull the next
unfinished (instance, rep) job from a queue (dynamic load balancing).

The parent process is the only writer to progress/summary CSVs. Child processes
only run ``run_solver`` and return a small dict (Windows spawn-safe pickling).
"""

from __future__ import annotations

import csv
import math
import os
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

try:
    import msvcrt
    HAS_MSVCRT = True
except ImportError:
    HAS_MSVCRT = False
    try:
        import fcntl
        HAS_FCNTL = True
    except ImportError:
        HAS_FCNTL = False

from bench_utils import run_solver, safe_mean, safe_std


def lock_file(file_handle):
    try:
        if HAS_MSVCRT:
            sz = os.path.getsize(file_handle.name) if hasattr(file_handle, 'name') else 1
            msvcrt.locking(file_handle.fileno(), msvcrt.LK_LOCK, max(1, sz))
        elif HAS_FCNTL:
            fcntl.flock(file_handle.fileno(), fcntl.LOCK_EX)
    except Exception:
        pass


def unlock_file(file_handle):
    try:
        if HAS_MSVCRT:
            sz = os.path.getsize(file_handle.name) if hasattr(file_handle, 'name') else 1
            msvcrt.locking(file_handle.fileno(), msvcrt.LK_UNLCK, max(1, sz))
        elif HAS_FCNTL:
            fcntl.flock(file_handle.fileno(), fcntl.LOCK_UN)
    except Exception:
        pass


def _read_completed_instances_from_summary(outfile: Path):
    completed = set()
    if not outfile.exists():
        return completed
    try:
        with open(outfile, 'r', newline='') as f:
            lock_file(f)
            for row in csv.DictReader(f):
                inst = row.get('instance')
                if inst:
                    completed.add(inst)
            unlock_file(f)
    except Exception:
        return set()
    return completed


def remove_best_config_progress_if_done(
    outfile: Path,
    progress_file: Path,
    instance_files: list,
) -> bool:
    """
    Delete the progress CSV when the summary lists exactly the same instance names as
    ``instance_files``. Uses the summary file as source of truth so we still clean up
    after a resume or when the parent exits via the "nothing to run" path (in-memory
    completed counts can be incomplete).
    """
    canon = {fp.name for fp in instance_files}
    if not canon:
        return False
    done = _read_completed_instances_from_summary(outfile)
    if done != canon:
        return False
    if not progress_file.exists():
        return False
    try:
        progress_file.unlink()
        print(f'Progress file removed: {progress_file}')
        return True
    except OSError as e:
        print(f'Could not remove progress file {progress_file}: {e}')
        return False


def _read_progress(progress_file: Path):
    prog = {}
    if not progress_file.exists():
        return prog
    try:
        with open(progress_file, 'r', newline='') as f:
            lock_file(f)
            for row in csv.DictReader(f):
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
        csv.writer(f).writerow(headers)


def _append_csv_row(path: Path, row, vlog):
    max_retries = 10
    retry_delay = 0.1
    for attempt in range(max_retries):
        try:
            with open(path, 'a', newline='') as f:
                lock_file(f)
                csv.writer(f).writerow(row)
                f.flush()
                try:
                    os.fsync(f.fileno())
                except OSError:
                    pass
                unlock_file(f)
            return True
        except (IOError, OSError) as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
            else:
                vlog(f"  WARNING: Failed to write after {max_retries} attempts: {e}")
                return False


def _summary_row_from_rep_map(rep_map, args, alg_name):
    successes = 0
    times = []
    cycles_solved = []
    for _rep, (succ, t, cyc) in sorted(rep_map.items()):
        if succ:
            successes += 1
            times.append(t)
            if not math.isnan(cyc):
                cycles_solved.append(cyc)
    succ_pct = (successes / float(args.reps)) * 100.0
    time_mean = safe_mean(times)
    time_std = safe_std(times)
    cycles_mean = safe_mean(cycles_solved)
    cycles_std = safe_std(cycles_solved)
    return [
        None,
        args.alg,
        alg_name,
        round(succ_pct, 2),
        round(time_mean, 6) if not math.isnan(time_mean) else '',
        round(time_std, 6) if not math.isnan(time_std) else '',
        round(cycles_mean, 3) if not math.isnan(cycles_mean) else '',
        round(cycles_std, 3) if not math.isnan(cycles_std) else '',
    ]


def _try_write_summary_if_complete(outfile: Path, progress_file: Path, instance_name, args, alg_name, vlog):
    progress = _read_progress(progress_file)
    rep_map = progress.get(instance_name, {})
    if len(rep_map) < args.reps:
        return False
    completed = _read_completed_instances_from_summary(outfile)
    if instance_name in completed:
        return True
    row = _summary_row_from_rep_map(rep_map, args, alg_name)
    row[0] = instance_name
    max_retries = 10
    retry_delay = 0.1
    for attempt in range(max_retries):
        try:
            with open(outfile, 'r+', newline='') as f:
                lock_file(f)
                completed_now = set()
                reader = csv.DictReader(f)
                for r in reader:
                    completed_now.add(r.get('instance', ''))
                if instance_name in completed_now:
                    unlock_file(f)
                    return True
                f.seek(0, 2)
                csv.writer(f).writerow(row)
                f.flush()
                try:
                    os.fsync(f.fileno())
                except OSError:
                    pass
                unlock_file(f)
            return True
        except (IOError, OSError) as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
            else:
                vlog(f"  WARNING: Failed to write summary after {max_retries} attempts: {e}")
                return False
    return False


def run_one_rep_job(job: dict) -> dict:
    """Child process: one solver invocation (must stay top-level for pickling)."""
    fp = Path(job['instance_path'])
    success, t, cyc, _out = run_solver(
        job['binary'], fp, job['alg'], job['timeout'], extra_args=job['factor_args'])
    return {
        'instance': fp.name,
        'rep': job['rep'],
        'success': success,
        'time': t,
        'cycles': cyc,
    }


def run_benchmark_pool(
    *,
    binary_path: str,
    args,
    alg_name: str,
    instance_files: list,
    outfile: Path,
    progress_file: Path,
    factor_args: list,
    pool_workers: int,
    completed_instances: set,
    progress: dict,
    vlog,
):
    """
    Run all pending (instance, rep) jobs with ProcessPoolExecutor(pool_workers).
    Parent writes CSVs; workers only solve.
    """
    pending = []
    for fp in instance_files:
        if fp.name in completed_instances:
            continue
        rep_map = progress.setdefault(fp.name, {})
        done = set(rep_map.keys())
        for rep in range(1, args.reps + 1):
            if rep in done:
                continue
            pending.append({
                'binary': binary_path,
                'instance_path': str(fp.resolve()),
                'rep': rep,
                'alg': args.alg,
                'timeout': args.timeout,
                'factor_args': list(factor_args),
            })

    if not pending:
        vlog('Pool mode: nothing pending.')
        # Recovery path:
        # It is possible (e.g., interrupted parent between progress and summary writes)
        # that progress already has all reps, but summary is missing one or more instance rows.
        # Backfill summary rows from progress so run CSVs remain complete.
        repaired = 0
        for fp in instance_files:
            inst = fp.name
            if inst in completed_instances:
                continue
            if _try_write_summary_if_complete(outfile, progress_file, inst, args, alg_name, vlog):
                completed_instances.add(inst)
                repaired += 1
        if repaired:
            vlog(f'Pool mode recovery: wrote {repaired} missing summary row(s) from progress.')
    else:
        vlog(f'Pool mode: {pool_workers} worker process(es), {len(pending)} (instance, rep) job(s) queued')

    summary_headers = [
        'instance', 'alg', 'alg_name', 'success_%', 'time_mean', 'time_std',
        'cycles_mean', 'cycles_std',
    ]
    progress_headers = ['instance', 'alg', 'alg_name', 'rep', 'success', 'time', 'cycles']
    _ensure_csv_header(outfile, summary_headers)
    _ensure_csv_header(progress_file, progress_headers)

    done_count = 0
    if pending:
        with ProcessPoolExecutor(max_workers=pool_workers) as ex:
            future_to_rep = {ex.submit(run_one_rep_job, job): job for job in pending}
            for fut in as_completed(future_to_rep):
                job = future_to_rep[fut]
                try:
                    r = fut.result()
                except Exception as e:
                    vlog(f'ERROR job {job["instance_path"]} rep {job["rep"]}: {e}')
                    continue

                inst = r['instance']
                rep = r['rep']
                success = r['success']
                t = r['time']
                cyc = r['cycles']

                progress_row = [
                    inst,
                    args.alg,
                    alg_name,
                    rep,
                    1 if success else 0,
                    '' if math.isnan(t) else t,
                    '' if math.isnan(cyc) else cyc,
                ]
                if not _append_csv_row(progress_file, progress_row, vlog):
                    vlog('  ERROR: progress row not written')

                rm = progress.setdefault(inst, {})
                rm[rep] = (success, t, cyc)

                if _try_write_summary_if_complete(outfile, progress_file, inst, args, alg_name, vlog):
                    completed_instances.add(inst)

                done_count += 1
                if args.verbose and done_count % 50 == 0:
                    vlog(f'  Pool progress: {done_count}/{len(pending)} jobs finished')

    total_instances = len(instance_files)
    from run_ablation import sort_summary_csv_if_complete

    canon = [fp.name for fp in instance_files]
    if sort_summary_csv_if_complete(outfile, canon):
        print(f'Sorted summary rows to instance-folder order ({len(canon)}): {outfile}')
    remove_best_config_progress_if_done(outfile, progress_file, instance_files)

    print(f"\n{'='*70}")
    print(f'Completed (pool). Results saved to: {outfile}')
    print(f'Total instances: {total_instances}')
    print(f'Completed: {len(completed_instances)}/{total_instances}')
    if len(completed_instances) < total_instances:
        print(f'Remaining: {total_instances - len(completed_instances)}')
        print('Re-run with the same arguments to resume.')
    print(f"{'='*70}")
