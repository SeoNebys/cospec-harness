#!/usr/bin/env python3
"""Extract clean assistant (maker/director) text from a Claude Code transcript jsonl.

Tool calls and file contents (prototype HTML / implementation source) are
excluded, so this yields only the spoken turn — preventing source leakage when
inspecting archived sessions. The live broker loop uses the `--output-format
json` `result` field directly; this module is for post-hoc analysis of the
archived transcript jsonl files.

Note: the Claude Code transcript schema can vary by version. Validate the
extraction rule against a first real session's jsonl.

Usage:
  python scripts/transcript.py <dir|jsonl> [--n K]
"""
import glob
import json
import os
import sys


def latest_jsonl(path: str) -> str:
    if os.path.isfile(path):
        return path
    files = glob.glob(os.path.join(path, "**", "*.jsonl"), recursive=True)
    if not files:
        sys.exit(f"no jsonl found under: {path}")
    return max(files, key=os.path.getmtime)


def assistant_text(obj: dict) -> str | None:
    m = obj.get("message", obj)
    role = obj.get("type") or m.get("role")
    if role != "assistant":
        return None
    content = m.get("content")
    if isinstance(content, str):
        return content.strip() or None
    if isinstance(content, list):
        parts = [b.get("text", "") for b in content
                 if isinstance(b, dict) and b.get("type") == "text"]
        joined = "\n".join(p for p in parts if p).strip()
        return joined or None
    return None


def turns_of(path: str) -> list[str]:
    out = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            t = assistant_text(obj)
            if t:
                out.append(t)
    return out


def main() -> None:
    args = sys.argv[1:]
    n = 1
    if "--n" in args:
        i = args.index("--n")
        n = int(args[i + 1])
        del args[i:i + 2]
    if not args:
        sys.exit("usage: python scripts/transcript.py <dir|jsonl> [--n K]")
    turns = turns_of(latest_jsonl(args[0]))
    if not turns:
        sys.exit("no assistant turns found (check schema)")
    for t in turns[-n:]:
        print(t)
        print("\n---\n")


if __name__ == "__main__":
    main()
