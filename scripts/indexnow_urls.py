#!/usr/bin/env python3
"""
Build IndexNow URL list from git diff between two commits.
Maps changed content/data files to public URLs on patoarchitekci.io.

Usage:
    python scripts/indexnow_urls.py --before <sha> --after <sha>

Output: one URL per line, sorted unique.
"""
import argparse
import pathlib
import re
import subprocess
import sys

import yaml

BASE = "https://patoarchitekci.io"


def changed_files(before: str, after: str) -> list[str]:
    """Return paths changed between two commits (added/modified/deleted)."""
    out = subprocess.check_output(
        ["git", "diff", "--name-only", before, after], text=True
    )
    return [p for p in out.splitlines() if p.strip()]


def frontmatter_url(path: pathlib.Path) -> str | None:
    """Extract `url:` from YAML frontmatter of a markdown file (if any)."""
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    if not m:
        return None
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None
    return fm.get("url")


def urls_for_change(rel_path: str) -> set[str]:
    """Map a changed file path to the set of public URLs that need re-indexing."""
    path = pathlib.Path(rel_path)
    urls: set[str] = set()

    # Episodes — permalink is /<basename>/
    if rel_path.startswith("content/episodes/") and path.name not in {"_index.md"}:
        slug = path.stem
        urls.add(f"{BASE}/{slug}/")
        urls.add(f"{BASE}/odcinki/")
        urls.add(f"{BASE}/")
        return urls

    # Szkolenia content — permalink may be in frontmatter or default
    if rel_path.startswith("content/szkolenia/"):
        if path.name == "_index.md":
            urls.add(f"{BASE}/szkolenia/")
        else:
            url = frontmatter_url(path) or f"/szkolenia/{path.stem}/"
            urls.add(f"{BASE}{url}")
            urls.add(f"{BASE}/szkolenia/")
        return urls

    # Training data (YAML) — affects /szkolenia/<id>/
    if rel_path.startswith("data/trainings/"):
        slug = path.stem
        urls.add(f"{BASE}/szkolenia/{slug}/")
        urls.add(f"{BASE}/szkolenia/")
        urls.add(f"{BASE}/")
        return urls

    return urls


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before", required=True, help="git SHA before push")
    parser.add_argument("--after", required=True, help="git SHA after push")
    args = parser.parse_args()

    files = changed_files(args.before, args.after)
    urls: set[str] = set()
    for f in files:
        urls |= urls_for_change(f)

    for url in sorted(urls):
        print(url)

    if not urls:
        sys.stderr.write("indexnow_urls: no content URLs to ping\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
