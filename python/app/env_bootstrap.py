"""Load repo env files before LLM backend modules read os.environ."""

from __future__ import annotations

import os
from pathlib import Path


def bootstrap_env() -> None:
    root = Path(__file__).resolve().parents[2]

    try:
        from dotenv import load_dotenv
    except ImportError:
        load_dotenv = None  # type: ignore[assignment,misc]

    if load_dotenv is not None:
        for name in (".env.local", ".env"):
            path = root / "backend" / name
            if path.is_file():
                load_dotenv(path)
        py_env = root / "python" / ".env"
        if py_env.is_file():
            load_dotenv(py_env)

    if os.getenv("AWS_ACCESS_KEY_ID", "").strip() or os.getenv(
        "BEDROCK_MODEL_ID", ""
    ).strip():
        os.environ["USE_BEDROCK"] = "true"
    region = (
        os.getenv("AWS_REGION", "").strip()
        or os.getenv("AWS_DEFAULT_REGION", "").strip()
    )
    if region:
        os.environ.setdefault("AWS_REGION", region)
    if os.getenv("BEDROCK_MODEL_ID", "").strip() and not os.getenv(
        "BEDROCK_MODEL", ""
    ).strip():
        os.environ.setdefault("BEDROCK_MODEL", os.environ["BEDROCK_MODEL_ID"])
