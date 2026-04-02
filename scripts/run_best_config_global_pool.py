#!/usr/bin/env python3
"""
Unified best-config benchmark: one shared solver pool across 9×9, 16×16, and 25×25.

Workers run **one puzzle file at a time** (all reps for that file, then the next);
after all 9×9 files are done, work continues on 16×16, then 25×25. Within one
file, ``--workers`` reps may run in parallel.

  python scripts/run_best_config_global_pool.py --workers-per-size 2 --verbose

See ``bench_global_pool.py`` for implementation.
"""

import multiprocessing

import bench_global_pool

if __name__ == '__main__':
    multiprocessing.freeze_support()
    raise SystemExit(bench_global_pool.main())
