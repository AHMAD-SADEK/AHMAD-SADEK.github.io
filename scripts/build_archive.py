#!/usr/bin/env python3
"""Build the public static archive exclusively from Studio-managed repository content."""
from __future__ import annotations

import json
import math
import re
import shutil
from html import escape as html_escape
from xml.sax.saxutils import escape as xml_escape
import urllib.parse
import zlib
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "archive.json"
ARTICLES_DIR = ROOT / "articles"
CONTENT_DIR = ROOT / "content"
SITE_URL = "https://ahmad-sadek.github.io"
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
URL_RE = re.compile(r"https?://[^\s<>\])}]+", re.IGNORECASE)
MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", re.IGNORECASE)


def normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\r", "").strip()).lower()


def clean_value(value: str) -> str:
    value = value.strip()
    if normalize(value) in {"_no response_", "no response", "(no response)"}:
        return ""
    return value


def category_key(raw: str) -> str:
    return CATEGORY_ALIASES.get(normalize(raw), "general" if not raw else "general")


def primary_language(raw_language: str, content: str) -> str:
    language = normalize(raw_language)
    if "bilingual" not in language and ("arabic" in language or "العربية" in language):
        return "ar"
    if "bilingual" not in language and ("english" in language or language == "en"):
        return "en"
    return "ar" if re.search(r"[\u0600-\u06FF]", content or "") else "en"


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
    if not value or re.search(r"[\x00-\x20\x7f]", value):
        return ""
    try:
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme not in {"https", "http"} or not parsed.hostname:
            return ""
        if parsed.username is not None or parsed.password is not None:
            return ""
        # Accessing .port validates a supplied port and raises on malformed values.
        _ = parsed.port
        return value
    except ValueError:
        return ""


def image_url(raw: str) -> str:
    value = (raw or "").strip()
    match = re.search(r"<img\b[^>]*\bsrc\s*=\s*([\"'])(.*?)\1", value, re.I | re.S)
    candidate = match.group(2).strip() if match else ""
    if not candidate:
        match = re.search(r"!\[[^\]]*\]\((https?://[^)\s]+)\)", value, re.I)
        candidate = match.group(1) if match else ""
    if not candidate and re.fullmatch(r"https?://[^\s<>]+", value, re.I):
        # A cover field containing a single URL is intentional; do not promote an
        # unrelated URL pasted into explanatory prose into a tracking image.
        candidate = value
    valid = allowed_url(candidate) if candidate else ""
    # Covers are embedded media: require HTTPS to prevent mixed-content failures.
    return valid if valid and urllib.parse.urlparse(valid).scheme == "https" else ""

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


