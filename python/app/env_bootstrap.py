"""Load repo env files before LLM backend modules read os.environ."""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger("airisk")

DEFAULT_BEDROCK_MODEL = "claude-haiku-4-5"
_LEGACY_BEDROCK_MARKERS = (
    "claude-3-sonnet",
    "20240229",
    ":200k",
)


def _normalize_bedrock_model(model_id: str) -> str:
    trimmed = model_id.strip()
    if not trimmed:
        return DEFAULT_BEDROCK_MODEL

    lowered = trimmed.lower()
    if any(marker in lowered for marker in _LEGACY_BEDROCK_MARKERS):
        logger.warning(
            "Replacing legacy Bedrock model %s with %s",
            trimmed,
            DEFAULT_BEDROCK_MODEL,
        )
        return DEFAULT_BEDROCK_MODEL

    return trimmed


def _normalize_bedrock_env() -> None:
    if os.getenv("USE_BEDROCK", "false").lower() != "true":
        return

    raw_model = (
        os.getenv("BEDROCK_MODEL", "").strip()
        or os.getenv("BEDROCK_MODEL_ID", "").strip()
    )
    resolved = _normalize_bedrock_model(raw_model)
    os.environ["BEDROCK_MODEL"] = resolved
    os.environ["BEDROCK_MODEL_ID"] = resolved


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

    _normalize_bedrock_env()
