#!/usr/bin/env python3
"""
Parallel ablation launcher.

Spawns one `scripts/run_ablation.py` subprocess per *worker partition* for each
(param_name, param_value, size) run.

Each (param,value,size) run is split deterministically across `--workers-per-value`
workers using `--worker-id/--num-workers`, so no two workers write the same
instance summary rows.

The scheduler is global: when any worker finishes, it immediately takes the
next pending worker-task (from any parameter/value run), keeping the CPU busy.
"""

import argparse
import csv
import os
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

# Import config from the main runner (constants only; no main execution).
from scripts.run_ablation import PARAM_TESTS, SIZE_CONFIGS  # noqa: E402


SIZE_ARG_MAP = {"9x9": "9", "16x16": "16", "25x25": "25"}


def build_param_value_jobs_for_param_and_size(param_name, pcfg, size_name):
    """
    Return list of (param_name, param_value, size_name, size_arg) for a single
    (param_name, size_name).
    """
    size_arg = SIZE_ARG_MAP[size_name]
    return [(param_name, val, size_name, size_arg) for val in pcfg["values"]]


def format_param_value_for_filename(value):
    """Match run_ablation.py's param value formatting for filenames."""
    if isinstance(value, float):
        return f"{value:g}"
    return str(value)


def expected_instance_count_for_size(size_name: str) -> int:
    """size_name is like '9x9'/'16x16'/'25x25'."""
    inst_dir = Path("instances") / size_name
    if not inst_dir.exists():
        return 0
    return len(list(inst_dir.glob("*.txt")))


