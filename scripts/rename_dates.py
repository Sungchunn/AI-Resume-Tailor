#!/usr/bin/env python3
"""
Rename date-prefixed directories and files in docs/ from DDMMYY to YYMMDD format.

Example: 070326_inline-suggestions → 260307_inline-suggestions
         (March 7, 2026)            (March 7, 2026)

Uses git mv to preserve history. Run from the repo root.
Dry-run by default — pass --execute to actually rename.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

DOCS_ROOT = Path("docs")
DATE_PREFIX_PATTERN = re.compile(r"^(\d{6})([_\-].+)$")


def convert_ddmmyy_to_yymmdd(ddmmyy: str) -> str:
    """Convert DDMMYY string to YYMMDD string."""
    dd = ddmmyy[0:2]
    mm = ddmmyy[2:4]
    yy = ddmmyy[4:6]

    day = int(dd)
    month = int(mm)

    if not (1 <= month <= 12 and 1 <= day <= 31):
        raise ValueError(f"Invalid date: {ddmmyy} (parsed as day={dd}, month={mm}, year={yy})")

    return f"{yy}{mm}{dd}"


def collect_renames(root: Path) -> list[tuple[Path, Path]]:
    """Walk the directory tree bottom-up and collect (old_path, new_path) pairs."""
    renames = []

    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        dirpath = Path(dirpath)

        # Rename files first
        for filename in filenames:
            match = DATE_PREFIX_PATTERN.match(filename)
            if match:
                old_date, suffix = match.groups()
                try:
                    new_date = convert_ddmmyy_to_yymmdd(old_date)
                except ValueError:
                    print(f"  SKIP (invalid date): {dirpath / filename}")
                    continue
                if new_date != old_date:
                    old_path = dirpath / filename
                    new_path = dirpath / f"{new_date}{suffix}"
                    renames.append((old_path, new_path))

        # Then rename the directory itself
        dirname = dirpath.name
        match = DATE_PREFIX_PATTERN.match(dirname)
        if match:
            old_date, suffix = match.groups()
            try:
                new_date = convert_ddmmyy_to_yymmdd(old_date)
            except ValueError:
                print(f"  SKIP (invalid date): {dirpath}")
                continue
            if new_date != old_date:
                new_dirpath = dirpath.parent / f"{new_date}{suffix}"
                renames.append((dirpath, new_dirpath))

    return renames


def main():
    execute = "--execute" in sys.argv

    if not DOCS_ROOT.exists():
        print(f"Error: {DOCS_ROOT} not found. Run this script from the repo root.")
        sys.exit(1)

    renames = collect_renames(DOCS_ROOT)

    if not renames:
        print("No renames needed.")
        return

    print(f"{'EXECUTING' if execute else 'DRY RUN'}: {len(renames)} renames\n")

    for old_path, new_path in renames:
        print(f"  {old_path} → {new_path}")
        if execute:
            subprocess.run(["git", "mv", str(old_path), str(new_path)], check=True)

    if not execute:
        print(f"\nDry run complete. Run with --execute to apply.")


if __name__ == "__main__":
    main()
