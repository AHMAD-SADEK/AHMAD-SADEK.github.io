import copy
import unittest

from scripts.translate_archive import (
    MODEL_NAME,
    enrich_archive_translations,
    source_fingerprint,
    translate_markdown,
)


class MockTranslator:
    def __init__(self):
        self.calls = []
        self.batch_calls = []

    def _token_chunks(self, text):
        return [text]

    def translate_many(self, texts, source, target):
        self.batch_calls.append((list(texts), source, target))
        return [f"[{source}>{target}] {text}" for text in texts]

    def translate_text(self, text, source, target):
        self.calls.append((text, source, target))
        return f"[{source}>{target}] {text}"


def sample_item():
    tick = chr(96)
    fence = tick * 3
    return {
        "id": 7,
        "title": "A careful title",
        "subtitle": "A short subtitle",
        "abstract": "A useful abstract.",
        "type": "writing",
        "category": "thought",
        "language": "English",
        "primaryLanguage": "en",
        "readingTime": "4 min",
        "tags": ["science", "learning"],
        "technologies": [],
        "projectStatus": "",
        "contentMarkdown": (
            "# Main heading\n\n"
            "A paragraph with a [reference link](https://example.org/paper) and "
            + tick + "x = 2" + tick + ".\n\n"
            + fence + "python\nprint('keep this code')\n" + fence + "\n"
        ),
        "referencesMarkdown": "Author. (2025). A reference.",
        "secondLanguage": "",
    }


class TranslationArchiveTests(unittest.TestCase):
    def test_markdown_structure_links_inline_code_and_fenced_code_are_preserved(self):
        translator = MockTranslator()
        item = sample_item()
        source = item["contentMarkdown"]
        result = translate_markdown(source, translator, "en", "ar")
        fence = chr(96) * 3
        tick = chr(96)
        self.assertIn("# [en>ar] Main heading", result)
        self.assertIn("[[en>ar] reference link](https://example.org/paper)", result)
        self.assertIn(tick + "x = 2" + tick, result)
        self.assertIn(fence + "python\nprint('keep this code')\n" + fence, result)
        self.assertEqual(len(translator.batch_calls), 1, "Markdown prose should be translated in a single batched pass")
        self.assertGreater(len(translator.batch_calls[0][0]), 1, "separate paragraphs should be grouped for batch inference")

    def test_markdown_tables_keep_cells_separators_and_headers(self):
        translator = MockTranslator()
        source = "| Name | Description |\n| --- | --- |\n| Tablet | Solid dosage form |\n"
        result = translate_markdown(source, translator, "en", "ar")
        self.assertIn("| [en>ar] Name | [en>ar] Description |", result)
        self.assertIn("| --- | --- |", result)
        self.assertIn("| [en>ar] Tablet | [en>ar] Solid dosage form |", result)

    def test_enrichment_keeps_source_and_creates_both_language_views(self):
        item = sample_item()
        translator = MockTranslator()
        result = enrich_archive_translations({"version": 1, "items": [item]}, translator_factory=lambda: translator)
        enriched = result["items"][0]
        self.assertEqual(enriched["title"], "A careful title", "the canonical source field must remain unchanged")
        self.assertEqual(enriched["translations"]["en"]["title"], "A careful title")
        self.assertTrue(enriched["translations"]["ar"]["title"].startswith("[en>ar]"))
        self.assertIn("# [en>ar]", enriched["translations"]["ar"]["contentMarkdown"])
        self.assertEqual(enriched["translations"]["ar"]["tags"], ["[en>ar] science", "[en>ar] learning"])
        self.assertTrue(enriched["translations"]["ar"]["machineTranslated"])
        self.assertFalse(enriched["translations"]["en"]["machineTranslated"])
        self.assertEqual(enriched["autoTranslation"]["model"], MODEL_NAME)
        self.assertEqual(enriched["autoTranslation"]["sourceHash"], source_fingerprint(item))

    def test_manual_second_language_body_is_preserved(self):
        item = sample_item()
        item["secondLanguage"] = "# النص العربي\n\nهذا نص كتبه المؤلف."
        translator = MockTranslator()
        enriched = enrich_archive_translations({"items": [item]}, translator_factory=lambda: translator)["items"][0]
        self.assertEqual(enriched["translations"]["ar"]["contentMarkdown"], item["secondLanguage"])
        self.assertTrue(enriched["translations"]["ar"]["machineTranslated"], "metadata can still be auto-translated")

    def test_unchanged_source_reuses_cached_translation_without_loading_model(self):
        item = sample_item()
        first = enrich_archive_translations(
            {"items": [item]}, translator_factory=lambda: MockTranslator()
        )
        previous = copy.deepcopy(first)
        def forbidden_factory():
            raise AssertionError("cached translations should not load the model")
        second = enrich_archive_translations(
            {"items": [copy.deepcopy(item)]}, previous_data=previous, translator_factory=forbidden_factory
        )
        self.assertEqual(
            second["items"][0]["translations"],
            first["items"][0]["translations"],
        )

    def test_changed_source_invalidates_translation_cache(self):
        item = sample_item()
        first = enrich_archive_translations(
            {"items": [item]}, translator_factory=lambda: MockTranslator()
        )
        changed = copy.deepcopy(item)
        changed["contentMarkdown"] += "\nA new paragraph."
        calls = []
        def factory():
            calls.append(True)
            return MockTranslator()
        second = enrich_archive_translations(
            {"items": [changed]}, previous_data=first, translator_factory=factory
        )
        self.assertEqual(calls, [True])
        self.assertNotEqual(
            second["items"][0]["autoTranslation"]["sourceHash"],
            first["items"][0]["autoTranslation"]["sourceHash"],
        )


if __name__ == "__main__":
    unittest.main()
