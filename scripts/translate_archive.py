#!/usr/bin/env python3
"""Build cached Arabic/English machine translations for published archive entries.

Inference runs locally inside GitHub Actions. No translation API receives manuscript text.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Any, Callable

MODEL_NAME = "facebook/m2m100_418M"
MODEL_REVISION = "m2m100-418m-v1"
MAX_INPUT_TOKENS = 360
BATCH_SIZE = 8

FIELDS = (
    "title", "subtitle", "abstract", "contentMarkdown",
    "referencesMarkdown", "tags", "technologies", "projectStatus",
)


def _source_fields(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": str(item.get("title") or ""),
        "subtitle": str(item.get("subtitle") or ""),
        "abstract": str(item.get("abstract") or ""),
        "contentMarkdown": str(item.get("contentMarkdown") or ""),
        "referencesMarkdown": str(item.get("referencesMarkdown") or ""),
        "tags": [str(value) for value in (item.get("tags") or [])],
        "technologies": [str(value) for value in (item.get("technologies") or [])],
        "projectStatus": str(item.get("projectStatus") or ""),
    }


def source_fingerprint(item: dict[str, Any]) -> str:
    payload = {
        "model": MODEL_NAME,
        "revision": MODEL_REVISION,
        "primaryLanguage": item.get("primaryLanguage"),
        "fields": _source_fields(item),
        "manualSecondLanguage": str(item.get("secondLanguage") or ""),
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


class NeuralTranslator:
    """CPU-based M2M100 translator with bounded input batches."""

    def __init__(self) -> None:
        import torch
        from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer

        torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
        self.tokenizer = M2M100Tokenizer.from_pretrained(MODEL_NAME)
        self.model = M2M100ForConditionalGeneration.from_pretrained(MODEL_NAME)
        self.model.eval()
        self.torch = torch

    def _token_chunks(self, text: str) -> list[str]:
        sentences = [part.strip() for part in re.split(r"(?<=[.!?؟؛])\s+", text.strip()) if part.strip()]
        output: list[str] = []
        current: list[str] = []
        current_size = 0
        for sentence in sentences or [text.strip()]:
            token_ids = self.tokenizer.encode(sentence, add_special_tokens=False)
            if len(token_ids) > MAX_INPUT_TOKENS:
                if current:
                    output.append(" ".join(current))
                    current, current_size = [], 0
                for offset in range(0, len(token_ids), MAX_INPUT_TOKENS):
                    piece = token_ids[offset:offset + MAX_INPUT_TOKENS]
                    output.append(self.tokenizer.decode(piece, skip_special_tokens=True).strip())
                continue
            if current and current_size + len(token_ids) > MAX_INPUT_TOKENS:
                output.append(" ".join(current))
                current, current_size = [], 0
            current.append(sentence)
            current_size += len(token_ids)
        if current:
            output.append(" ".join(current))
        return [part for part in output if part]

    def translate_many(self, texts: list[str], source: str, target: str) -> list[str]:
        if not texts:
            return []
        self.tokenizer.src_lang = source
        translated: list[str] = []
        target_id = self.tokenizer.get_lang_id(target)
        for offset in range(0, len(texts), BATCH_SIZE):
            batch = texts[offset:offset + BATCH_SIZE]
            encoded = self.tokenizer(
                batch, return_tensors="pt", padding=True, truncation=True,
                max_length=MAX_INPUT_TOKENS + 8,
            )
            with self.torch.inference_mode():
                generated = self.model.generate(
                    **encoded,
                    forced_bos_token_id=target_id,
                    num_beams=1,
                    max_new_tokens=MAX_INPUT_TOKENS + 32,
                    early_stopping=False,
                )
            translated.extend(
                value.strip()
                for value in self.tokenizer.batch_decode(generated, skip_special_tokens=True)
            )
        return translated

    def translate_text(self, text: str, source: str, target: str) -> str:
        value = str(text or "")
        if not value.strip():
            return value
        self.tokenizer.src_lang = source
        chunks = self._token_chunks(value)
        return " ".join(self.translate_many(chunks, source, target)).strip()


PROTECTED_RE = re.compile(
    r"(?:\x60+[^\x60]*\x60+|\$\$?.+?\$\$?|\\\(.+?\\\)|\\\[.+?\\\]|https?://\S+|<[^>]+>|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\))"
)


def _plan_inline_translation(
    text: str,
    tasks: list[str],
    translator: NeuralTranslator,
    source: str,
    target: str,
) -> list[tuple[str, int, int] | tuple[str, str]]:
    """Create a literal/translated template without running the model yet."""
    parts: list[tuple[str, int, int] | tuple[str, str]] = []
    cursor = 0

    def add_text(value: str) -> None:
        if not value:
            return
        chunker = getattr(translator, "_token_chunks", None)
        chunks = chunker(value) if callable(chunker) else [value]
        chunks = [chunk for chunk in chunks if chunk]
        if not chunks:
            return
        offset = len(tasks)
        tasks.extend(chunks)
        parts.append(("translated", offset, len(chunks)))

    for match in PROTECTED_RE.finditer(text):
        if match.start() > cursor:
            add_text(text[cursor:match.start()])
        token = match.group(0)
        link = re.fullmatch(r"(!?)\[([^\]]*)\]\(([^)\s]+)(.*)\)", token)
        emphasis = re.fullmatch(r"(\*\*|__|~~|\*|_)(.+?)\1", token, re.S)
        if link:
            parts.append(("literal", link.group(1) + "["))
            if link.group(2):
                add_text(link.group(2))
            parts.append(("literal", "](" + link.group(3) + link.group(4) + ")"))
        elif emphasis:
            parts.append(("literal", emphasis.group(1)))
            add_text(emphasis.group(2))
            parts.append(("literal", emphasis.group(1)))
        else:
            parts.append(("literal", token))
        cursor = match.end()
    if cursor < len(text):
        add_text(text[cursor:])
    return parts


def _render_translation_plan(
    parts: list[tuple[str, int, int] | tuple[str, str]],
    translated_chunks: list[str],
) -> str:
    output: list[str] = []
    for part in parts:
        if part[0] == "literal":
            output.append(part[1])
        else:
            _, offset, count = part
            output.append(" ".join(translated_chunks[offset:offset + count]).strip())
    return "".join(output)


def _is_table_separator(line: str) -> bool:
    if "|" not in line:
        return False
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def translate_markdown(text: str, translator: NeuralTranslator, source: str, target: str) -> str:
    """Translate Markdown prose in batches while retaining formatting and protected spans."""
    tokenizer = getattr(translator, "tokenizer", None)
    if tokenizer is not None:
        tokenizer.src_lang = source

    lines = str(text or "").splitlines(keepends=True)
    output: list[str] = []
    tasks: list[str] = []
    plans: list[list[tuple[str, int, int] | tuple[str, str]] | None] = []
    fence: str | None = None

    def add_line_plan(value: str) -> list[tuple[str, int, int] | tuple[str, str]]:
        return _plan_inline_translation(value, tasks, translator, source, target)

    for raw_line in lines:
        line = raw_line.rstrip("\r\n")
        ending = raw_line[len(line):]
        fence_match = re.match(r"^\s{0,3}(\x60{3,}|~{3,})", line)
        if fence is not None:
            output.append(raw_line)
            plans.append(None)
            if fence_match and fence_match.group(1)[0] == fence[0] and len(fence_match.group(1)) >= len(fence):
                fence = None
            continue
        if fence_match:
            fence = fence_match.group(1)
            output.append(raw_line)
            plans.append(None)
            continue
        if (
            not line.strip()
            or re.fullmatch(r"\s*(?:-{3,}|\*{3,}|_{3,})\s*", line)
            or _is_table_separator(line)
        ):
            output.append(raw_line)
            plans.append(None)
            continue
        if "|" in line and line.strip().startswith("|"):
            cells = line.split("|")
            table_template: list[tuple[str, int, int] | tuple[str, str]] = []
            for index, cell in enumerate(cells):
                if index:
                    table_template.append(("literal", "|"))
                core = cell.strip()
                if not core:
                    continue
                leading = cell[:len(cell) - len(cell.lstrip())]
                trailing = cell[len(cell.rstrip()):]
                table_template.append(("literal", leading))
                table_template.extend(add_line_plan(core))
                table_template.append(("literal", trailing))
            output.append("")
            plans.append(table_template)
            continue
        prefix = re.match(r"^(\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)?)(.*)$", line)
        if prefix:
            plan = [("literal", prefix.group(1))] + add_line_plan(prefix.group(2))
        else:
            plan = add_line_plan(line)
        plans.append([("line", len(output), 0)] + plan)
        output.append(ending)

    translated = translator.translate_many(tasks, source, target) if tasks else []
    for index, plan in enumerate(plans):
        if plan is None:
            continue
        if plan and plan[0][0] == "line":
            _, output_index, _ = plan[0]
            rendered = _render_translation_plan(plan[1:], translated)
            ending = lines[output_index][len(lines[output_index].rstrip("\r\n")):]
            output[output_index] = rendered + ending
        else:
            rendered = _render_translation_plan(plan, translated)
            raw = lines[index]
            ending = raw[len(raw.rstrip("\r\n")):]
            output[index] = rendered + ending
    return "".join(output)

def _localized_reading_time(value: str, language: str) -> str:
    match = re.search(r"\d+", value)
    if not match:
        return value
    return f"{match.group(0)} دقيقة" if language == "ar" else f"{match.group(0)} min"


def _translated_payload(
    item: dict[str, Any], source: str, target: str, translator: NeuralTranslator
) -> dict[str, Any]:
    original = _source_fields(item)
    result: dict[str, Any] = {}
    for key in ("title", "subtitle", "abstract", "referencesMarkdown", "projectStatus"):
        result[key] = translator.translate_text(original[key], source, target) if original[key].strip() else ""
    manual_body = str(item.get("secondLanguage") or "").strip()
    result["contentMarkdown"] = (
        manual_body if manual_body
        else translate_markdown(original["contentMarkdown"], translator, source, target)
    )
    result["tags"] = [translator.translate_text(value, source, target) for value in original["tags"]]
    result["technologies"] = [
        translator.translate_text(value, source, target) for value in original["technologies"]
    ]
    result["readingTime"] = _localized_reading_time(str(item.get("readingTime") or ""), target)
    result["machineTranslated"] = True
    return result


def enrich_archive_translations(
    data: dict[str, Any],
    previous_data: dict[str, Any] | None = None,
    translator_factory: Callable[[], NeuralTranslator] | None = None,
) -> dict[str, Any]:
    """Attach both language views, reusing prior translations when source text is unchanged."""
    old_items = {
        int(item["id"]): item
        for item in (previous_data or {}).get("items", [])
        if isinstance(item, dict) and str(item.get("id", "")).isdigit()
    }
    engine: NeuralTranslator | None = None
    factory = translator_factory or NeuralTranslator
    for item in data.get("items", []):
        source = item.get("primaryLanguage")
        if source not in {"ar", "en"}:
            source = "ar" if re.search(r"[\u0600-\u06FF]", item.get("contentMarkdown", "")) else "en"
        target = "en" if source == "ar" else "ar"
        fingerprint = source_fingerprint(item)
        previous = old_items.get(int(item["id"]), {})
        cached = previous.get("autoTranslation") if isinstance(previous, dict) else None
        cached_translations = previous.get("translations") if isinstance(previous, dict) else None
        if (
            isinstance(cached, dict) and cached.get("sourceHash") == fingerprint
            and isinstance(cached_translations, dict)
            and isinstance(cached_translations.get(source), dict)
            and isinstance(cached_translations.get(target), dict)
        ):
            item["translations"] = cached_translations
            item["autoTranslation"] = cached
            continue
        if engine is None:
            engine = factory()
        source_payload = _source_fields(item)
        source_payload["readingTime"] = _localized_reading_time(str(item.get("readingTime") or ""), source)
        source_payload["machineTranslated"] = False
        translated = _translated_payload(item, source, target, engine)
        item["translations"] = {source: source_payload, target: translated}
        item["autoTranslation"] = {
            "model": MODEL_NAME,
            "modelRevision": MODEL_REVISION,
            "sourceHash": fingerprint,
            "machineTranslated": True,
        }
    return data
