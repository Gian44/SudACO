#!/usr/bin/env python3
"""Shared benchmarking utilities for Sudoku ACO experiments.

This module provides helpers for running the solver over the logic-solvable
and general instance sets.  It is intended to be imported by small wrapper
scripts that handle the command line interface for each benchmark type.
"""

import csv
import math
import os
import re
import subprocess
from pathlib import Path
from statistics import mean, pstdev


def default_binary():
    """Guess a sensible default solver binary depending on the platform."""
    if os.name == 'nt':
        cand = Path('vs2017') / 'x64' / 'Release' / 'sudoku_ants.exe'
        if cand.exists():
            return str(cand)
        cand = Path('vs2017') / 'Release' / 'sudoku_ants.exe'
        if cand.exists():
            return str(cand)
        return 'sudoku_ants.exe'
    else:
        return './sudokusolver'


def run_solver(binary, file_path, alg, timeout, extra_args=None):
    """Invoke the solver and parse its output."""
    args = [binary, '--file', str(file_path), '--alg', str(alg), '--timeout', str(timeout), '--verbose']
    if extra_args:
        args.extend(extra_args)
    try:
        out = subprocess.check_output(args, stderr=subprocess.STDOUT, universal_newlines=True)
    except subprocess.CalledProcessError as e:
        out = e.output

    # Parse output: expected two lines at the end: success_flag (0=success), time
    # Be robust to extra prints and scientific notation times like 5e-05.
    lines = [ln.strip() for ln in out.splitlines() if ln.strip() != '']
    success = False
    elapsed = math.nan
    cycles = math.nan
    
    # Keep a copy for cycle parsing before we mutate the list
    all_lines = list(lines)

    # Robust float pattern supporting scientific notation
    float_pat = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?")

    # If the final line looks like a float, treat it as the elapsed time and
    # remove it from the list so it isn't misinterpreted as the success flag.
    if lines:
        m = float_pat.fullmatch(lines[-1])
        if m:
            try:
                elapsed = float(m.group(0))
                lines = lines[:-1]
            except ValueError:
                pass

    # Prefer an explicit success flag line equal to '0' or '1' on the now-last line
    flag = None
    if lines and lines[-1] in ('0', '1'):
        flag = lines[-1]
        lines = lines[:-1]

    # Fallback: search remaining lines for a float if we didn't find time above
    if math.isnan(elapsed):
        for ln in reversed(lines):
            m = float_pat.search(ln)
            if m:
                try:
                    elapsed = float(m.group(0))
                    break
                except ValueError:
                    continue

    # Extract number of cycles if present (supports single- and multi-colony prints)
    cyc_pat = re.compile(r"Number of cycles(?: \(multi\))?:\s*(\d+)")
    for ln in all_lines:
        m = cyc_pat.search(ln)
        if m:
            try:
                cycles = int(m.group(1))
            except ValueError:
                pass

    if flag is not None:
        success = (flag == '0')
    else:
        # Fallback: if we saw "solved in" treat as success
        for ln in all_lines:
            if 'solved in' in ln.lower():
                success = True
                break

    return success, elapsed, cycles, out


def detect_size_from_file(file_path: Path) -> int | None:
    """Detect Sudoku size by mimicking the C++ reader logic.

    The C++ code reads the first two integers, then reads the rest of the
    integers into a vector `values`. If len(values) == first^4 -> old format
    with order=first and size=order^2. If len(values) == first^2 -> new format
    with size=first.
    """
    try:
        text = Path(file_path).read_text()
    except Exception:
        return None
    import re
    nums = re.findall(r"-?\d+", text)
    if len(nums) < 3:
        return None
    try:
        first = int(nums[0])
    except ValueError:
        return None
    # Remaining values after the first two header ints
    values_count = max(0, len(nums) - 2)
    if values_count == first * first * first * first:
        return first * first
    if values_count == first * first:
        return first
    # Fallback: if first is a known size
    if first in (6, 9, 12, 16, 25):
        return first
    # Fallback: if first looks like order (3,4,5)
    if first in (3, 4, 5):
        return first * first
    return None


def scan_logic_instances(base):
    """Return a sorted list of logic-solvable instance files."""
    p = Path(base)
    files = sorted(p.glob('*.txt'))
    return files


def parse_general_filename(name):
    """Parse a general instance filename, returning (size, F%)."""
    stem = Path(name).stem
    parts = stem.split('_')
    if len(parts) < 3:
        return None, None
    size = parts[0].replace('inst', '')
    try:
        frac = int(parts[1])
    except ValueError:
        frac = None
    return size, frac


