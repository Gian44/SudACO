#!/usr/bin/env python3
"""Run a single experiment on Sudoku instances and print JSON results."""

import argparse
import json
from pathlib import Path

from bench_utils import default_binary, run_general, run_logic


def main():
    ap = argparse.ArgumentParser(description="Run a single Sudoku experiment")
    ap.add_argument("--type", choices=["general", "logic"], required=True)
    ap.add_argument("--alg", type=int, default=0, help="Algorithm id")
    ap.add_argument("--size", help="Puzzle size for general experiments (e.g., 9x9)")
    ap.add_argument("--fill", type=int, help="Filled percentage for general experiments")
    ap.add_argument("--instances", default="instances", help="Instances root directory")
    ap.add_argument("--binary", default=default_binary(), help="Solver binary")
    ap.add_argument("--timeout", type=int, default=10, help="Solver timeout seconds")
    ap.add_argument("--reps", type=int, default=10, help="Repetitions for logic-solvable experiments")
    args = ap.parse_args()

    def vlog(*a, **k):
        pass

    result = {}
    if args.type == "general":
        headers, rows = run_general([args.alg], Path(args.instances) / "general", args.binary, args.timeout, vlog)
        for r in rows:
            # rows: alg, size, frac, solution_rate, time_mean, time_std, cycles_mean
            alg = int(r[0])
            size = r[1]
            frac = int(r[2])
            if alg == args.alg and size == args.size and frac == args.fill:
                result = {
                    "alg": alg,
                    "size": size,
                    "fill": frac,
                    "solution_rate": r[3],
                    "time_mean": r[4],
                    "time_std": r[5],
                    "cycles_mean": r[6],
                }
                break
    else:
        headers, rows = run_logic([args.alg], Path(args.instances) / "logic-solvable", args.binary, args.timeout, args.reps, vlog)
        # Aggregate across all logic instances
        if rows:
            times = [float(r[3]) for r in rows]
            time_mean = sum(times) / len(times)
            time_std = 0.0
            result = {
                "alg": args.alg,
                "instances": len(rows),
                "time_mean": round(time_mean, 6),
            }

    print(json.dumps(result))


if __name__ == "__main__":
    main()

