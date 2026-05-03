#!/usr/bin/env python3
"""
Send IndexNow ping to all participating search engines for a list of URLs.

Required env vars:
    INDEXNOW_KEY            32-hex IndexNow key (matches /<key>.txt on origin)
    INDEXNOW_KEY_LOCATION   Full URL to key file, e.g. https://patoarchitekci.io/<key>.txt

Usage:
    python scripts/ping_indexnow.py urls.txt
"""
import os
import sys
import time

import requests

# Distinct IndexNow endpoints. Per spec one POST is shared with all participants,
# but pinging each explicitly is safer (faster propagation, observability per engine).
ENDPOINTS = [
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
    "https://searchadvisor.naver.com/indexnow",
    "https://search.seznam.cz/indexnow",
    "https://indexnow.yep.com/indexnow",
]

HOST = "patoarchitekci.io"


def load_urls(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip()]
    if not urls:
        raise SystemExit(f"No URLs in {path}")
    if len(urls) > 10000:
        raise SystemExit(f"Too many URLs ({len(urls)}); IndexNow max is 10000 per call")
    return urls


def post_with_retry(endpoint: str, payload: dict, attempts: int = 3) -> bool:
    for attempt in range(1, attempts + 1):
        try:
            r = requests.post(endpoint, json=payload, timeout=20)
        except requests.RequestException as exc:
            print(f"  attempt {attempt}: network error: {exc}", flush=True)
            time.sleep(5 * attempt)
            continue
        body = (r.text or "")[:200].replace("\n", " ")
        print(f"  attempt {attempt}: HTTP {r.status_code} {body}", flush=True)
        if r.status_code in (200, 202):
            return True
        # 4xx is final - retrying won't help
        if 400 <= r.status_code < 500:
            return False
        time.sleep(5 * attempt)
    return False


def main() -> int:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} urls.txt", file=sys.stderr)
        return 64

    urls = load_urls(sys.argv[1])
    payload = {
        "host": HOST,
        "key": os.environ["INDEXNOW_KEY"],
        "keyLocation": os.environ["INDEXNOW_KEY_LOCATION"],
        "urlList": urls,
    }

    print(f"Pinging IndexNow for {len(urls)} URL(s):", flush=True)
    for u in urls:
        print(f"  - {u}", flush=True)
    print()

    failed: list[str] = []
    for endpoint in ENDPOINTS:
        print(f"-> {endpoint}", flush=True)
        if not post_with_retry(endpoint, payload):
            failed.append(endpoint)

    if failed:
        print(f"\nFAIL: {len(failed)}/{len(ENDPOINTS)} endpoints failed:", file=sys.stderr)
        for ep in failed:
            print(f"  - {ep}", file=sys.stderr)
        return 1

    print(f"\nOK: all {len(ENDPOINTS)} endpoints accepted", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
