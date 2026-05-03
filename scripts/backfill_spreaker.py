#!/usr/bin/env python3
"""
Backfill `duration` (ISO 8601) and `audio_url` w content/episodes/*.md
z public Spreaker API.

Mapping: front matter `episode` (np. "192") → Spreaker `episode_number` (192).

Usage:
    python scripts/backfill_spreaker.py [--dry-run]
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys
import time
import urllib.request
import json

SHOW_ID = "4215515"
API = f"https://api.spreaker.com/v2/shows/{SHOW_ID}/episodes"
EPISODES_DIR = pathlib.Path(__file__).resolve().parent.parent / "content" / "episodes"


def ms_to_iso8601(ms: int) -> str:
    """Convert milliseconds to ISO 8601 duration like PT1H23M45S."""
    total_s = ms // 1000
    h, rem = divmod(total_s, 3600)
    m, s = divmod(rem, 60)
    parts = ["PT"]
    if h:
        parts.append(f"{h}H")
    if m:
        parts.append(f"{m}M")
    if s or (not h and not m):
        parts.append(f"{s}S")
    return "".join(parts)


def fetch_episode_detail(episode_id: int) -> dict:
    """Per-episode endpoint zwraca episode_number (bulk endpoint nie)."""
    with urllib.request.urlopen(
        f"https://api.spreaker.com/v2/episodes/{episode_id}", timeout=30
    ) as resp:
        return json.load(resp)["response"]["episode"]


def normalize_title(title: str) -> str:
    """Lowercase + strip + remove '#NNN' prefix + strip punctuation tail."""
    t = title.strip().lower()
    # Strip leading '#NNN ' or 'NNN. ' or 'NNN '
    t = re.sub(r"^#?\d+[\.\s]+", "", t)
    # Strip trailing whitespace/punctuation
    t = re.sub(r"[\s\-_]+$", "", t).strip()
    return t


def fetch_all_episodes() -> tuple[dict[int, dict], dict[str, dict]]:
    """
    Returns TWO mappings from Spreaker:
    - by_number: {episode_number: data}  (gdy episode_number ustawiony)
    - by_title:  {normalized_title: data} (fallback dla starszych bez numeru)
    """
    bulk: list[dict] = []
    url = f"{API}?limit=100"
    while url:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.load(resp)
        bulk.extend(data["response"]["items"])
        url = data["response"].get("next_url")
        if url:
            time.sleep(0.3)

    print(f"  bulk fetched: {len(bulk)} episodes; resolving episode_number per-id...", file=sys.stderr)
    by_number: dict[int, dict] = {}
    by_title: dict[str, dict] = {}
    for i, ep in enumerate(bulk, 1):
        ep_id = ep["episode_id"]
        title = ep.get("title", "")
        record = {
            "duration_ms": ep["duration"],
            "download_url": ep["download_url"],
            "title": title,
        }
        # Always populate by_title for fallback
        by_title[normalize_title(title)] = record
        # Try per-episode call for episode_number
        try:
            detail = fetch_episode_detail(ep_id)
            num = detail.get("episode_number")
            if num and num > 0:
                by_number[int(num)] = record
        except Exception as e:
            print(f"  [WARN] episode_id={ep_id} fetch failed: {e}", file=sys.stderr)
        if i % 25 == 0:
            print(f"  progress: {i}/{len(bulk)}", file=sys.stderr)
        time.sleep(0.05)
    return by_number, by_title


def get_hugo_title(path: pathlib.Path) -> str:
    """Read title from front matter."""
    text = path.read_text(encoding="utf-8")
    m = re.search(r"^title:\s*['\"]?(.+?)['\"]?\s*$", text, re.M)
    return m.group(1) if m else ""


def update_frontmatter(path: pathlib.Path, duration_iso: str, audio_url: str) -> str:
    """In-place YAML frontmatter rewrite. Returns 'updated'/'skipped'/'no-match'."""
    text = path.read_text(encoding="utf-8")
    m = re.match(r"(---\n)(.+?)(\n---\n)", text, re.S)
    if not m:
        return "no-match"
    fm = m.group(2)

    # Replace or append duration
    new_dur = f'duration: "{duration_iso}"'
    if re.search(r"^duration:\s*.*$", fm, re.M):
        fm_new = re.sub(r"^duration:\s*.*$", new_dur, fm, count=1, flags=re.M)
    else:
        fm_new = fm + "\n" + new_dur

    # Replace or append audio_url
    new_url = f'audio_url: "{audio_url}"'
    if re.search(r"^audio_url:\s*.*$", fm_new, re.M):
        fm_new = re.sub(r"^audio_url:\s*.*$", new_url, fm_new, count=1, flags=re.M)
    else:
        fm_new = fm_new + "\n" + new_url

    if fm_new == fm:
        return "skipped"

    new_text = m.group(1) + fm_new + m.group(3) + text[m.end():]
    path.write_text(new_text, encoding="utf-8")
    return "updated"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="Tylko pokaz mapping, bez zapisu")
    args = ap.parse_args()

    print(f"Fetching Spreaker episodes from show {SHOW_ID}...", file=sys.stderr)
    by_number, by_title = fetch_all_episodes()
    print(f"  -> {len(by_number)} mappable by episode_number, {len(by_title)} by title", file=sys.stderr)

    files = sorted(EPISODES_DIR.glob("*.md"))
    print(f"Local Hugo episodes: {len(files)}", file=sys.stderr)

    counts = {"updated": 0, "skipped": 0, "no-match": 0, "missing-spreaker": 0,
              "matched-by-number": 0, "matched-by-title": 0}
    for f in files:
        m = re.match(r"^(\d+)\.md$", f.name)
        if not m:
            continue
        num = int(m.group(1))

        # Try match by number first
        sp = by_number.get(num)
        match_method = "number"
        if not sp:
            # Fallback: match by normalized title
            hugo_title = get_hugo_title(f)
            norm = normalize_title(hugo_title)
            sp = by_title.get(norm)
            match_method = "title" if sp else None

        if not sp:
            counts["missing-spreaker"] += 1
            print(f"  [MISS] #{num}: '{normalize_title(get_hugo_title(f))[:50]}' not in Spreaker", file=sys.stderr)
            continue

        counts[f"matched-by-{match_method}"] += 1
        duration = ms_to_iso8601(sp["duration_ms"])
        audio_url = sp["download_url"]

        if args.dry_run:
            print(f"  [DRY/{match_method}] #{num}: {duration} {audio_url}", file=sys.stderr)
            counts["updated"] += 1
            continue

        result = update_frontmatter(f, duration, audio_url)
        counts[result] += 1
        if result == "updated":
            print(f"  [OK/{match_method}] #{num}: {duration} ({sp['title'][:40]})", file=sys.stderr)

    print("", file=sys.stderr)
    print(f"=== SUMMARY ===", file=sys.stderr)
    for k, v in counts.items():
        print(f"  {k}: {v}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
