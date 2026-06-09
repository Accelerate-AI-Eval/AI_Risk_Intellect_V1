"""CLI bridge for Node.js ETL imports."""

from __future__ import annotations

import base64
import json
import sys

from app.env_bootstrap import bootstrap_env

bootstrap_env()

from app.etl.pipeline import prepare_etl_import


def main() -> int:
    try:
        req = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        json.dump({"ok": False, "error": "InvalidJSON", "message": str(exc)}, sys.stdout)
        return 1

    filename = req.get("filename") or ""
    file_base64 = req.get("file_base64") or ""

    try:
        file_bytes = base64.b64decode(file_base64)
    except Exception as exc:
        json.dump({"ok": False, "error": "InvalidBase64", "message": str(exc)}, sys.stdout)
        return 1

    if not file_bytes:
        json.dump({"ok": False, "error": "EmptyFile", "message": "uploaded file is empty"}, sys.stdout)
        return 0

    try:
        result = prepare_etl_import(file_bytes, filename)
        json.dump({"ok": True, **result}, sys.stdout)
        return 0
    except ValueError as exc:
        json.dump({"ok": False, "error": "InvalidFile", "message": str(exc)}, sys.stdout)
        return 0
    except Exception as exc:
        json.dump({"ok": False, "error": type(exc).__name__, "message": str(exc)}, sys.stdout)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