def build_content_items(content_dir: Path | None = None) -> list[dict[str, Any]]:
    """Load approved long-form Markdown publications stored in the repository."""
    root = content_dir or CONTENT_DIR
    if not root.exists():
        return []
    items = []
    used_ids = set()
    for metadata_path in sorted(root.glob("*/*/metadata.json")):
        folder = metadata_path.parent
        slug = folder.name
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError(f"Invalid publication slug: {slug}")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if not isinstance(metadata, dict):
            raise ValueError(f"Metadata must be an object: {metadata_path}")
        status = normalize(metadata.get("status", "draft"))
        if status not in {"draft", "published"}:
            raise ValueError(f"Invalid publication status in {metadata_path}")
        if status != "published":
            continue
        title = str(metadata.get("title") or "").strip()
        kind_raw = normalize(metadata.get("type") or folder.parent.name)
        kind = TYPE_ALIASES.get(kind_raw, kind_raw)
        if not title or kind not in SCHEMAS:
            raise ValueError(f"Published item needs a valid title and type: {metadata_path}")
        manuscript = folder / "content.md"
        if not manuscript.is_file():
            raise ValueError(f"Published item is missing content.md: {folder}")
        content = manuscript.read_text(encoding="utf-8").strip()
        if not content:
            raise ValueError(f"Published manuscript is empty: {manuscript}")
        raw_id = metadata.get("id")
        item_id = int(raw_id) if raw_id is not None else 1_000_000_000 + zlib.crc32(
            f"{kind}/{slug}".encode("utf-8")
        )
        if item_id <= 0 or item_id in used_ids:
            raise ValueError(f"Invalid or duplicate content id: {item_id}")
        used_ids.add(item_id)
        language = str(metadata.get("language") or "Bilingual")
        summary = str(metadata.get("abstract") or metadata.get("summary") or "").strip()
        tags = metadata.get("tags") or []
        if isinstance(tags, str):
            tags = split_tags(tags)
        if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
            raise ValueError(f"tags must be strings in {metadata_path}")
        def sibling_markdown(key: str) -> str:
            filename = str(metadata.get(key) or "").strip()
            if not filename:
                return ""
            if Path(filename).name != filename or not filename.lower().endswith(".md"):
                raise ValueError(f"{key} must name a sibling Markdown file")
            path = folder / filename
            if not path.is_file():
                raise ValueError(f"Missing referenced Markdown file: {path}")
            return path.read_text(encoding="utf-8").strip()
        words = len(re.findall(r"\b[\w'-]+\b", content))
        attachments = []
        for entry in metadata.get("attachments", []) or []:
            if isinstance(entry, str):
                attachments.extend(extract_links(entry))
            elif isinstance(entry, dict):
                url = allowed_url(str(entry.get("url") or ""))
                if url:
                    attachments.append({"label": str(entry.get("label") or "Open file"), "url": url})
        items.append({
            "id": item_id, "title": title,
            "subtitle": str(metadata.get("subtitle") or summary[:240]),
            "type": kind, "category": category_key(str(metadata.get("category") or "")),
            "language": language, "primaryLanguage": primary_language(language, content),
            "author": str(metadata.get("author") or OWNER_LOGIN),
            "date": parse_date(str(metadata.get("date") or ""), ""),
            "readingTime": str(metadata.get("readingTime") or f"{max(1, math.ceil(words / 200))} min"),
            "tags": split_tags(", ".join(tags)), "coverImage": image_url(str(metadata.get("coverImage") or "")),
            "abstract": summary, "contentMarkdown": content,
            "secondLanguage": sibling_markdown("secondLanguageFile"),
            "referencesMarkdown": sibling_markdown("referencesFile"),
            "attachments": attachments, "links": extract_links(str(metadata.get("links") or "")),
            "projectStatus": str(metadata.get("projectStatus") or ""),
            "technologies": split_tags(str(metadata.get("technologies") or "")),
            "sourceUrl": f"https://github.com/{OWNER_LOGIN}/AHMAD-SADEK.github.io/tree/main/{folder.relative_to(ROOT).as_posix()}",
        })
    return items


def build_archive(content_items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    items = list(content_items or [])
    ids = [item["id"] for item in items]
    if len(ids) != len(set(ids)):
        raise ValueError("Publication ids collide between Issues and Markdown content.")
    items.sort(key=lambda item: (item["date"], item["id"]), reverse=True)
    return {"version": 1, "items": items}


def json_for_script(value: Any) -> str:
    """Serialize JSON safely inside an HTML script element."""
    return (
        json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        .replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
    )


def safe_markdown_url(raw_url: str, kind: str = "link") -> str:
    candidate = str(raw_url or "").strip().replace("&amp;", "&")
    absolute = allowed_url(candidate)
    if absolute:
        parsed = urllib.parse.urlparse(absolute)
        if kind == "image" and parsed.scheme != "https":
            return ""
        return absolute
    if re.search(r"[\x00-\x20\x7f]", candidate):
        return ""
    if re.match(r"^(?:/(?!/)|\.{1,2}/|#)", candidate):
        return candidate
    if kind == "link" and re.match(r"^(?:mailto:|tel:)", candidate, re.I):
        return candidate
    return ""


def markdown_inline_static(source: str) -> str:
    """Render inline Markdown while escaping all raw HTML and validating URLs."""
    tokens: list[str] = []

    def stash(fragment: str) -> str:
        marker = f"\x00M{len(tokens)}\x00"
        tokens.append(fragment)
        return marker

    text = str(source or "")
    tick = re.escape(chr(96))
    text = re.sub(tick + r"([^" + tick + r"\n]+)" + tick,
                  lambda match: stash("<code>" + html_escape(match.group(1)) + "</code>"), text)

    def image_replacement(match: re.Match[str]) -> str:
        alt, raw_url = match.group(1), match.group(2)
        url = safe_markdown_url(raw_url, "image")
        if not url:
            return html_escape(match.group(0))
        return stash('<img src="' + html_escape(url, quote=True) + '" alt="' +
                     html_escape(alt, quote=True) + '" loading="lazy" decoding="async">')

    text = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", image_replacement, text)

    def link_replacement(match: re.Match[str]) -> str:
        label, raw_url = match.group(1), match.group(2)
        url = safe_markdown_url(raw_url, "link")
        if not url:
            return html_escape(match.group(0))
        external = bool(re.match(r"^https?://", url, re.I))
        attrs = ' href="' + html_escape(url, quote=True) + '"'
        if external:
            attrs += ' target="_blank" rel="noopener noreferrer"'
        return stash("<a" + attrs + ">" + html_escape(label) + "</a>")

    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link_replacement, text)
    text = html_escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"__(.+?)__", r"<strong>\1</strong>", text)
    text = re.sub(r"(^|[^*])\*([^*\n]+)\*(?!\*)", r"\1<em>\2</em>", text)
    text = re.sub(r"(^|[^_])_([^_\n]+)_(?!_)", r"\1<em>\2</em>", text)
    text = re.sub(r"~~(.+?)~~", r"<del>\1</del>", text)
    text = text.replace("\n", "<br>")
    return re.sub(
        r"\x00M(\d+)\x00",
        lambda match: tokens[int(match.group(1))] if int(match.group(1)) < len(tokens) else match.group(0),
        text,
    )


