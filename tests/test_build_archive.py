from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import build_archive as builder


class ArchiveBuilderTests(unittest.TestCase):
    def sample_item(self, item_id: int = 7, title: str = "A test article") -> dict:
        return {
            "id": item_id,
            "title": title,
            "subtitle": "A short summary",
            "type": "writing",
            "category": "thought",
            "language": "English",
            "primaryLanguage": "en",
            "author": "Ahmad Sadek",
            "date": "2026-11-05",
            "readingTime": "2 min",
            "tags": ["essay"],
            "coverImage": "",
            "abstract": "",
            "contentMarkdown": "A reviewed source manuscript.",
            "secondLanguage": "",
            "referencesMarkdown": "",
            "attachments": [],
            "links": [],
            "projectStatus": "",
            "technologies": [],
            "sourceUrl": "https://github.com/AHMAD-SADEK/AHMAD-SADEK.github.io/tree/main/content/writing/a-test-article",
        }

    def test_only_published_repository_markdown_is_loaded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            published = root / "writing" / "published-entry"
            draft = root / "writing" / "draft-entry"
            published.mkdir(parents=True)
            draft.mkdir(parents=True)
            (published / "metadata.json").write_text(json.dumps({
                "title": "Published entry",
                "type": "writing",
                "category": "thought",
                "language": "English",
                "date": "2026-11-04",
                "status": "published",
                "secondLanguageFile": "content-ar.md",
                "tags": ["essay", "research"],
            }), encoding="utf-8")
            (published / "content.md").write_text("# Original manuscript\n\nReviewed source.", encoding="utf-8")
            (published / "content-ar.md").write_text("# النص المراجع\n\nترجمة بشرية مراجعة.", encoding="utf-8")
            (draft / "metadata.json").write_text(json.dumps({
                "title": "Draft entry", "type": "writing", "status": "draft"
            }), encoding="utf-8")
            (draft / "content.md").write_text("Not public.", encoding="utf-8")

            items = builder.build_content_items(root)
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["title"], "Published entry")
            self.assertEqual(items[0]["secondLanguage"], "# النص المراجع\n\nترجمة بشرية مراجعة.")
            self.assertEqual(items[0]["primaryLanguage"], "en")
            self.assertTrue(items[0]["sourceUrl"].endswith("/content/writing/published-entry"))

    def test_archive_contains_only_file_items_and_sorts_by_date(self):
        older = self.sample_item(1, "Older")
        older["date"] = "2026-10-01"
        newer = self.sample_item(2, "Newer")
        newer["date"] = "2026-11-01"
        archive = builder.build_archive([older, newer])
        self.assertEqual([item["title"] for item in archive["items"]], ["Newer", "Older"])
        self.assertEqual(archive["version"], 1)

    def test_duplicate_publication_ids_are_rejected(self):
        with self.assertRaises(ValueError):
            builder.build_archive([self.sample_item(1), self.sample_item(1, "Duplicate")])

    def test_article_page_contains_standalone_content_and_metadata(self):
        html = builder.build_article_page(self.sample_item())
        self.assertIn('rel="canonical"', html)
        self.assertIn("/articles/7/", html)
        self.assertIn("A test article", html)
        self.assertIn("articleData", html)

    def test_stale_generated_article_pages_are_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = builder.ARTICLES_DIR
            try:
                builder.ARTICLES_DIR = Path(tmp) / "articles"
                builder.ARTICLES_DIR.mkdir()
                (builder.ARTICLES_DIR / "3").mkdir()
                (builder.ARTICLES_DIR / "3" / "index.html").write_text("stale", encoding="utf-8")
                (builder.ARTICLES_DIR / "keep").mkdir()
                builder.write_article_pages([self.sample_item(7)])
                self.assertFalse((builder.ARTICLES_DIR / "3").exists())
                self.assertTrue((builder.ARTICLES_DIR / "7" / "index.html").is_file())
                self.assertTrue((builder.ARTICLES_DIR / "keep").is_dir())
            finally:
                builder.ARTICLES_DIR = original

    def test_sitemap_contains_only_current_publications(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = builder.ROOT
            try:
                builder.ROOT = Path(tmp)
                builder.write_sitemap([self.sample_item(7)])
                sitemap = (Path(tmp) / "sitemap.xml").read_text(encoding="utf-8")
                self.assertIn("/articles/7/", sitemap)
                self.assertNotIn("/articles/3/", sitemap)
            finally:
                builder.ROOT = original

    def test_unsafe_urls_are_rejected(self):
        self.assertEqual(builder.allowed_url("javascript:alert(1)"), "")
        self.assertEqual(builder.allowed_url("https://example.org/paper.pdf"), "https://example.org/paper.pdf")


if __name__ == "__main__":
    unittest.main()
