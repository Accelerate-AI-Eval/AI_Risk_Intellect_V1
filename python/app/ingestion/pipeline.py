"""Port of app.ingestion.pipeline — validate PDF and raw text for ingestion."""

from __future__ import annotations

from typing import Any

from .extract_text import extract_from_pdf, extract_from_raw
from .filters import SkipIngest, classify_ai_related


def _check_ai(text: str, *, url: str = "", title: str = "") -> dict[str, Any]:
    ok, details = classify_ai_related(text, title=title, url=url)
    if not ok:
        raise SkipIngest(
            f"not ai-related (inc={details['include_hits']}, "
            f"exc={details['exclude_hits']}, thr={details['threshold']})"
        )
    return details


def prepare_pdf_ingest(
    pdf_bytes: bytes,
    *,
    url: str = "",
    title: str = "",
    skip_ai_check: bool = False,
) -> dict[str, Any]:
    """Same checks as ingest_pdf without DB persist (for Node bridge)."""
    text = extract_from_pdf(pdf_bytes)
    if len(text.strip()) < 500:
        raise SkipIngest("pdf text too small")
    details: dict[str, Any] = {}
    if not skip_ai_check:
        details = _check_ai(text, url=url, title=title)
    return {"text": text, "title": title or url, "details": details}


def prepare_html_ingest(
    html: str,
    *,
    url: str = "",
    title: str = "",
    skip_ai_check: bool = False,
) -> dict[str, Any]:
    """Extract article text from HTML (trafilatura) for the Node worker."""
    from .extract_text import extract_from_html

    text = extract_from_html(html)
    if len(text.strip()) < 200:
        raise SkipIngest("html text too small")
    details: dict[str, Any] = {}
    if not skip_ai_check:
        details = _check_ai(text, url=url, title=title)
    return {"text": text, "title": title or url, "details": details}


def prepare_raw_ingest(
    raw: str,
    *,
    url: str = "",
    title: str = "",
) -> dict[str, Any]:
    """Same checks as ingest_raw_text without DB persist (for Node bridge)."""
    text = extract_from_raw(raw)
    if len(text.strip()) < 200:
        raise SkipIngest("raw text too small")
    details = _check_ai(text, url=url, title=title)
    return {"text": text, "title": title or url, "details": details}


# Full pipeline stubs when persist is implemented in Python later.
def ingest_pdf(pdf_bytes: bytes, *, url: str = "", title: str = ""):
    return prepare_pdf_ingest(pdf_bytes, url=url, title=title)


def ingest_raw_text(text: str, *, url: str = "", title: str = ""):
    return prepare_raw_ingest(text, url=url, title=title)