def is_summary_complete(ablation_outdir: Path, param_name, param_value, size_name: str) -> bool:
    """
    Summary is complete when it contains rows for *all* instance files for that size.
    """
    expected = expected_instance_count_for_size(size_name)
    if expected <= 0:
        return False

    val_str = format_param_value_for_filename(param_value)
    summary_file = ablation_outdir / param_name / f"{val_str}_{size_name}_summary.csv"
    if not summary_file.exists():
        return False

    try:
        with open(summary_file, "r", newline="") as f:
            reader = csv.DictReader(f)
            insts = set()
            for row in reader:
                inst = (row.get("instance") or "").strip()
                if inst:
                    insts.add(inst)
        return len(insts) == expected
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser(description="Parallel launcher for run_ablation.py")
    ap.add_argument("--param", type=str, default=None, choices=list(PARAM_TESTS.keys()),
                    help="Run only this parameter (default: all)")
    ap.add_argument("--size", type=str, default=None, choices=["9", "16", "25"],
                    help="Run only this puzzle size (default: all)")
    ap.add_argument("--reps", type=int, default=100, help="Repetitions per instance")
    ap.add_argument("--outdir", default=str(Path("results") / "ablation"),
                    help="Output directory (default: results/ablation)")
    ap.add_argument("--max-jobs", type=int, default=None,
                    help="Maximum concurrent subprocesses (default: min(4, cpu_count))")
    ap.add_argument("--workers-per-value", type=int, default=2,
                    help="Number of worker partitions per (param,value,size) run (default: 2)")
    ap.add_argument("--log-dir", default=str(Path("logs") / "ablation_parallel"),
                    help="Per-job log directory")
    ap.add_argument("--poll-seconds", type=float, default=1.0,
                    help="How often to poll running processes")
    args = ap.parse_args()

    workers_per_value = max(1, int(args.workers_per_value))

    max_jobs = args.max_jobs
    if max_jobs is None:
        # Default to something conservative; you can override in the .bat.
        max_jobs = min(8, os.cpu_count() or 8)
    max_jobs = max(1, int(max_jobs))

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    ablation_outdir = outdir

    log_dir = Path(args.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    sizes_to_test = SIZE_CONFIGS
    if args.size:
        # SIZE_CONFIGS keys are '9x9'/'16x16'/'25x25'
        requested = {"9": "9x9", "16": "16x16", "25": "25x25"}[args.size]
        sizes_to_test = {requested: SIZE_CONFIGS[requested]}

    params_to_test = PARAM_TESTS if args.param is None else {args.param: PARAM_TESTS[args.param]}

    worker_tasks = []
    for param_name, pcfg in params_to_test.items():
        for size_name in sizes_to_test.keys():
            pv_jobs = build_param_value_jobs_for_param_and_size(param_name, pcfg, size_name)
            for (pname, pval, _size_name, size_arg) in pv_jobs:
                if is_summary_complete(ablation_outdir, pname, pval, size_name):
                    # Skip finished runs so we don't create logs/procs after restart.
                    continue
                for worker_id in range(workers_per_value):
                    worker_tasks.append((pname, pval, size_arg, worker_id))

    if not worker_tasks:
        print("No jobs to run.")
        return

    print(
        f"Launching worker tasks: {len(worker_tasks)} "
        f"(max-jobs={max_jobs}, workers-per-value={workers_per_value})"
    )

    runner = REPO_ROOT / "scripts" / "run_ablation.py"
    python = sys.executable

    def launch_worker_task(task):
        param_name, param_value, size_arg, worker_id = task
        val_str = str(param_value)
        safe_val_str = val_str.replace(os.sep, "_").replace(" ", "")
        # One log per (param, value, size); all workers append here (do not use --quiet
        # or vlog output is suppressed and the file stays empty).
        log_path = log_dir / f"{param_name}_{safe_val_str}_size{size_arg}.log"
        fh = open(log_path, "a", encoding="utf-8", newline="\n")
        fh.write(
            f"\n{'='*60}\n"
            f"worker start: {param_name}={param_value} size={size_arg} "
            f"worker_id={worker_id}/{workers_per_value}\n"
            f"{'='*60}\n"
        )
        fh.flush()

        # Unbuffered child stdout so log files update in real time (otherwise Python
        # fully buffers when stdout is not a TTY and logs look empty for hours).
        cmd = [
            python,
            "-u",
            str(runner),
            "--param",
            str(param_name),
            "--param-value",
            str(param_value),
            "--size",
            str(size_arg),
            "--reps",
            str(args.reps),
            "--outdir",
            str(outdir),
            "--no-consolidate",
            "--worker-id",
            str(worker_id),
            "--num-workers",
            str(workers_per_value),
        ]
        env = os.environ.copy()
        env.setdefault("PYTHONUNBUFFERED", "1")
        proc = subprocess.Popen(
            cmd,
            cwd=str(REPO_ROOT),
            stdout=fh,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            env=env,
        )
        return {"proc": proc, "fh": fh, "log_path": log_path}

    # Global worker scheduling: any finished worker takes the next task.
    job_queue = worker_tasks[:]
    running = []
    while job_queue or running:
        while job_queue and len(running) < max_jobs:
            running.append(launch_worker_task(job_queue.pop(0)))

        finished_indices = []
        for i, item in enumerate(running):
            ret = item["proc"].poll()
            if ret is not None:
                item["fh"].close()
                finished_indices.append((i, ret))

        for i, ret in reversed(finished_indices):
            print(f"Worker task finished (exit={ret}): {running[i]['log_path']}")
            running.pop(i)

        if job_queue and len(running) >= max_jobs:
            time.sleep(args.poll_seconds)
        elif running:
            time.sleep(args.poll_seconds)

    # Consolidate once at the end (avoid concurrent Excel writers).
    # run_ablation.py now delegates to scripts/build_ablation_results_excel.py
    # to generate the updated 2-sheet workbook layout.
    print("All worker tasks done. Consolidating to updated Excel format...")
    cmd = [
        python,
        str(runner),
        "--consolidate",
        "--outdir",
        str(outdir),
        "--quiet",
    ]
    result = subprocess.run(cmd, cwd=str(REPO_ROOT), check=False)
    if result.returncode != 0:
        print("WARNING: consolidation returned a non-zero exit code.")


if __name__ == "__main__":
    main()

