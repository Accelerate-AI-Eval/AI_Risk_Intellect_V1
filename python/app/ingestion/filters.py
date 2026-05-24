"""Port of app.ingestion.filters — soft 404 and AI-topic classification."""

from __future__ import annotations

import re
from typing import Any

from .errors import SkipIngest

__all__ = ["SkipIngest", "looks_like_soft_404", "classify_ai_related"]

SOFT_404_PAT = re.compile(
    r"(404|not\s+found|page\s+not\s+found|page\s+removed|gone|error\s+404)",
    re.I,
)

AI_INCLUDE = [
    re.compile(r"\b(ai|artificial intelligence)\b", re.I),
    re.compile(r"\b(llm|large language model|language model)\b", re.I),
    re.compile(r"\b(machine learning|ml|deep learning|neural network)\b", re.I),
    re.compile(
        r"\b(embedding|token|inference|fine[- ]?tuning|rlhf|safety|alignment)\b",
        re.I,
    ),
    re.compile(r"\b(prompt|prompt injection|jailbreak|hallucination|red teaming)\b", re.I),
    re.compile(r"\b(model weights?|training data|dataset|inference api)\b", re.I),
    re.compile(r"\b(privacy|pii|data leakage|governance|compliance) in (ai|ml)\b", re.I),
]

AI_EXCLUDE = [
    re.compile(r"\b(sports|football|basketball|baseball|soccer|golf|tennis)\b", re.I),
    re.compile(r"\b(recipes?|cooking|travel|tourism|celebrity|fashion|beauty)\b", re.I),
    re.compile(r"\b(stock photos?|coupon|promo|giveaway)\b", re.I),
]


def looks_like_soft_404(
    html: str,
    status: int,
    *,
    extracted_text: str | None = None,
    min_text_bytes: int = 500,
) -> bool:
    if status in (404, 410, 451):
        return True
    if html and SOFT_404_PAT.search((html or "")[:2000]):
        return True
    if extracted_text is not None and len(extracted_text.strip()) < min_text_bytes:
        return True
    return False


def _hit_count(text: str, patterns: list[re.Pattern[str]]) -> int:
    low = (text or "").lower()
    return sum(1 for p in patterns if p.search(low))


def classify_ai_related(
    text: str,
    *,
    title: str = "",
    url: str = "",
    include_threshold: int = 2,
) -> tuple[bool, dict[str, Any]]:
    blob = " ".join([title, url, text]).strip()
    include_hits = _hit_count(blob, AI_INCLUDE)
    exclude_hits = _hit_count(blob, AI_EXCLUDE)
    ok = (include_hits - exclude_hits) >= include_threshold
    details = {
        "include_hits": include_hits,
        "exclude_hits": exclude_hits,
        "threshold": include_threshold,
    }
    return ok, details
