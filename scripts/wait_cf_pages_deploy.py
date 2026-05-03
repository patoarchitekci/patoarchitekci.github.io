#!/usr/bin/env python3
"""
Poll Cloudflare Pages API until the deployment matching a given git SHA
reaches the `success` stage. Exits non-zero on timeout or build failure.

Required env vars:
    CF_API_TOKEN       Cloudflare API token (Cloudflare Pages: Read)
    CF_ACCOUNT_ID      Cloudflare account ID
    CF_PAGES_PROJECT   Pages project name (e.g. patoarchitekci-io)

Usage:
    python scripts/wait_cf_pages_deploy.py --sha <sha> [--timeout 900]
"""
import argparse
import os
import sys
import time

import requests


def find_deployment(token: str, account: str, project: str, sha: str) -> dict | None:
    """Return latest production deployment for the given commit SHA, or None."""
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{account}"
        f"/pages/projects/{project}/deployments?per_page=25&env=production"
    )
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=20)
    r.raise_for_status()
    payload = r.json()
    if not payload.get("success"):
        raise RuntimeError(f"CF API error: {payload.get('errors')}")
    for d in payload.get("result", []):
        commit = (d.get("deployment_trigger") or {}).get("metadata", {}).get(
            "commit_hash"
        )
        if commit and commit.startswith(sha) or (commit and sha.startswith(commit)):
            return d
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sha", required=True, help="git commit SHA to wait for")
    parser.add_argument(
        "--timeout", type=int, default=900, help="max wait in seconds (default 900)"
    )
    parser.add_argument(
        "--interval", type=int, default=15, help="poll interval seconds (default 15)"
    )
    args = parser.parse_args()

    token = os.environ["CF_API_TOKEN"]
    account = os.environ["CF_ACCOUNT_ID"]
    project = os.environ["CF_PAGES_PROJECT"]

    deadline = time.time() + args.timeout
    last_stage = None
    while time.time() < deadline:
        deploy = find_deployment(token, account, project, args.sha)
        if deploy:
            stage = deploy["latest_stage"]["name"]
            status = deploy["latest_stage"]["status"]
            if (stage, status) != last_stage:
                print(
                    f"[{time.strftime('%H:%M:%S')}] {deploy['short_id']} "
                    f"stage={stage} status={status}",
                    flush=True,
                )
                last_stage = (stage, status)
            if stage == "deploy" and status == "success":
                print(f"OK: deployment {deploy['short_id']} live", flush=True)
                return 0
            if status == "failure":
                print(
                    f"FAIL: deployment {deploy['short_id']} failed at stage {stage}",
                    file=sys.stderr,
                )
                return 2
        else:
            print(
                f"[{time.strftime('%H:%M:%S')}] waiting for deployment of {args.sha[:8]}...",
                flush=True,
            )
        time.sleep(args.interval)

    print(
        f"TIMEOUT after {args.timeout}s waiting for deployment of {args.sha[:8]}",
        file=sys.stderr,
    )
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
