#!/usr/bin/env python3
"""CLI wrapper for a single manual setup. Batch runs use broker.py instead.

Usage:
  python scripts/setup.py <ID>        # ID in conditions.yaml (VC, SD-S, SD-D, CO-S, CO-D)
"""
import argparse

import harness
import llm


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cid", choices=list(harness.load_conditions()))
    ap.add_argument("--maker", choices=["claude", "codex"])
    ap.add_argument("--director", choices=["claude", "codex"])
    args = ap.parse_args()
    harness.setup(args.cid, llm.select("maker", args.maker), llm.select("director", args.director))
    print("[setup] containers ready for manual calls through harness.run_llm; broker.py starts a fresh run")
    print("[setup] end:  python scripts/teardown.py")


if __name__ == "__main__":
    main()
