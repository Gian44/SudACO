#!/usr/bin/env python3
"""
Consolidate existing ablation *_summary.csv files and compute
mean-of-means metrics for presenting current findings.

Input:
  results/ablation/<param_name>/*_summary.csv
    Columns (from run_ablation.py):
      param_value,puzzle_size,instance,alg,alg_name,
      success_%,time_mean,time_std,cycles_mean,cycles_std

Output:
  results/ablation/consolidated_ablation_summary.csv
    One row per (param_name, param_value, puzzle_size, alg, alg_name) with:
      - instances: number of instances contributing
      - success_mean: average of success_% over instances
      - time_mean_mean: average of time_mean over instances
      - time_std_mean: average of time_std over instances
      - cycles_mean_mean: average of cycles_mean over instances
      - cycles_std_mean: average of cycles_std over instances
"""

import csv
import math
from pathlib import Path
from typing import Dict, List, Tuple


ABLATION_DIR = Path("results") / "ablation"
RESULT_DIR = Path("results")
OUT_CSV = ABLATION_DIR / "consolidated_ablation_summary.csv"

# Default parameter values used in run_ablation.py
DEFAULTS = {
  "nAnts": 3,
  "numACS": 2,
  "q0": 0.9,
  "xi": 0.1,
  "rho": 0.9,
  "evap": 0.005,
  "convThresh": 0.8,
  "entropyPct": 92.5,
}

# Parameter names we care about for consolidation (ablation only; timeout
# comparison lives in scripts/run_algo_timeout_comparison.py).
PARAM_NAMES = list(DEFAULTS.keys())


def safe_mean(values: List[float]) -> float:
  """Return arithmetic mean of non-NaN values, or NaN if none."""
  vals = [v for v in values if not math.isnan(v)]
  if not vals:
    return math.nan
  return sum(vals) / len(vals)


def parse_float(field: str) -> float:
  """Parse a string to float, returning NaN on failure/empty."""
  if field is None:
    return math.nan
  s = field.strip()
  if not s:
    return math.nan
  try:
    return float(s)
  except Exception:
    return math.nan


def fmt(value: float, places: int = 5) -> str:
  """
  Format a float rounded to 'places' decimals, but without
  forcing trailing zeros. Whole numbers stay whole.
  Returns empty string for NaN so the CSV cell is blank.
  """
  if value is None or math.isnan(value):
    return ""
  rounded = round(value, places)
  s = f"{rounded:.{places}f}"
  # Strip trailing zeros and a possible trailing decimal point
  s = s.rstrip("0").rstrip(".")
  return s


def collect_groups() -> Dict[Tuple[str, str, str, str, str], Dict[str, List[float]]]:
  """
  Scan all ablation summary CSVs and group rows by:
    (param_name, param_value, puzzle_size, alg, alg_name)
  """
  groups: Dict[Tuple[str, str, str, str, str], Dict[str, List[float]]] = {}

  if not ABLATION_DIR.exists():
    print(f"No ablation directory found at {ABLATION_DIR}")
    return groups

  for param_dir in sorted(ABLATION_DIR.iterdir()):
    if not param_dir.is_dir():
      continue
    param_name = param_dir.name
    if param_name not in PARAM_NAMES:
      continue

    for csv_file in sorted(param_dir.glob("*_summary.csv")):
      try:
        with open(csv_file, "r", newline="") as f:
          reader = csv.DictReader(f)
          for row in reader:
            param_value = (row.get("param_value") or "").strip()
            puzzle_size = (row.get("puzzle_size") or "").strip()
            alg = (row.get("alg") or "").strip()
            alg_name = (row.get("alg_name") or "").strip()

            key = (param_name, param_value, puzzle_size, alg, alg_name)
            g = groups.setdefault(
              key,
              {
                "instances": 0,
                "success_%": [],
                "time_mean": [],
                "time_std": [],
                "cycles_mean": [],
                "cycles_std": [],
              },
            )

            g["instances"] += 1
            g["success_%"].append(parse_float(row.get("success_%")))
            g["time_mean"].append(parse_float(row.get("time_mean")))
            g["time_std"].append(parse_float(row.get("time_std")))
            g["cycles_mean"].append(parse_float(row.get("cycles_mean")))
            g["cycles_std"].append(parse_float(row.get("cycles_std")))
      except FileNotFoundError:
        continue
      except Exception as e:
        print(f"Warning: failed to read {csv_file}: {e}")
        continue

  return groups


