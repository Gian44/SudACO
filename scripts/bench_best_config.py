"""
Helpers for benchmark scripts: load ``best_config.json`` and build solver CLI args.

Used by run_9x9.py / run_16x16.py / run_25x25.py with ``--best-config``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

_BUILD_AND_DEFAULTS = None


def _build_and_defaults():
    global _BUILD_AND_DEFAULTS
    if _BUILD_AND_DEFAULTS is None:
        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        from scripts.run_ablation import build_solver_args_from_full_config, DEFAULTS
        _BUILD_AND_DEFAULTS = (build_solver_args_from_full_config, DEFAULTS)
    return _BUILD_AND_DEFAULTS


def load_merged_config(json_path: Path | str) -> dict:
    """Merge ``best_config.json`` (flat dict) with ablation DEFAULTS."""
    _, DEFAULTS = _build_and_defaults()
    p = Path(json_path)
    with open(p, encoding='utf-8') as f:
        raw = json.load(f)
    if any(k in raw for k in ('9x9', '16x16', '25x25')):
        raise ValueError(
            f'{p}: expected a flat best_config.json (from run_ablation --consolidate), '
            'not per-size keys')
    cfg = dict(DEFAULTS)
    cfg.update(raw)
    return cfg


def factor_args_from_cfg(cfg: dict) -> list:
    """Return ``extra_args`` list for ``run_solver`` (includes ``--entropyThreshold``)."""
    build_fn, _ = _build_and_defaults()
    args_list, _ = build_fn(cfg)
    return args_list


def replace_entropy_threshold_arg(factor_args: list, value: float) -> list:
    """Override ``--entropyThreshold`` in an existing arg list."""
    out = list(factor_args)
    for i in range(len(out) - 1):
        if out[i] == '--entropyThreshold':
            out[i + 1] = str(float(value))
            return out
    out += ['--entropyThreshold', str(float(value))]
    return out


def apply_cli_cfg_overrides(cfg: dict, args) -> None:
    """Apply non-None benchmark CLI overrides onto ``cfg`` (mutates)."""
    if args.nAnts is not None:
        cfg['nAnts'] = int(args.nAnts)
    if args.q0 is not None:
        cfg['q0'] = float(args.q0)
    if args.rho is not None:
        cfg['rho'] = float(args.rho)
    if args.evap is not None:
        cfg['evap'] = float(args.evap)
    if args.numACS is not None:
        cfg['numACS'] = int(args.numACS)
    if args.convThresh is not None:
        cfg['convThresh'] = float(args.convThresh)
    if args.xi is not None:
        cfg['xi'] = float(args.xi)
