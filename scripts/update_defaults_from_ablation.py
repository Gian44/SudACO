#!/usr/bin/env python3
"""
Update default parameters in run_ablation.py based on best values from ablation study.

This script reads the ablation_summary.xlsx file, extracts the best values from
the "Best Value Analysis" sections, and updates the DEFAULTS dictionary in
run_ablation.py.
"""

import re
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("Error: pandas is required. Install with: pip install pandas openpyxl")
    sys.exit(1)


def read_best_values(excel_path: Path) -> dict:
    """Read best values from ablation Excel file."""
    best_values = {}
    
    # Factor mapping: Excel sheet names -> internal factor names
    sheet_to_factor = {
        "nAnts": "nAnts",
        "q0": "q0",
        "p": "rho",        # Excel shows "p" but code uses "rho"
        "BVE": "evap",     # Excel shows "BVE" but code uses "evap"
        "numACS": "numACS",
        "convThresh": "convThresh",
        "entropyThreshold": "entropyThreshold",
    }
    
    try:
        excel_file = pd.ExcelFile(excel_path)
        
        for sheet_name in sheet_to_factor.keys():
            if sheet_name not in excel_file.sheet_names:
                print(f"Warning: Sheet '{sheet_name}' not found in Excel file")
                continue
            
            df = pd.read_excel(excel_path, sheet_name=sheet_name)
            
            # Find "Best Value Analysis" section
            # It's typically after all the level tables
            best_start = None
            for idx, row in df.iterrows():
                if isinstance(row.iloc[0], str) and "Best Value Analysis" in str(row.iloc[0]):
                    best_start = idx + 1
                    break
            
            if best_start is None:
                print(f"Warning: 'Best Value Analysis' not found in sheet '{sheet_name}'")
                continue
            
            # Read the best value table (usually has columns: size, level, success_rate, time_mean, cycle_mean, n_runs)
            best_df = df.iloc[best_start:best_start+20].copy()  # Read up to 20 rows
            best_df.columns = df.iloc[best_start]  # Use header row
            best_df = best_df.iloc[1:]  # Skip header
            best_df = best_df.dropna(subset=['level'])  # Remove empty rows
            
            if best_df.empty:
                print(f"Warning: No best values found in sheet '{sheet_name}'")
                continue
            
            # Find OVERALL row or aggregate across all sizes
            overall_row = best_df[best_df['size'] == 'OVERALL']
            if not overall_row.empty:
                best_level = overall_row.iloc[0]['level']
            else:
                # Use the first row (already sorted by best performance)
                best_level = best_df.iloc[0]['level']
            
            # Handle different data types
            try:
                best_level = float(best_level)
                # Convert to int if it's a whole number
                if best_level == int(best_level):
                    best_level = int(best_level)
            except (ValueError, TypeError):
                print(f"Warning: Could not parse level '{best_level}' for sheet '{sheet_name}'")
                continue
            
            factor_name = sheet_to_factor[sheet_name]
            best_values[factor_name] = best_level
            print(f"  {sheet_name} ({factor_name}): {best_level}")
    
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return {}
    
    return best_values


def update_script_defaults(script_path: Path, best_values: dict) -> None:
    """Update DEFAULTS dictionary in run_ablation.py."""
    if not script_path.exists():
        print(f"Error: Script file not found: {script_path}")
        return
    
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find DEFAULTS dictionary
    defaults_pattern = r'DEFAULTS\s*=\s*\{([^}]+)\}'
    match = re.search(defaults_pattern, content, re.MULTILINE | re.DOTALL)
    
    if not match:
        print("Error: Could not find DEFAULTS dictionary in script")
        return
    
    defaults_str = match.group(1)
    
    # Update each value
    updated_content = content
    for factor, new_value in best_values.items():
        # Format new value appropriately
        if isinstance(new_value, float):
            if factor in ["rho", "q0", "evap", "convThresh"]:
                # Keep decimal places for these
                formatted_value = f"{new_value:.3f}".rstrip('0').rstrip('.')
            elif factor == "entropyThreshold":
                formatted_value = f"{new_value:.1f}"
            else:
                formatted_value = str(int(new_value)) if new_value == int(new_value) else str(new_value)
        else:
            formatted_value = str(new_value)
        
        # Pattern to match: "factor": value, (with optional comment on same line)
        # Match the value number and preserve comments
        pattern = rf'("{factor}":\s*)[0-9.eE+-]+([,\s]*#.*?)?\n'
        
        def replacer(match):
            # Preserve comment if present, otherwise just add comma
            comment_part = match.group(2) if match.group(2) else ","
            # Remove trailing newline from comment_part if it exists
            if comment_part.endswith('\n'):
                return f'{match.group(1)}{formatted_value}{comment_part.rstrip()}\n'
            return f'{match.group(1)}{formatted_value}{comment_part}\n'
        
        # Try multiline matching
        if re.search(pattern, updated_content, re.MULTILINE):
            updated_content = re.sub(pattern, replacer, updated_content, flags=re.MULTILINE)
        else:
            # Fallback: simpler pattern without comment preservation
            simple_pattern = rf'"{factor}":\s*[0-9.eE+-]+'
            if re.search(simple_pattern, updated_content):
                updated_content = re.sub(simple_pattern, f'"{factor}": {formatted_value}', updated_content)
            else:
                print(f"Warning: Could not find pattern to replace for '{factor}'")
    
    # Write back
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print(f"\nUpdated defaults in {script_path}")
    print("\nNew DEFAULTS:")
    for factor, value in sorted(best_values.items()):
        print(f"  {factor}: {value}")


def main():
    excel_path = Path("results/ablation/ablation_summary.xlsx")
    script_path = Path("scripts/run_ablation.py")
    
    if not excel_path.exists():
        print(f"Error: Excel file not found: {excel_path}")
        print("Please run the ablation study first.")
        sys.exit(1)
    
    print(f"Reading best values from {excel_path}...")
    best_values = read_best_values(excel_path)
    
    if not best_values:
        print("\nError: No best values found. Please check the Excel file.")
        sys.exit(1)
    
    print(f"\nFound best values for {len(best_values)} factors:")
    for factor, value in sorted(best_values.items()):
        print(f"  {factor}: {value}")
    
    print(f"\nUpdating {script_path}...")
    update_script_defaults(script_path, best_values)
    print("\nDone!")


if __name__ == '__main__':
    main()

