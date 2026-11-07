#!/usr/bin/env python3
"""Bind evaluation files to a run; check integrity, never behavioral success."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from datetime import datetime, timezone


class RecordError(ValueError):
    pass


def stamp():
    return datetime.now(timezone.utc).isoformat()


def relative(root, name):
    path = Path(name)
    path = path if path.is_absolute() else root / path
    path = path.resolve()
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        raise RecordError(f"Path is outside root: {name}") from None


def identity(root, name):
    name = relative(root, name)
    path = root / name
    if not path.is_file():
        raise RecordError(f"Missing regular file: {name}")
    data = path.read_bytes()
    return {"path": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def require(condition, message):
    if not condition:
        raise RecordError(message)


def validate_identity(item):
    require(isinstance(item, dict) and set(item) == {"path", "sha256", "bytes"}, "Malformed file identity")
    require(isinstance(item["path"], str) and bool(item["path"]), "Invalid file path")
    require(isinstance(item["sha256"], str) and len(item["sha256"]) == 64
            and all(c in "0123456789abcdef" for c in item["sha256"]), "Invalid SHA-256")
    require(type(item["bytes"]) is int and item["bytes"] >= 0, "Invalid file size")


def validate(data):
    require(isinstance(data, dict) and data.get("schema") == 1, "Unsupported or missing schema")
    require(data.get("stage") in ("started", "finished"), "Invalid stage")
    require(isinstance(data.get("root"), str) and Path(data["root"]).is_absolute(), "Invalid root")
    require(isinstance(data.get("created_at"), str), "Missing creation time")
    declaration = data.get("declared")
    require(isinstance(declaration, dict), "Missing declarations")
    require(declaration.get("session_mode") in ("fresh", "continuation", "unknown"), "Invalid session mode")
    for name in ("model", "tools"):
        require(isinstance(declaration.get(name), str) and bool(declaration[name]), f"Invalid {name}")
    require(data.get("isolation_check") == "not-performed", "This helper cannot attest isolation")
    for name in ("skills", "inputs"):
        require(isinstance(data.get(name), list) and bool(data[name]), f"Missing {name}")
        for item in data[name]:
            validate_identity(item)
    require(isinstance(data.get("expected_outputs"), list) and bool(data["expected_outputs"]), "Missing expected outputs")
    require(all(isinstance(p, str) and bool(p) for p in data["expected_outputs"]), "Invalid expected output path")
    if data["stage"] == "finished":
        validate_identity(data.get("start_record"))
        require(isinstance(data.get("finished_at"), str), "Missing finish time")
        for name in ("outputs", "evidence"):
            require(isinstance(data.get(name), list) and bool(data[name]), f"Missing {name}")
            for item in data[name]:
                validate_identity(item)
        require([i["path"] for i in data["outputs"]] == data["expected_outputs"], "Output list differs from expected outputs")


def read(path):
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, UnicodeError) as exc:
        raise RecordError(f"Invalid JSON: {exc}") from None
    validate(data)
    return data


def check_files(data, root):
    groups = ["skills", "inputs"]
    if data["stage"] == "finished":
        groups += ["outputs", "evidence"]
    for group in groups:
        for expected in data[group]:
            require(identity(root, expected["path"]) == expected, f"File changed: {expected['path']}")
    for name in data["expected_outputs"]:
        require(relative(root, name) == name, f"Non-canonical output path: {name}")
    if data["stage"] == "finished":
        expected = data["start_record"]
        require(identity(root, expected["path"]) == expected, "Start record changed")
        start = read(root / expected["path"])
        require(start["stage"] == "started", "Start reference is not a started record")
        require(all(start.get(k) == data.get(k) for k in start if k != "stage"), "Finished record differs from start declaration")


def write_new(path, data):
    validate(data)
    # Exclusive creation protects earlier outcomes, including failed experiments.
    with path.open("x") as output:
        output.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    commands = p.add_subparsers(dest="command", required=True)
    start = commands.add_parser("start", help="Capture files before executing an evaluation")
    start.add_argument("--record", required=True, type=Path, help="New JSON file; parent directory must exist")
    start.add_argument("--root", required=True, type=Path, help="Directory containing all bound files and records")
    for name in ("skill", "input", "expect"):
        start.add_argument("--" + name, required=True, action="append", help="File path relative to root or absolute; repeatable")
    start.add_argument("--session-mode", choices=("fresh", "continuation", "unknown"), default="unknown", help="Declaration only; host evidence must support any isolation claim")
    start.add_argument("--model", default="unknown", help="Declared model/version or unknown")
    start.add_argument("--tools", default="unknown", help="Declared host/tool versions or unknown")
    finish = commands.add_parser("finish", help="Bind existing outputs and execution evidence in a new record")
    finish.add_argument("--start", required=True, type=Path)
    finish.add_argument("--record", required=True, type=Path)
    finish.add_argument("--evidence", required=True, action="append", help="Actual host trace, command output, or other run evidence; repeatable")
    finish.add_argument("--root", type=Path, help="Relocated root retaining the recorded relative layout")
    verify = commands.add_parser("verify", help="Check recorded file integrity; a zero exit is not evaluation success")
    verify.add_argument("--record", required=True, type=Path)
    verify.add_argument("--root", type=Path, help="Relocated root retaining the recorded relative layout")
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        if args.command == "start":
            root = args.root.resolve()
            relative(root, args.record.resolve())
            data = {"schema": 1, "stage": "started", "root": str(root), "created_at": stamp(),
                    "declared": {"session_mode": args.session_mode, "model": args.model, "tools": args.tools},
                    "isolation_check": "not-performed",
                    "skills": [identity(root, p) for p in args.skill],
                    "inputs": [identity(root, p) for p in args.input],
                    "expected_outputs": [relative(root, p) for p in args.expect]}
            require(len(set(data["expected_outputs"])) == len(data["expected_outputs"]), "Duplicate expected output")
            for output in data["expected_outputs"]:
                require(not (root / output).exists(), f"Output already exists: {output}; choose a new trial path")
            write_new(args.record, data)
        else:
            path = args.start if args.command == "finish" else args.record
            data = read(path)
            root = (args.root or Path(data["root"])).resolve()
            check_files(data, root)
            if args.command == "finish":
                require(data["stage"] == "started", "Finish requires a started record")
                relative(root, args.record.resolve())
                data = dict(data, stage="finished", finished_at=stamp(), start_record=identity(root, path.resolve()),
                            outputs=[identity(root, p) for p in data["expected_outputs"]],
                            evidence=[identity(root, p) for p in args.evidence])
                write_new(args.record, data)
        print(json.dumps({"stage": data["stage"], "file_integrity": "checked", "isolation_check": "not-performed",
                          "evaluation_outcome": "not-assessed"}))
        return 0
    except (OSError, RecordError) as exc:
        print(f"evaluation-record: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