def render_markdown_static(source: str) -> str:
    """Small server-side Markdown renderer for first paint and search crawlers."""
    lines = str(source or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    output: list[str] = []
    index = 0

    def is_heading(line: str) -> bool:
        return bool(re.match(r"^\s{0,3}#{1,6}\s+", line))

    def is_fence(line: str) -> bool:
        return bool(re.match(r"^\s*\x60{3}", line))

    def is_rule(line: str) -> bool:
        return bool(re.match(r"^\s*(?:-{3,}|\*{3,}|_{3,})\s*$", line))

    def is_quote(line: str) -> bool:
        return bool(re.match(r"^\s*>\s?", line))

    def is_unordered(line: str) -> bool:
        return bool(re.match(r"^\s*[-*+]\s+", line))

    def is_ordered(line: str) -> bool:
        return bool(re.match(r"^\s*\d+[.)]\s+", line))

    def table_cells(line: str) -> list[str]:
        return [cell.strip() for cell in line.strip().strip("|").split("|")]

    def table_divider(line: str) -> bool:
        cells = table_cells(line)
        return bool(cells) and all(re.match(r"^\s*:?-{3,}:?\s*$", cell) for cell in cells)

    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue

        if is_fence(line):
            language = re.sub(r"[^a-zA-Z0-9_-]", "", line.strip()[3:].strip())
            index += 1
            code_lines = []
            while index < len(lines) and not is_fence(lines[index]):
                code_lines.append(lines[index])
                index += 1
            if index < len(lines):
                index += 1
            class_attr = ' class="language-' + language + '"' if language else ""
            output.append("<pre><code" + class_attr + ">" +
                          html_escape("\n".join(code_lines)) + "</code></pre>")
            continue

        if is_rule(line):
            output.append("<hr>")
            index += 1
            continue

        heading = re.match(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if heading:
            level = min(4, max(2, len(heading.group(1)) + 1))
            output.append(f"<h{level}>" + markdown_inline_static(heading.group(2)) + f"</h{level}>")
            index += 1
            continue

        if is_quote(line):
            quote = []
            while index < len(lines) and is_quote(lines[index]):
                quote.append(re.sub(r"^\s*>\s?", "", lines[index]))
                index += 1
            output.append("<blockquote><p>" + markdown_inline_static("\n".join(quote)) + "</p></blockquote>")
            continue

        if (is_unordered(line) or is_ordered(line)) and not (
            index + 1 < len(lines) and table_divider(lines[index + 1])
        ):
            ordered = is_ordered(line)
            tag = "ol" if ordered else "ul"
            items = []
            pattern = r"^\s*\d+[.)]\s+" if ordered else r"^\s*[-*+]\s+"
            while index < len(lines) and (is_ordered(lines[index]) if ordered else is_unordered(lines[index])):
                raw_item = re.sub(pattern, "", lines[index])
                items.append("<li>" + markdown_inline_static(raw_item) + "</li>")
                index += 1
            output.append("<" + tag + ">" + "".join(items) + "</" + tag + ">")
            continue

        if index + 1 < len(lines) and "|" in line and table_divider(lines[index + 1]):
            headers = table_cells(line)
            index += 2
            rows = []
            while index < len(lines) and "|" in lines[index] and lines[index].strip():
                rows.append(table_cells(lines[index]))
                index += 1
            ths = "".join("<th scope=\"col\">" + markdown_inline_static(value) + "</th>" for value in headers)
            rendered_rows = []
            for row in rows:
                cells = "".join("<td>" + markdown_inline_static(row[col] if col < len(row) else "") +
                                "</td>" for col in range(len(headers)))
                rendered_rows.append("<tr>" + cells + "</tr>")
            output.append('<div class="table-scroll"><table><thead><tr>' + ths +
                          "</tr></thead><tbody>" + "".join(rendered_rows) +
                          "</tbody></table></div>")
            continue

        paragraph = [line]
        index += 1
        while index < len(lines) and lines[index].strip():
            following = lines[index]
            if (is_fence(following) or is_heading(following) or is_rule(following) or
                is_quote(following) or is_unordered(following) or is_ordered(following)):
                break
            if index + 1 < len(lines) and "|" in following and table_divider(lines[index + 1]):
                break
            paragraph.append(following)
            index += 1
        output.append("<p>" + markdown_inline_static("\n".join(paragraph)) + "</p>")

    return "\n".join(output)


def build_article_page(item: dict[str, Any]) -> str:
    """Create a crawlable standalone page with unique metadata and safe JSON data."""
    article_id = int(item["id"])
    canonical = f"{SITE_URL}/articles/{article_id}/"
    title = str(item.get("title") or "Untitled")
    description = str(item.get("subtitle") or item.get("abstract") or title).strip()
    if len(description) > 300:
        description = description[:297].rstrip() + "..."
    primary = item.get("primaryLanguage") if item.get("primaryLanguage") in {"ar", "en"} else "en"
    direction = "rtl" if primary == "ar" else "ltr"
    cover = allowed_url(str(item.get("coverImage") or ""))
    title_attr = html_escape(title, quote=True)
    description_attr = html_escape(description, quote=True)
    canonical_attr = html_escape(canonical, quote=True)
    cover_meta = (
        '<meta property="og:image" content="' + html_escape(cover, quote=True) + '">\n'
        if cover else ""
    )
    data_json = json_for_script(item)
    abstract_html = render_markdown_static(str(item.get("abstract") or ""))
    content_html = render_markdown_static(str(item.get("contentMarkdown") or ""))
    references_html = render_markdown_static(str(item.get("referencesMarkdown") or ""))
    abstract_hidden = "" if item.get("abstract") else " hidden"
    references_hidden = "" if item.get("referencesMarkdown") else " hidden"
    return f'''<!doctype html>
<html lang="{primary}" dir="{direction}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f8f5ed">
  <meta name="description" content="{description_attr}">
  <meta name="author" content="{html_escape(str(item.get("author") or OWNER_LOGIN), quote=True)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="{canonical_attr}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Ahmad Sadek — Personal Archive">
  <meta property="og:title" content="{title_attr} — Ahmad Sadek">
  <meta property="og:description" content="{description_attr}">
  <meta property="og:url" content="{canonical_attr}">
  {cover_meta.strip()}
  <meta name="twitter:card" content="summary">
  <title>{title_attr} — Ahmad Sadek</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&amp;family=Cormorant+Garamond:wght@400;500;600;700&amp;family=Manrope:wght@400;500;600;700&amp;family=Noto+Kufi+Arabic:wght@400;500;600&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script type="application/ld+json">{json_for_script({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": description,
        "author": {"@type": "Person", "name": str(item.get("author") or OWNER_LOGIN)},
        "datePublished": str(item.get("date") or ""),
        "url": canonical,
        **({"image": cover} if cover else {})
    })}</script>
  <script src="/assets/js/markdown.js" defer></script>
  <script src="/assets/js/article.js" defer></script>
</head>
<body>
  <div class="site-shell">
    <header class="site-header">
      <a href="/#home" class="brand" aria-label="Ahmad Sadek home">
        <span class="monogram">AS</span>
        <span class="brand-name" data-ui="brand">AHMAD SADEK</span>
      </a>
      <nav class="desktop-nav" aria-label="Article navigation">
        <a class="nav-link" href="/#archive" data-ui="archive">Archive</a>
        <a class="nav-link" href="/#about" data-ui="about">About</a>
      </nav>
      <div class="header-tools">
        <button class="language-button" type="button" data-lang="ar" aria-pressed="false" aria-label="Switch interface to Arabic">العربية</button>
        <span class="language-divider" aria-hidden="true">/</span>
        <button class="language-button" type="button" data-lang="en" aria-pressed="true" aria-label="Switch interface to English">EN</button>
      </div>
    </header>
    <main id="main" tabindex="-1">
      <article class="article-page" id="articlePage" aria-labelledby="articleTitle">
        <a class="article-back" href="/#archive" data-ui="back">← Back to archive</a>
        <div class="article-type" id="articleType"></div>
        <h1 id="articleTitle" lang="{primary}" dir="{direction}">{title_attr}</h1>
        <p class="article-subtitle" id="articleSubtitle" lang="{primary}" dir="{direction}">{html_escape(str(item.get("subtitle") or ""), quote=True)}</p>
        <div class="article-meta" id="articleMeta"></div>
        <img class="article-cover" id="articleCover" alt="{title_attr}" hidden>
        <section class="article-prose" id="articleAbstract"{abstract_hidden}>
          <h2 id="abstractLabel">Abstract</h2>
          <div id="abstractContent" lang="{primary}" dir="{direction}">{abstract_html}</div>
        </section>
        <section class="article-prose" id="articleBody" aria-label="Article content">
          <div id="articleContent" lang="{primary}" dir="{direction}">{content_html}</div>
        </section>
        <section class="article-prose" id="articleReferences"{references_hidden}>
          <h2 id="referencesLabel">References</h2>
          <div id="referencesContent" lang="{primary}" dir="{direction}">{references_html}</div>
        </section>
        <section class="article-prose" id="articleAttachments" hidden>
          <h2 id="attachmentsLabel">Attached files</h2>
          <div id="attachmentsContent"></div>
        </section>
        <section class="article-prose" id="articleLinks" hidden>
          <h2 id="linksLabel">Related links</h2>
          <div id="linksContent"></div>
        </section>
        <p class="article-source" id="articleSource"></p>
        <script id="articleData" type="application/json">{data_json}</script>
      </article>
    </main>
    <footer class="site-footer"><span>© {html_escape(str(item.get("date") or "")[:4])} Ahmad Sadek</span><span data-ui="footer">AHMAD SADEK — PERSONAL ARCHIVE</span></footer>
  </div>
</body>
</html>
'''


def write_article_pages(items: list[dict[str, Any]]) -> None:
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
    wanted = {str(int(item["id"])) for item in items}
    # Only delete numeric directories generated by this script; leave other site files alone.
    for child in ARTICLES_DIR.iterdir():
        if child.is_dir() and child.name.isdigit() and child.name not in wanted:
            shutil.rmtree(child)
    for item in items:
        article_dir = ARTICLES_DIR / str(int(item["id"]))
        article_dir.mkdir(parents=True, exist_ok=True)
        (article_dir / "index.html").write_text(build_article_page(item), encoding="utf-8")


def write_sitemap(items: list[dict[str, Any]]) -> None:
    urls = [
        f"<url><loc>{xml_escape(SITE_URL)}/</loc></url>",
        f"<url><loc>{xml_escape(SITE_URL)}/ar/</loc></url>",
    ]
    for item in items:
        article_id = int(item["id"])
        loc = xml_escape(f"{SITE_URL}/articles/{article_id}/")
        lastmod = xml_escape(str(item.get("date") or ""))
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", lastmod):
            urls.append(f"<url><loc>{loc}</loc><lastmod>{lastmod}</lastmod></url>")
        else:
            urls.append(f"<url><loc>{loc}</loc></url>")
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += "\n".join("  " + url for url in urls)
    xml += "\n</urlset>\n"
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


def main() -> int:
    previous_data: dict[str, Any] = {}
    if OUTPUT.is_file():
        try:
            previous_data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            previous_data = {}

    data = build_archive(build_content_items())
    try:
        from .translate_archive import enrich_archive_translations
    except ImportError:
        from translate_archive import enrich_archive_translations
    data = enrich_archive_translations(data, previous_data)

    serialized = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    OUTPUT.write_text(serialized, encoding="utf-8")
    write_article_pages(data["items"])
    write_sitemap(data["items"])
    print(f"Wrote {len(data['items'])} approved publication(s), article pages, and sitemap.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
