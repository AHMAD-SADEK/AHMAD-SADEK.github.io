#!/usr/bin/env python3
"""Build a public, static archive from explicitly published owner-authored issues.

The site never trusts browser-side issue bodies as publication authority. Only open
issues authored by the repository owner and explicitly marked Published are exported.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "archive.json"
OWNER_LOGIN = "AHMAD-SADEK"

SCHEMAS: dict[str, list[str]] = {
    "writing": [
        "Content Type", "Category", "Language", "Publication Status", "Title",
        "Subtitle", "Author", "Date", "Tags", "Reading Time", "Cover Image",
        "Abstract / Summary", "Content", "Second Language Version", "References", "PDF / Files",
    ],
    "book": [
        "Content Type", "Category", "Language", "Publication Status", "Title",
        "Subtitle", "Author", "Date", "Tags", "Cover Image", "Description / Summary",
        "Content", "Second Language Version", "References / Notes", "PDF / Files",
    ],
    "idea": [
        "Content Type", "Category", "Language", "Publication Status", "Title",
        "Date", "Tags", "Content",
    ],
    "personal": [
        "Content Type", "Category", "Language", "Publication Status", "Title",
        "Subtitle", "Date", "Tags", "Cover Image", "Content", "Second Language Version",
    ],
    "project": [
        "Content Type", "Category", "Language", "Publication Status", "Title",
        "Subtitle", "Project Status", "Technologies", "Date", "Tags", "Cover Image",
        "Summary", "Content", "Second Language Version", "Links", "PDF / Files",
    ],
    "research": [
        "Content Type", "Category", "Language", "Publication Status", "Title",
        "Subtitle", "Authors", "Date", "Keywords", "Cover Image", "Abstract / Summary",
        "Introduction", "Methodology", "Results", "Discussion", "Conclusion",
        "Content", "Second Language Version", "References", "PDF / Files",
    ],
}

TYPE_ALIASES = {
    "article / مقال": "writing", "article": "writing", "مقال": "writing",
    "writing": "writing", "research / بحث": "research", "research": "research",
    "بحث": "research", "book / كتاب": "book", "book": "book", "كتاب": "book",
    "project / مشروع": "project", "project": "project", "مشروع": "project",
    "idea / فكرة": "idea", "idea": "idea", "فكرة": "idea",
    "personal / شخصي": "personal", "personal": "personal", "شخصي": "personal",
}
CATEGORY_ALIASES = {
    "medicine & pharmacy / الطب والصيدلة": "pharmacy", "medicine & pharmacy": "pharmacy",
    "pharmacy": "pharmacy", "medicine": "pharmacy", "الطب والصيدلة": "pharmacy",
    "engineering & technology / الهندسة والتقنية": "engineering",
    "engineering & technology": "engineering", "engineering": "engineering",
    "technology": "engineering", "الهندسة والتقنية": "engineering",
    "thought & philosophy / الفكر والفلسفة": "thought", "thought & philosophy": "thought",
    "thought": "thought", "philosophy": "thought", "humanities": "thought",
    "الفكر والفلسفة": "thought", "personal / المساحة الشخصية": "personal",
    "personal": "personal", "المساحة الشخصية": "personal", "academic / أكاديمي": "academic",
    "academic": "academic", "أكاديمي": "academic", "general / عام": "general",
    "general": "general", "عام": "general",
}
HEADER_RE = re.compile(r"^\s*###\s+(.+?)\s*$")
URL_RE = re.compile(r"https?://[^\s<>\])}]+", re.IGNORECASE)
MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", re.IGNORECASE)


def normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\r", "").strip()).lower()


def clean_value(value: str) -> str:
    value = value.strip()
    if normalize(value) in {"_no response_", "no response", "(no response)"}:
        return ""
    return value


def content_type_from_body(body: str, fallback_title: str = "") -> str:
    match = re.search(r"^\s*###\s+Content Type\s*\n(.*?)(?=^\s*###\s+|\Z)", body or "", re.M | re.S)
    raw = clean_value(match.group(1)) if match else ""
    type_key = normalize(raw)
    if type_key in TYPE_ALIASES:
        return TYPE_ALIASES[type_key]
    title_match = re.match(r"^\s*\[(Article|Research|Book|Project|Idea|Personal)\]", fallback_title or "", re.I)
    if title_match:
        return TYPE_ALIASES.get(title_match.group(1).lower(), "")
    return ""


def parse_form_fields(body: str, schema: list[str]) -> dict[str, str]:
    lines = (body or "").replace("\r", "").split("\n")
    headers: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        match = HEADER_RE.match(line)
        if match:
            headers.append((index, match.group(1).strip()))

    start = next((i for i, name in headers if normalize(name) == "content type"), None)
    if start is None:
        return {}

    matched: list[tuple[str, int]] = [("Content Type", start)]
    cursor = start
    for expected in schema[1:]:
        expected_norm = normalize(expected)
        found = next(
            ((i, name) for i, name in headers
             if i > cursor and normalize(name) == expected_norm),
            None,
        )
        if found is None:
            continue
        cursor, _ = found
        matched.append((expected, cursor))

    fields: dict[str, str] = {}
    for position, (name, line_index) in enumerate(matched):
        next_index = matched[position + 1][1] if position + 1 < len(matched) else len(lines)
        fields[name] = clean_value("\n".join(lines[line_index + 1:next_index]))
    return fields


def legacy_fields(body: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    current: str | None = None
    buffers: list[str] = []
    known = {
        "title", "subtitle", "author", "authors", "category", "language", "date",
        "tags", "keywords", "reading time", "cover image", "abstract", "abstract / summary",
        "description / summary", "summary", "content", "second language version",
        "references", "references / notes", "pdf / files", "links", "publication status",
        "project status", "technologies", "introduction", "methodology", "results",
        "discussion", "conclusion",
    }

    def flush() -> None:
        if current is not None:
            fields[current] = clean_value("\n".join(buffers))

    for line in (body or "").replace("\r", "").split("\n"):
        match = re.match(r"^\s*([A-Za-z][A-Za-z /-]+?)\s*:\s*(.*)$", line)
        key = normalize(match.group(1)) if match else ""
        if match and key in known:
            flush()
            current = key
            buffers = [match.group(2)]
        elif current is not None:
            buffers.append(line)
    flush()
    return fields


def field(fields: dict[str, str], *names: str) -> str:
    by_normalized = {normalize(key): value for key, value in fields.items()}
    for name in names:
        value = clean_value(by_normalized.get(normalize(name), ""))
        if value:
            return value
    return ""


def explicitly_published(fields: dict[str, str]) -> bool:
    status = normalize(field(fields, "Publication Status"))
    return bool(re.fullmatch(r"(?:published(?:\s*/\s*منشور)?|منشور)", status))


def category_key(raw: str) -> str:
    return CATEGORY_ALIASES.get(normalize(raw), "general" if not raw else "general")


def parse_date(raw: str, created_at: str) -> str:
    value = raw.strip()
    try:
        return date.fromisoformat(value[:10]).isoformat()
    except (ValueError, TypeError):
        pass
    try:
        return datetime.fromisoformat(created_at.replace("Z", "+00:00")).date().isoformat()
    except (ValueError, TypeError, AttributeError):
        return datetime.now(timezone.utc).date().isoformat()


def allowed_url(value: str) -> str:
    value = value.strip().strip("<>")
    try:
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme in {"https", "http"} and parsed.netloc:
            return value
    except ValueError:
        pass
    return ""


def image_url(raw: str) -> str:
    match = re.search(r"<img\b[^>]*\bsrc\s*=\s*([\"'])(.*?)\1", raw, re.I | re.S)
    candidate = match.group(2) if match else ""
    if not candidate:
        match = re.search(r"!\[[^\]]*\]\((https?://[^)\s]+)\)", raw, re.I)
        candidate = match.group(1) if match else ""
    if not candidate:
        match = URL_RE.search(raw)
        candidate = match.group(0) if match else ""
    return allowed_url(candidate) if candidate else ""


def extract_links(raw: str) -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    for label, url in MARKDOWN_LINK_RE.findall(raw or ""):
        valid = allowed_url(url)
        if valid:
            found.append({"label": label.strip() or "Open file", "url": valid})
    known = {item["url"] for item in found}
    for url in URL_RE.findall(raw or ""):
        valid = allowed_url(url.rstrip(".,;"))
        if valid and valid not in known:
            name = urllib.parse.urlparse(valid).path.rsplit("/", 1)[-1] or "Open attachment"
            found.append({"label": name, "url": valid})
            known.add(valid)
    return found


def split_tags(raw: str) -> list[str]:
    return list(dict.fromkeys(item.strip() for item in re.split(r"[,;\n]", raw or "") if item.strip()))[:30]


def build_item(issue: dict[str, Any]) -> dict[str, Any] | None:
    if issue.get("pull_request") or issue.get("state") != "open":
        return None
    user = issue.get("user") or {}
    if normalize(user.get("login")) != normalize(OWNER_LOGIN):
        return None

    body = issue.get("body") or ""
    kind = content_type_from_body(body, issue.get("title", ""))
    if kind not in SCHEMAS:
        return None

    fields = parse_form_fields(body, SCHEMAS[kind])
    if not fields:
        fields = legacy_fields(body)
    if not explicitly_published(fields):
        return None

    title = field(fields, "Title")
    if not title:
        title = re.sub(r"^\s*\[(?:New Content|Article|Research|Book|Project|Idea|Personal)\]\s*", "", issue.get("title", "")).strip()
    if not title or title.startswith("["):
        return None

    content = field(fields, "Content")
    if kind == "research":
        structured = []
        for key in ("Introduction", "Methodology", "Results", "Discussion", "Conclusion"):
            value = field(fields, key)
            if value:
                structured.append("## " + key + "\n\n" + value)
        if structured and content:
            content = "\n\n".join(structured + [content])
        elif structured:
            content = "\n\n".join(structured)
    if not content.strip() and not field(fields, "Abstract / Summary", "Description / Summary", "Summary"):
        return None

    summary = field(fields, "Abstract / Summary", "Description / Summary", "Summary")
    abstract = field(fields, "Abstract / Summary")
    if kind == "book":
        abstract = field(fields, "Description / Summary")
    if kind == "project":
        abstract = field(fields, "Summary")
    if kind == "writing" and not abstract:
        abstract = summary

    created_at = str(issue.get("created_at") or "")
    reading_time_raw = field(fields, "Reading Time")
    word_count = len(re.findall(r"\b[\w'-]+\b", content))
    estimated_minutes = max(1, math.ceil(word_count / 200))
    reading_time = reading_time_raw or f"{estimated_minutes} min"
    cover = image_url(field(fields, "Cover Image"))
    attachment_text = field(fields, "PDF / Files", "Files")
    attachments = extract_links(attachment_text)
    links = extract_links(field(fields, "Links"))
    author = field(fields, "Author", "Authors") or OWNER_LOGIN
    date_value = parse_date(field(fields, "Date"), created_at)
    return {
        "id": int(issue.get("number") or 0),
        "title": title,
        "subtitle": field(fields, "Subtitle") or summary[:240],
        "type": kind,
        "category": category_key(field(fields, "Category")),
        "language": field(fields, "Language") or "Bilingual",
        "author": author,
        "date": date_value,
        "readingTime": reading_time,
        "tags": split_tags(field(fields, "Tags", "Keywords")),
        "coverImage": cover,
        "abstract": abstract,
        "contentMarkdown": content,
        "secondLanguage": field(fields, "Second Language Version"),
        "referencesMarkdown": field(fields, "References", "References / Notes"),
        "attachments": attachments,
        "links": links,
        "projectStatus": field(fields, "Project Status"),
        "technologies": split_tags(field(fields, "Technologies")),
        "sourceUrl": allowed_url(str(issue.get("html_url") or "")),
    }


def fetch_issues() -> list[dict[str, Any]]:
    repository = os.environ.get("GITHUB_REPOSITORY", "AHMAD-SADEK/AHMAD-SADEK.github.io")
    token = os.environ.get("GITHUB_TOKEN", "")
    api_root = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
    result: list[dict[str, Any]] = []
    page = 1
    while True:
        url = f"{api_root}/repos/{repository}/issues?" + urllib.parse.urlencode({
            "state": "all", "per_page": 100, "page": page, "sort": "created", "direction": "desc",
        })
        headers = {"Accept": "application/vnd.github+json", "User-Agent": "ahmad-archive-builder"}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                batch = json.load(response)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
            print(f"Unable to load archive source (page {page}): {error}", file=sys.stderr)
            raise
        if not isinstance(batch, list):
            raise RuntimeError("GitHub API returned an unexpected response shape.")
        result.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return result


def build_archive(issues: list[dict[str, Any]]) -> dict[str, Any]:
    items = [item for issue in issues if (item := build_item(issue)) is not None]
    items.sort(key=lambda item: (item["date"], item["id"]), reverse=True)
    return {"version": 1, "items": items}


def main() -> int:
    data = build_archive(fetch_issues())
    serialized = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    OUTPUT.write_text(serialized, encoding="utf-8")
    print(f"Wrote {len(data['items'])} approved publication(s) to {OUTPUT.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
