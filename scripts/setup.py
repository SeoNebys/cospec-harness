#!/usr/bin/env python3
"""CLI wrapper for a single manual setup. Batch runs use broker.py instead.

Usage:
  python scripts/setup.py <ID>        # ID in conditions.yaml (VC, SD-S, SD-D, CO-S, CO-D)
"""
import argparse

import harness


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cid", choices=list(harness.load_conditions()))
    args = ap.parse_args()
    harness.setup(args.cid)
    print("[setup] next: python scripts/broker.py <ID>  (or drive containers manually)")
    print("[setup] end:  python scripts/teardown.py")


if __name__ == "__main__":
    main()