def scan_general_groups(base):
    """Group general instances by size and fraction of given numbers."""
    groups = {}  # (size, frac) -> [files]
    for fp in sorted(Path(base).glob('*.txt')):
        size, frac = parse_general_filename(fp.name)
        if size is None or frac is None:
            continue
        groups.setdefault((size, frac), []).append(fp)
    return groups


def safe_mean(vals):
    vals = [v for v in vals if not math.isnan(v)]
    if not vals:
        return math.nan
    return mean(vals)


def safe_std(vals):
    vals = [v for v in vals if not math.isnan(v)]
    if len(vals) < 2:
        return 0.0 if len(vals) == 1 else math.nan
    return pstdev(vals)


def write_csv(path, headers, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(headers)
        for r in rows:
            w.writerow(r)

def run_logic(algs, logic_dir, binary, timeout, reps_logic, vlog, extra_args=None):
    """Run benchmarks on logic-solvable instances."""
    logic_rows = []
    logic_headers = ['alg', 'instance', 'success_%', 'time_mean', 'time_std', 'cycles_mean']
    logic_files = scan_logic_instances(logic_dir)
    TIMEOUT_MAP = {6: 3, 9: 5, 12: 10, 16: 20, 25: 120}
    for alg in algs:
        for idx, fp in enumerate(logic_files, start=1):
            vlog(f"[logic-solvable] alg={alg} instance {idx}/{len(logic_files)}: {fp.name}")
            successes = 0
            times = []
            cycles_solved = []
            for r in range(reps_logic):
                vlog(f"  - rep {r+1}/{reps_logic}")
                # Size-specific timeout per file
                sz = detect_size_from_file(fp)
                per_timeout = TIMEOUT_MAP.get(sz, timeout)
                _, t, cyc, out = run_solver(binary, fp, alg, per_timeout, extra_args=extra_args)
                if "solved in" in out.lower():
                    successes += 1
                    times.append(t)
                    if not math.isnan(cyc):
                        cycles_solved.append(cyc)
            succ_pct = (successes / float(reps_logic)) * 100.0
            cycles_mean_val = round(safe_mean(cycles_solved), 3)
            logic_rows.append([
                alg,
                fp.name,
                round(succ_pct, 2),
                round(safe_mean(times), 6),
                round(safe_std(times), 6),
                cycles_mean_val,
            ])
            vlog(
                f"  => success%={round(succ_pct,2)} time_mean={round(safe_mean(times),6)} "
                f"time_std={round(safe_std(times),6)} cycles_mean={cycles_mean_val}"
            )
    return logic_headers, logic_rows


def run_general(algs, gen_dir, binary, timeout, vlog, group_filter=None, file_filter=None, extra_args=None):
    """Run benchmarks on general instances.

    Args:
        algs: Iterable of algorithm identifiers to execute.
        gen_dir: Directory containing general instance files.
        binary: Path to solver executable.
        timeout: Per-run timeout seconds.
        vlog: Verbose logging callback.
        group_filter: Optional callable(size, frac) -> bool to select groups.
        file_filter: Optional callable(size, frac, path) -> bool to select files.
    """
    gen_rows = []
    gen_headers = ['alg', 'puzzle', 'F%', 'solution_rate', 'time_mean', 'time_std', 'cycles_mean']
    groups = scan_general_groups(gen_dir)
    for alg in algs:
        for (size, frac), files in sorted(groups.items()):
            if group_filter and not group_filter(size, frac):
                continue
            if file_filter:
                selected_files = [fp for fp in files if file_filter(size, frac, fp)]
            else:
                selected_files = list(files)
            if not selected_files:
                continue
            total = len(selected_files)
            vlog(f"[general] alg={alg} size={size} F%={frac} files={total}")
            solved = 0
            times = []
            cycles_solved = []
            for i, fp in enumerate(selected_files, start=1):
                __, t, cyc, out = run_solver(binary, fp, alg, timeout, extra_args=extra_args)
                suffix = "" if "solved in" in out.lower() else " (failed)"
                vlog(f"  - file {i}/{total}: {fp.name}{suffix}")
                if "solved in" in out.lower():
                    solved += 1
                    times.append(t)
                    if not math.isnan(cyc):
                        cycles_solved.append(cyc)
            rate = (solved / float(total)) * 100.0
            gen_rows.append([
                alg,
                size,
                frac,
                round(rate, 2),
                round(safe_mean(times), 6),
                round(safe_std(times), 6),
                round(safe_mean(cycles_solved), 3),
            ])
            vlog(
                f"  => solution_rate={round(rate,2)} time_mean={round(safe_mean(times),6)} "
                f"time_std={round(safe_std(times),6)} cycles_mean={round(safe_mean(cycles_solved),3)}"
            )
    return gen_headers, gen_rows


