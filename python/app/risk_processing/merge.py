"""Merge per-chunk extraction objects into one."""

from __future__ import annotations

from typing import Any

from app.risk_processing.description_utils import normalize_narrative_text


def merge_extractions(objs: list[dict[str, Any]]) -> dict[str, Any]:
    if not objs:
        raise ValueError("no extractions to merge")
    if len(objs) == 1:
        return objs[0]

    base = dict(objs[0])
    risk = dict(base.get("risk") or {})
    descriptions: list[str] = []

    for o in objs:
        r = o.get("risk") or {}
        desc = (r.get("description") or "").strip()
        if desc:
            descriptions.append(desc)

    if descriptions:
        combined = " ".join(descriptions[:5])
        risk["description"] = normalize_narrative_text(combined)
    base["risk"] = risk

    meta = dict(base.get("_meta") or {})
    meta["merged_from"] = len(objs)
    base["_meta"] = meta
    return base