def add_default_runs(
  groups: Dict[Tuple[str, str, str, str, str], Dict[str, List[float]]]
) -> None:
  """
  Also fold in the default CP-DCM-ACO runs from:
    results/9x9/results_9x9_CP-DCM-ACO.csv
    results/16x16/results_16x16_CP-DCM-ACO.csv
    results/25x25/results_25x25_CP-DCM-ACO.csv

  For each size and each parameter (nAnts, numACS, q0, xi, rho, evap,
  convThresh, entropyPct) we create a synthetic group with
  param_value equal to that parameter's default and statistics taken
  from the default runs.
  """
  size_dirs = {
    "9x9": RESULT_DIR / "9x9",
    "16x16": RESULT_DIR / "16x16",
    "25x25": RESULT_DIR / "25x25",
  }

  for size_name, size_dir in size_dirs.items():
    if not size_dir.exists():
      continue

    csv_path = size_dir / f"results_{size_name}_CP-DCM-ACO.csv"
    if not csv_path.exists():
      # No default CP-DCM-ACO results for this size yet
      continue

    try:
      with open(csv_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
          puzzle_size = size_name
          alg = (row.get("alg") or "").strip()
          alg_name = (row.get("alg_name") or "").strip()

          for param_name in PARAM_NAMES:
            default_val = DEFAULTS.get(param_name)
            if default_val is None:
              continue

            key = (param_name, str(default_val), puzzle_size, alg, alg_name)
            g = groups.setdefault(
              key,
              {
                "instances": 0,
                "success_%": [],
                "time_mean": [],
                "time_std": [],
                "cycles_mean": [],
                "cycles_std": [],
              },
            )

            g["instances"] += 1
            g["success_%"].append(parse_float(row.get("success_%")))
            g["time_mean"].append(parse_float(row.get("time_mean")))
            g["time_std"].append(parse_float(row.get("time_std")))
            g["cycles_mean"].append(parse_float(row.get("cycles_mean")))
            g["cycles_std"].append(parse_float(row.get("cycles_std")))
    except FileNotFoundError:
      continue
    except Exception as e:
      print(f"Warning: failed to read default results from {csv_path}: {e}")
      continue


def write_consolidated_csv(groups: Dict[Tuple[str, str, str, str, str], Dict[str, List[float]]]) -> None:
  OUT_CSV.parent.mkdir(parents=True, exist_ok=True)

  headers = [
    "param_name",
    "param_value",
    "puzzle_size",
    "alg",
    "alg_name",
    "instances",
    "success_mean",
    "time_mean_mean",
    "time_std_mean",
    "cycles_mean_mean",
    "cycles_std_mean",
  ]

  # Sort by param_name, puzzle_size, then numeric param_value for easy comparison
  SIZE_ORDER = {"9x9": 0, "16x16": 1, "25x25": 2}

  def sort_key(item):
    (param_name, param_value, puzzle_size, alg, alg_name), _ = item
    try:
      pv_num = float(param_value)
    except Exception:
      pv_num = math.nan
    return (param_name, SIZE_ORDER.get(puzzle_size, 99), puzzle_size, pv_num, param_value, alg, alg_name)

  with open(OUT_CSV, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(headers)

    for (param_name, param_value, puzzle_size, alg, alg_name), stats in sorted(
      groups.items(), key=sort_key
    ):
      success_mean = safe_mean(stats["success_%"])
      time_mean_mean = safe_mean(stats["time_mean"])
      time_std_mean = safe_mean(stats["time_std"])
      cycles_mean_mean = safe_mean(stats["cycles_mean"])
      cycles_std_mean = safe_mean(stats["cycles_std"])

      row = [
        param_name,
        param_value,
        puzzle_size,
        alg,
        alg_name,
        stats["instances"],
        fmt(success_mean, 5),
        fmt(time_mean_mean, 5),
        fmt(time_std_mean, 5),
        fmt(cycles_mean_mean, 5),
        fmt(cycles_std_mean, 5),
      ]
      writer.writerow(row)

  print(f"Wrote consolidated summary to {OUT_CSV}")


def main() -> None:
  groups = collect_groups()
  # Also include the default CP-DCM-ACO runs as a baseline value
  add_default_runs(groups)
  if not groups:
    print("No summary CSVs found to consolidate.")
    return
  write_consolidated_csv(groups)


if __name__ == "__main__":
  main()

