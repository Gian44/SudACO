#!/usr/bin/env python3
"""
DCM-ACO one-variable-at-a-time ablation study

This script runs an ablation study for the proposed DCM-ACO algorithm (alg=2)
over Sudoku instance sets and exports aggregated results to a single Excel
workbook with one worksheet per factor.

Usage (examples):
  - Default locations:
      python scripts/run_ablation.py

  - Custom binary and instances root:
      python scripts/run_ablation.py --solver vs2017/x64/Release/sudoku_ants.exe \
                                     --instances instances \
                                     --out ablation_summary.xlsx \
                                     --raw ablation_raw_runs.csv

  - Control repetitions:
      python scripts/run_ablation.py --logic_runs 100 --single_runs 1

Notes:
  - This script enforces the proposed algorithm (DCM-ACO, --alg 2) only.
  - It performs a one-factor-at-a-time sweep. All other parameters are held
    at the configured defaults when a particular factor is under test.
  - It will resume from a previous run by skipping duplicate (board, seed,
    factor, level) combinations based on an MD5 key.

Dependencies:
  pandas, openpyxl, tqdm, numpy

"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import re
import shlex
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from itertools import product
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

# Optional: graceful dependency check
MISSING_DEPS: List[str] = []
try:
    import pandas as pd
except Exception:  # pragma: no cover
    MISSING_DEPS.append("pandas")
try:
    import numpy as np
except Exception:  # pragma: no cover
    MISSING_DEPS.append("numpy")
try:
    from tqdm import tqdm
except Exception:  # pragma: no cover
    MISSING_DEPS.append("tqdm")


def _warn_missing_deps() -> None:
    if not MISSING_DEPS:
        return
    sys.stderr.write(
        "Warning: missing packages {}. Install with: pip install {}\n".format(
            ", ".join(MISSING_DEPS),
            " ".join(MISSING_DEPS),
        )
    )


# --------------------------------------------------------------------------------------
# Configuration (solver flags must match source: see src/solvermain.cpp)
# --------------------------------------------------------------------------------------

DEFAULTS = {
    "nAnts": 4,
    "q0": 0.9,
    "rho": 0.9,              # evaporation (spec called it p)
    "evap": 0.001,            # best-value evaporation (spec called it BVE)
    "numACS": 2,             # number of ACS colonies
    # numColonies = numACS + 1 (exactly 1 MMAS colony)
    "convThresh": 0.8,
    "entropyThreshold": 4.0,
    "useACSOnly": False,     # Ablation mode: use homogeneous ACS-only system
}


FACTOR_LEVELS = {
    # sweep order must be exactly this
    "nAnts": [2, 4, 6, 8, 10],
    "q0": [0.5, 0.6, 0.7, 0.8, 0.9],
    "rho": [0.75, 0.80, 0.85, 0.90, 0.95],
    "evap": [0.001, 0.005, 0.01],
    "numACS": [2, 3, 4, 5],  # ensure total colonies = numACS + 1
    "convThresh": [0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    "entropyThreshold": [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0],
}


# Size → timeout seconds
TIMEOUT_MAP = {6: 3, 9: 5, 12: 10, 16: 20, 25: 120}


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------


def default_binary() -> str:
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


def detect_size(board_path: Path) -> Optional[int]:
    """Detect Sudoku size from the first non-empty line of the file.

    The solver reads the first two integers (see src/solvermain.cpp::ReadFile).
    In practice, for new-format files the first integer is the size (6,12,...),
    while for old-format files it is the order (3,4,5) with size = order^2.
    We handle both cases.
    """
    try:
        with open(board_path, 'r') as f:
            for line in f:
                s = line.strip()
                if not s:
                    continue
                # Extract first integer token
                m = re.search(r"[-+]?\d+", s)
                if not m:
                    continue
                first_num = int(m.group(0))
                if first_num in {6, 9, 12, 16, 25}:
                    return first_num
                if first_num in {3, 4, 5}:
                    return first_num * first_num
                # Fallback: if unusually large, assume it's already the size
                if 2 < first_num < 100 and int(math.isfinite(first_num)):
                    # heuristic
                    return first_num
                break
    except Exception:
        return None
    return None


def size_timeout(size: Optional[int]) -> Optional[int]:
    if size in TIMEOUT_MAP:
        return TIMEOUT_MAP[size]  # type: ignore[index]
    return None


def parse_frac_from_filename(board_path: Path) -> Optional[int]:
    """Extract F% (fraction) from filename like inst{size}_{frac}_{index}.txt"""
    try:
        stem = board_path.stem
        parts = stem.split('_')
        if len(parts) >= 2:
            return int(parts[1])
    except (ValueError, IndexError):
        pass
    return None


def md5_key(board_path: Path, seed: int, factor: str, level) -> str:
    h = hashlib.md5()
    h.update(str(board_path).encode('utf-8'))
    h.update(b"\0")
    h.update(str(seed).encode('utf-8'))
    h.update(b"\0")
    h.update(factor.encode('utf-8'))
    h.update(b"\0")
    h.update(str(level).encode('utf-8'))
    return h.hexdigest()


_FLOAT_RE = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?")
_CYCLES_RE = re.compile(r"Number of cycles(?: \(multi\))?:\s*(\d+)")


@dataclass
class RunResult:
    solved: int
    time_sec: float
    cycles: Optional[int]
    stdout: str
    stderr: str


def parse_solver_output(stdout: str) -> Tuple[Optional[int], Optional[float], Optional[int]]:
    """Parse success, time, and cycles from solver stdout.

    Mirrors bench_utils.run_solver() behavior with verbose prints:
      - success: presence of 'solved in' → 1, 'failed in time' → 0
      - time: any float present, prefer last line's float; else last float overall
      - cycles: regex Number of cycles(: (multi))?
    Returns (solved:int|None, time:float|None, cycles:int|None)
    """
    lines = [ln.strip() for ln in stdout.splitlines() if ln.strip()]
    solved_val: Optional[int] = None
    time_val: Optional[float] = None
    cycles_val: Optional[int] = None

    # cycles anywhere
    for ln in lines:
        m = _CYCLES_RE.search(ln)
        if m:
            try:
                cycles_val = int(m.group(1))
            except ValueError:
                pass

    # success detection
    for ln in lines:
        low = ln.lower()
        if 'solved in' in low:
            solved_val = 1
        elif 'failed in' in low:
            if solved_val is None:
                solved_val = 0

    # time extraction: prefer last line's float
    if lines:
        m_last = _FLOAT_RE.search(lines[-1])
        if m_last:
            try:
                time_val = float(m_last.group(0))
            except ValueError:
                time_val = None
    if time_val is None:
        for ln in reversed(lines):
            m = _FLOAT_RE.search(ln)
            if m:
                try:
                    time_val = float(m.group(0))
                    break
                except ValueError:
                    continue

    return solved_val, time_val, cycles_val


def run_once(
    solver: Path,
    board_path: Path,
    timeout_sec: int,
    params: Dict[str, object],
    alg_flag_tokens: List[str],
) -> Tuple[RunResult, List[str]]:
    """Run the solver once with verbose output and return parsed metrics.

    params keys must align with solver flags: nAnts, q0, rho, evap,
    numACS, convThresh, entropyThreshold. numColonies is derived as numACS + 1.
    """
    numACS = int(params["numACS"])  # type: ignore[index]
    numColonies = numACS + 1
    assert numColonies == numACS + 1, "numColonies must equal numACS + 1"

    args: List[str] = [
        str(solver),
        "--file", str(board_path),
        "--timeout", str(int(timeout_sec)),
        "--nAnts", str(int(params["nAnts"])) ,
        "--q0", str(float(params["q0"])) ,
        "--rho", str(float(params["rho"])) ,
        "--evap", str(float(params["evap"])) ,
        "--numColonies", str(int(numColonies)) ,
        "--numACS", str(int(params["numACS"])) ,
        "--convThresh", str(float(params["convThresh"])) ,
        "--entropyThreshold", str(float(params["entropyThreshold"])) ,
        "--verbose",
    ]
    # Add useACSOnly flag if enabled
    if params.get("useACSOnly", False):
        args.append("--useACSOnly")
    # Algorithm flag tokens (e.g., ["--alg", "2"]) must be present
    args.extend(alg_flag_tokens)

    # Safety: require alg flag and correct value (2)
    joined = " ".join(args)
    if "--alg" not in joined:
        raise RuntimeError("Algorithm flag (--alg 2) is required and missing from command.")
    # Best-effort: ensure it equals 2
    try:
        alg_idx = args.index("--alg")
        if alg_idx + 1 >= len(args) or str(args[alg_idx + 1]) != "2":
            raise RuntimeError("This ablation only allows DCM-ACO (--alg 2).")
    except ValueError:
        # covered by earlier check
        pass

    # Execute
    try:
        proc = __import__('subprocess').run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout_sec + 2,
        )
        stdout = proc.stdout or ""
        stderr = proc.stderr or ""
        solved_val, time_val, cycles_val = parse_solver_output(stdout)
        if solved_val is None:
            solved_val = 0
        if time_val is None:
            time_val = float(timeout_sec)
        result = RunResult(
            solved=int(solved_val),
            time_sec=float(time_val),
            cycles=(int(cycles_val) if cycles_val is not None else None),
            stdout=stdout,
            stderr=stderr,
        )
        return result, args
    except __import__('subprocess').TimeoutExpired:
        result = RunResult(
            solved=0,
            time_sec=float(timeout_sec),
            cycles=None,
            stdout="",
            stderr="OS timeout",
        )
        return result, args


def discover_files(instances_root: Path) -> Dict[str, List[Path]]:
    """Discover puzzle files in each folder, excluding 100% filled puzzles."""
    folders = {
        "logic-solvable": instances_root / "logic-solvable",
        "general": instances_root / "general",
        "6x6": instances_root / "6x6",
        "12x12": instances_root / "12x12",
    }
    out: Dict[str, List[Path]] = {}
    for key, p in folders.items():
        if p.exists() and p.is_dir():
            all_files = sorted(p.glob("*.txt"))
            # For general/6x6/12x12, exclude 100% filled puzzles
            if key in ["general", "6x6", "12x12"]:
                filtered = []
                for fp in all_files:
                    # Parse filename: inst{size}_{frac}_{index}.txt
                    stem = fp.stem
                    parts = stem.split('_')
                    if len(parts) >= 2:
                        try:
                            frac = int(parts[1])
                            if frac == 100:
                                continue  # Skip 100% filled
                        except ValueError:
                            pass  # Keep if we can't parse
                    filtered.append(fp)
                out[key] = filtered
            else:
                out[key] = all_files
        else:
            out[key] = []
    return out


def build_raw_index(files_by_folder: Dict[str, List[Path]]) -> pd.DataFrame:
    rows: List[Dict[str, object]] = []
    for folder, paths in files_by_folder.items():
        for fp in paths:
            sz = detect_size(fp)
            frac = parse_frac_from_filename(fp)
            rows.append({
                "folder": folder,
                "board_path": str(fp),
                "size": sz,
                "frac": frac,
            })
    return pd.DataFrame(rows)


def compute_total_runs(files_by_folder: Dict[str, List[Path]], reps_logic: int, reps_single: int) -> int:
    total = 0
    for folder, files in files_by_folder.items():
        reps = reps_logic if folder == "logic-solvable" else reps_single
        for _ in files:
            total += reps
    # multiplied by number of total factor levels across all factors (swept sequentially)
    num_runs_per_sweep = total
    grand = 0
    for factor in ["nAnts", "q0", "rho", "evap", "numACS", "convThresh", "entropyThreshold"]:
        grand += num_runs_per_sweep * len(FACTOR_LEVELS[factor])
    return grand


def write_raw_csv_header_if_missing(raw_csv: Path) -> None:
    if raw_csv.exists():
        return
    raw_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(raw_csv, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow([
            "factor", "level", "folder", "board_path", "size", "frac", "timeout_sec", "seed",
            "solved", "time_sec", "cycles", "stdout_snippet", "stderr_snippet",
            "cmd", "timestamp_utc", "run_hash",
        ])


def append_raw_rows(raw_csv: Path, rows: List[Dict[str, object]]) -> None:
    if not rows:
        return
    raw_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(raw_csv, 'a', newline='') as f:
        w = csv.writer(f)
        for r in rows:
            w.writerow([
                r.get("factor"), r.get("level"), r.get("folder"), r.get("board_path"), r.get("size"), r.get("frac"), r.get("timeout_sec"), r.get("seed"),
                r.get("solved"), r.get("time_sec"), r.get("cycles"), r.get("stdout_snippet"), r.get("stderr_snippet"),
                r.get("cmd"), r.get("timestamp_utc"), r.get("run_hash"),
            ])


def load_existing_hashes(raw_csv: Path) -> set:
    hashes = set()
    if not raw_csv.exists():
        return hashes
    try:
        with open(raw_csv, 'r', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                h = row.get("run_hash")
                if h:
                    hashes.add(h)
    except Exception:
        # On malformed CSV, ignore and start anew
        return set()
    return hashes


def load_existing_rows(raw_csv: Path) -> List[Dict[str, object]]:
    """Load all existing rows from CSV to include in aggregation."""
    rows = []
    if not raw_csv.exists():
        return rows
    try:
        with open(raw_csv, 'r', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Convert types appropriately
                def safe_int(s):
                    if not s or s.strip() == '':
                        return None
                    try:
                        return int(float(s))  # Handle floats that are integers
                    except (ValueError, TypeError):
                        return None
                
                def safe_float(s):
                    if not s or s.strip() == '':
                        return None
                    try:
                        return float(s)
                    except (ValueError, TypeError):
                        return None
                
                row_data = {
                    "factor": row.get("factor", ""),
                    "level": safe_float(row.get("level")),
                    "folder": row.get("folder", ""),
                    "board_path": row.get("board_path", ""),
                    "size": safe_int(row.get("size")),
                    "frac": safe_int(row.get("frac")),
                    "timeout_sec": safe_int(row.get("timeout_sec")) or 0,
                    "seed": safe_int(row.get("seed")) or 0,
                    "solved": safe_int(row.get("solved")) or 0,
                    "time_sec": safe_float(row.get("time_sec")) or 0.0,
                    "cycles": safe_int(row.get("cycles")),
                    "stdout_snippet": row.get("stdout_snippet", ""),
                    "stderr_snippet": row.get("stderr_snippet", ""),
                    "cmd": row.get("cmd", ""),
                    "timestamp_utc": row.get("timestamp_utc", ""),
                    "run_hash": row.get("run_hash", ""),
                }
                rows.append(row_data)
    except Exception as e:
        print(f"Warning: Could not load existing CSV rows: {e}")
        return []
    return rows


def aggregate_factor(df_runs: pd.DataFrame, factor: str, include_timeouts_in_mean: bool) -> Tuple[pd.DataFrame, pd.DataFrame]:
    # Ensure types
    df = df_runs.copy()
    df = df[df["factor"] == factor]
    if not include_timeouts_in_mean:
        df = df[df["solved"] == 1]
    # Compute grouped metrics by level/size/frac/folder
    def _cycle_mean(x):
        vals = [v for v in x if pd.notna(v)]
        return float(np.mean(vals)) if vals else float('nan')

    # For logic-solvable, group by (level, board_name), not by frac
    # For other folders, group by (level, size, frac)
    logic_df = df[df["folder"] == "logic-solvable"]
    other_df = df[df["folder"] != "logic-solvable"]
    
    comp_rows = []
    
    # Handle logic-solvable separately
    if not logic_df.empty:
        grp_logic = logic_df.groupby(["level", "board_path"], dropna=False)
        comp_logic = grp_logic.agg(
            success_rate=("solved", lambda s: float(np.mean(s) * 100.0)),
            time_mean=("time_sec", "mean"),
            time_std=("time_sec", "std"),
            cycle_mean=("cycles", _cycle_mean),
            n_runs=("solved", "count"),
        ).reset_index()
        comp_logic["folder"] = "logic-solvable"
        comp_logic["size"] = logic_df["size"].iloc[0] if not logic_df.empty else None
        comp_logic["frac"] = None
        # Extract just the filename for the instance column
        comp_logic["instance"] = comp_logic["board_path"].apply(lambda p: Path(p).name)
        comp_rows.append(comp_logic)
    
    # Handle other folders (general, 6x6, 12x12)
    if not other_df.empty:
        grp_other = other_df.groupby(["level", "size", "frac", "folder"], dropna=False)
        comp_other = grp_other.agg(
            success_rate=("solved", lambda s: float(np.mean(s) * 100.0)),
            time_mean=("time_sec", "mean"),
            time_std=("time_sec", "std"),
            cycle_mean=("cycles", _cycle_mean),
            n_runs=("solved", "count"),
        ).reset_index()
        comp_rows.append(comp_other)
    
    if comp_rows:
        # Filter out empty or all-NA DataFrames before concatenation
        non_empty_rows = []
        for df_part in comp_rows:
            if df_part is None:
                continue
            df_clean = df_part.copy()
            # Drop rows and columns that are entirely NA
            df_clean = df_clean.dropna(how="all")
            df_clean = df_clean.dropna(how="all", axis=1)
            # Keep only DataFrames with at least one row and one column
            if not df_clean.empty and df_clean.shape[1] > 0:
                non_empty_rows.append(df_clean)
        if non_empty_rows:
            comp = (
                pd.concat(non_empty_rows, ignore_index=True)
                  .sort_values(["size", "frac", "level", "folder"]) 
                  .reset_index(drop=True)
            )
        else:
            comp = pd.DataFrame()
    else:
        comp = pd.DataFrame()

    # Best-value ranking per size and overall
    best_rows: List[Dict[str, object]] = []
    sizes = sorted([s for s in df["size"].dropna().unique()])
    for sz in ([] + sizes + ["OVERALL"]):
        if sz == "OVERALL":
            sub = df
        else:
            sub = df[df["size"] == sz]
        if sub.empty:
            continue
        r = (
            sub.groupby("level")
              .agg(
                  success_rate=("solved", lambda s: float(np.mean(s) * 100.0)),
                  time_mean=("time_sec", "mean"),
                  cycle_mean=("cycles", _cycle_mean),
                  n_runs=("solved", "count"),
              )
              .reset_index()
        )
        # Rank: max success_rate, then min time_mean, then min cycle_mean
        r = r.sort_values(
            by=["success_rate", "time_mean", "cycle_mean"],
            ascending=[False, True, True],
        ).reset_index(drop=True)
        r.insert(0, "size", sz)
        # Keep top 3
        r = r.head(3)
        if not r.empty:
            best_rows.append(r)
    # Filter out empty DataFrames before concatenation
    non_empty_best = [df for df in best_rows if not df.empty]
    best = pd.concat(non_empty_best, ignore_index=True) if non_empty_best else pd.DataFrame()
    return comp, best


def write_factor_sheet(writer: 'pd.ExcelWriter', factor: str, comp: pd.DataFrame, best: pd.DataFrame, defaults_used: Dict[str, object]) -> None:
    sheet = factor
    start_row = 0
    # Header metadata
    header_lines = [
        f"Ablation factor: {factor}",
        f"Timestamp UTC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}",
        "Defaults (held constant unless factor under test):",
        json.dumps(defaults_used, sort_keys=True),
    ]
    meta_df = pd.DataFrame({"info": header_lines})
    meta_df.to_excel(writer, sheet_name=sheet, index=False, startrow=start_row)
    start_row += len(header_lines) + 3
    
    # Write separate table for each level value
    if not comp.empty:
        levels = sorted(comp["level"].unique())
        for level in levels:
            # Write level header
            level_data = {f"{factor} = {level}": []}
            level_df = pd.DataFrame(level_data)
            level_df.to_excel(writer, sheet_name=sheet, index=False, startrow=start_row)
            start_row += 1

            level_comp = comp[comp["level"] == level]

            # For each folder group, print a subheader and a table
            folder_order = ["logic-solvable", "general", "6x6", "12x12"]
            folder_titles = {
                "logic-solvable": "Logic-solvable",
                "general": "General",
                "6x6": "6x6",
                "12x12": "12x12",
            }
            for folder in folder_order:
                sub = level_comp[level_comp["folder"] == folder]
                # Skip if truly no rows for this folder
                if sub.empty:
                    continue
                # Folder title row
                sub_header_df = pd.DataFrame({folder_titles[folder]: []})
                sub_header_df.to_excel(writer, sheet_name=sheet, index=False, startrow=start_row)
                start_row += 1

                # Choose columns per folder type
                if folder == "logic-solvable":
                    # Prefer instance if present, otherwise board_path
                    cols = [c for c in ["instance", "board_path"] if c in sub.columns]
                    display_cols = cols[:1] + [
                        "success_rate", "time_mean", "time_std", "cycle_mean", "n_runs",
                    ]
                else:
                    display_cols = [
                        "size", "frac", "success_rate", "time_mean", "time_std", "cycle_mean", "n_runs",
                    ]
                existing_cols = [c for c in display_cols if c in sub.columns]
                table_df = sub[existing_cols].copy()
                if not table_df.empty:
                    table_df.to_excel(writer, sheet_name=sheet, index=False, startrow=start_row)
                    start_row += len(table_df) + 2
        
        # Best-value analysis at the end
        start_row += 2
        best_header = {"Best Value Analysis": []}
        best_header_df = pd.DataFrame(best_header)
        best_header_df.to_excel(writer, sheet_name=sheet, index=False, startrow=start_row)
        start_row += 1
        
        if not best.empty:
            best.to_excel(writer, sheet_name=sheet, index=False, startrow=start_row)


def build_dry_run_command(solver: Path, alg_flag_tokens: List[str]) -> str:
    example = [
        str(solver),
        "--file", "<board.txt>",
        "--timeout", "<sec>",
        "--nAnts", str(DEFAULTS["nAnts"]),
        "--q0", str(DEFAULTS["q0"]),
        "--rho", str(DEFAULTS["rho"]),
        "--evap", str(DEFAULTS["evap"]),
        "--numColonies", str(DEFAULTS["numACS"] + 1),
        "--numACS", str(DEFAULTS["numACS"]),
        "--convThresh", str(DEFAULTS["convThresh"]),
        "--entropyThreshold", str(DEFAULTS["entropyThreshold"]),
        "--verbose",
    ] + alg_flag_tokens
    return shlex.join(example)


def main() -> None:
    _warn_missing_deps()

    ap = argparse.ArgumentParser(description="Run DCM-ACO ablation and export Excel summary")
    ap.add_argument('--solver', default=default_binary(), help='Path to solver binary (default: auto-detect)')
    ap.add_argument('--instances', default='instances', help='Instances root folder (default: instances)')
    ap.add_argument('--out', default='results/ablation/ablation_summary.xlsx', help='Excel output path (default: results/ablation/ablation_summary.xlsx)')
    ap.add_argument('--raw', default='results/ablation/ablation_raw_runs.csv', help='Raw runs CSV path (default: results/ablation/ablation_raw_runs.csv)')
    ap.add_argument('--logic_runs', type=int, default=100, help='Repetitions for logic-solvable (default: 100)')
    ap.add_argument('--single_runs', type=int, default=1, help='Repetitions for other folders (default: 1)')
    ap.add_argument('--algorithm_flag', default='--alg 2', help='Algorithm flag string to split into args (default: "--alg 2")')
    ap.add_argument('--useACSOnly', action='store_true', help='Use homogeneous ACS-only ablation mode (default: False, uses MMAS)')
    ap.add_argument('--include_timeouts_in_mean', action='store_true', default=True, help='Include unsuccessful runs at timeout in mean time (default: true)')
    ap.add_argument('--no-include_timeouts_in_mean', dest='include_timeouts_in_mean', action='store_false')
    ap.add_argument('--verbose', action='store_true', help='Print progress while running instances')
    args = ap.parse_args()

    solver = Path(args.solver)
    instances_root = Path(args.instances)
    excel_path = Path(args.out)
    raw_csv = Path(args.raw)
    reps_logic = int(args.logic_runs)
    reps_single = int(args.single_runs)
    alg_flag_tokens = [tok for tok in args.algorithm_flag.split() if tok]

    # Verbose logging helper
    def vlog(*a, **k):
        if args.verbose:
            # Use tqdm.write instead of print to avoid interfering with progress bar
            tqdm.write(' '.join(str(x) for x in a), **k)

    # Safety: confirm algorithm flag presence and value
    if "--alg" not in alg_flag_tokens:
        raise SystemExit("Error: --algorithm_flag must include --alg 2 for DCM-ACO.")
    try:
        idx = alg_flag_tokens.index("--alg")
        if idx + 1 >= len(alg_flag_tokens) or alg_flag_tokens[idx + 1] != '2':
            raise SystemExit("Error: This ablation only supports DCM-ACO (--alg 2).")
    except ValueError:
        raise SystemExit("Error: --algorithm_flag must include --alg 2.")

    # Print dry-run example
    dry = build_dry_run_command(solver, alg_flag_tokens)
    print("Dry-run example command:")
    print(dry)

    vlog(f"\nLooking for instances in: {instances_root.absolute()}")
    vlog(f"Instances directory exists: {instances_root.exists()}")
    
    files_by_folder = discover_files(instances_root)
    raw_index_df = build_raw_index(files_by_folder)
    
    # Print discovered files summary
    vlog("\nDiscovered files:")
    for folder, paths in files_by_folder.items():
        vlog(f"  {folder}: {len(paths)} files")

    total_runs = compute_total_runs(files_by_folder, reps_logic, reps_single)
    pbar = tqdm(total=total_runs, desc="Ablation runs", unit="run")

    # Prepare raw CSV and load skip set
    write_raw_csv_header_if_missing(raw_csv)
    seen_hashes = load_existing_hashes(raw_csv)
    
    # Load existing rows from CSV to include in final aggregation
    print(f"Loading existing data from {raw_csv}...")
    existing_rows = load_existing_rows(raw_csv)
    print(f"  Loaded {len(existing_rows)} existing rows")

    # Accumulate rows in memory and append to CSV per-board
    all_rows: List[Dict[str, object]] = []
    # Start with existing rows
    all_rows.extend(existing_rows)

    def per_folder_reps(folder: str) -> int:
        return reps_logic if folder == "logic-solvable" else reps_single

    # Sweep factors in strict order
    factor_order = ["nAnts", "q0", "rho", "evap", "numACS", "convThresh", "entropyThreshold"]

    for factor in factor_order:
        levels = FACTOR_LEVELS[factor]
        for level in levels:
            vlog(f"\n[Ablation] Factor={factor} Level={level}")
            for folder, paths in files_by_folder.items():
                reps = per_folder_reps(folder)
                if not paths:
                    continue
                vlog(f"  [{folder}] {len(paths)} files, {reps} rep(s) each")
                for file_idx, fp in enumerate(paths, start=1):
                    sz = detect_size(fp)
                    frac = parse_frac_from_filename(fp)
                    timeout_sec = size_timeout(sz) or 120
                    per_file_rows: List[Dict[str, object]] = []
                    successes = 0
                    for rep in range(1, reps + 1):
                        seed = rep  # solver has no seed; store iteration index
                        key = md5_key(fp, seed, factor, level)
                        if key in seen_hashes:
                            pbar.update(1)
                            continue

                        # Instantiate params with defaults, override factor
                        params = dict(DEFAULTS)
                        params[factor] = level
                        # Set useACSOnly from command-line argument
                        if args.useACSOnly:
                            params["useACSOnly"] = True
                        # Enforce numColonies rule (derived inside run_once)
                        try:
                            result, argv = run_once(solver, fp, timeout_sec, params, alg_flag_tokens)
                        except Exception as e:
                            # Record as failed run with message
                            err = f"{type(e).__name__}: {e}"
                            cmd_str = shlex.join([str(x) for x in argv]) if 'argv' in locals() else ''
                            row = {
                                "factor": factor,
                                "level": level,
                                "folder": folder,
                                "board_path": str(fp),
                                "size": sz,
                                "frac": frac,
                                "timeout_sec": timeout_sec,
                                "seed": seed,
                                "solved": 0,
                                "time_sec": float(timeout_sec),
                                "cycles": None,
                                "stdout_snippet": "",
                                "stderr_snippet": err[:200],
                                "cmd": cmd_str,
                                "timestamp_utc": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
                                "run_hash": key,
                            }
                            per_file_rows.append(row)
                            seen_hashes.add(key)
                            pbar.update(1)
                            if reps > 1:
                                vlog(f"    - rep {rep}/{reps}: ERROR")
                            continue

                        cmd_str = shlex.join(argv)
                        row = {
                            "factor": factor,
                            "level": level,
                            "folder": folder,
                            "board_path": str(fp),
                            "size": sz,
                            "frac": frac,
                            "timeout_sec": timeout_sec,
                            "seed": seed,
                            "solved": int(result.solved),
                            "time_sec": float(result.time_sec),
                            "cycles": (int(result.cycles) if result.cycles is not None else None),
                            "stdout_snippet": (result.stdout[:200] if result.stdout else ""),
                            "stderr_snippet": (result.stderr[:200] if result.stderr else ""),
                            "cmd": cmd_str,
                            "timestamp_utc": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
                            "run_hash": key,
                        }
                        per_file_rows.append(row)
                        seen_hashes.add(key)
                        if result.solved:
                            successes += 1
                        pbar.update(1)
                        
                        # Log rep-level progress for logic-solvable
                        if reps > 1:
                            status = "solved" if result.solved else "failed"
                            vlog(f"    - rep {rep}/{reps}: {status} in {result.time_sec:.4f}s")

                    # Persist after each board file
                    append_raw_rows(raw_csv, per_file_rows)
                    all_rows.extend(per_file_rows)
                    
                    # Log file-level summary
                    if per_file_rows:
                        if reps > 1:
                            succ_pct = (successes / reps) * 100.0
                            vlog(f"  - file {file_idx}/{len(paths)}: {fp.name} => {successes}/{reps} solved ({succ_pct:.1f}%)")
                        else:
                            status = "solved" if per_file_rows[0]["solved"] else "failed"
                            time_val = per_file_rows[0]["time_sec"]
                            vlog(f"  - file {file_idx}/{len(paths)}: {fp.name} => {status} in {time_val:.4f}s")

    pbar.close()

    # Build DataFrame
    df_runs = pd.DataFrame(all_rows)
    
    # Debug: Print what factors are actually in the data
    if not df_runs.empty:
        print(f"\nData summary:")
        print(f"  Total runs in DataFrame: {len(df_runs)}")
        if "factor" in df_runs.columns:
            factors_found = df_runs["factor"].unique()
            print(f"  Factors found: {sorted(factors_found)}")
            for fac in factors_found:
                count = len(df_runs[df_runs["factor"] == fac])
                print(f"    {fac}: {count} runs")
    
    # Excel writer, factor sheets
    excel_path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        # Raw index
        idx_df = raw_index_df.sort_values(["folder", "size", "board_path"]).reset_index(drop=True)
        idx_df.to_excel(writer, sheet_name="_RAW_INDEX", index=False)

        # Optional RUN_LOG sample (last 1000)
        if not df_runs.empty:
            df_sample = df_runs.tail(1000)
            df_sample.to_excel(writer, sheet_name="_RUN_LOG", index=False)
        else:
            pd.DataFrame(columns=[
                "factor", "level", "folder", "board_path", "size", "frac", "timeout_sec", "seed",
                "solved", "time_sec", "cycles", "stdout_snippet", "stderr_snippet",
                "cmd", "timestamp_utc", "run_hash",
            ]).to_excel(writer, sheet_name="_RUN_LOG", index=False)

        # Factor sheets in required order with display names
        display_names = {
            "nAnts": "nAnts",
            "q0": "q0",
            "rho": "p",           # display label per spec
            "evap": "BVE",
            "numACS": "numACS",
            "convThresh": "convThresh",
            "entropyThreshold": "entropyThreshold",
        }

        for factor in ["nAnts", "q0", "rho", "evap", "numACS", "convThresh", "entropyThreshold"]:
            comp, best = aggregate_factor(df_runs, factor, include_timeouts_in_mean=args.include_timeouts_in_mean)
            write_factor_sheet(writer, display_names[factor], comp, best, DEFAULTS)

    print(f"Wrote Excel summary: {excel_path}")
    print(f"Wrote raw CSV: {raw_csv}")


if __name__ == '__main__':
    main()


