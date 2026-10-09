import json
import re
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

from scripts.build_archive import (
    build_archive,
    build_article_page,
    build_item,
    allowed_url,
    explicitly_published,
    extract_links,
    image_url,
    render_markdown_static,
    parse_form_fields,
    SCHEMAS,
    write_article_pages,
    write_sitemap,
)

OWNER = "AHMAD-SADEK"


def issue(body, *, number=1, login=OWNER, state="open", pull_request=False):
    result = {
        "number": number,
        "title": "[Article]",
        "body": body,
        "state": state,
        "user": {"login": login},
        "created_at": "2026-10-08T20:00:00Z",
        "html_url": f"https://github.com/AHMAD-SADEK/AHMAD-SADEK.github.io/issues/{number}",
    }
    if pull_request:
        result["pull_request"] = {"url": "https://api.github.com/example"}
    return result


def article_body(status="Published / منشور", content="A useful article."):
    return f"""### Content Type

Article / مقال

### Category

Thought & Philosophy / الفكر والفلسفة

### Language

English / English

### Publication Status

{status}

### Title

A safe title

### Subtitle

A summary

### Author

Ahmad Sadek

### Date

2026-10-08

### Tags

learning, philosophy

### Reading Time

3 min

### Cover Image

_No response_

### Abstract / Summary

An abstract

### Content

{content}

### Second Language Version

_No response_

### References

_No response_

### PDF / Files

_No response_
"""


class ArchiveBuilderTests(unittest.TestCase):
    def test_only_explicit_published_value_is_accepted(self):
        self.assertTrue(explicitly_published({"Publication Status": "Published / منشور"}))
        self.assertTrue(explicitly_published({"Publication Status": "منشور"}))
        self.assertFalse(explicitly_published({"Publication Status": "Draft / مسودة"}))
        self.assertFalse(explicitly_published({"Publication Status": "Unpublished"}))
        self.assertFalse(explicitly_published({"Publishing": "- [x] Public"}))

    def test_draft_is_not_exported(self):
        self.assertIsNone(build_item(issue(article_body("Draft / مسودة"))))

    def test_published_owner_article_is_exported(self):
        result = build_item(issue(article_body()))
        self.assertIsNotNone(result)
        self.assertEqual(result["title"], "A safe title")
        self.assertEqual(result["type"], "writing")
        self.assertEqual(result["category"], "thought")
        self.assertEqual(result["primaryLanguage"], "en")
        self.assertEqual(result["date"], "2026-10-08")
        self.assertEqual(result["tags"], ["learning", "philosophy"])

    def test_primary_language_uses_form_choice_and_script_detection(self):
        body = article_body().replace("English / English", "Arabic / العربية")
        arabic = build_item(issue(body))
        self.assertEqual(arabic["primaryLanguage"], "ar")
        body = article_body().replace("English / English", "Bilingual / ثنائية اللغة").replace(
            "A useful article.", "هذه مادة مكتوبة باللغة العربية."
        )
        bilingual_arabic = build_item(issue(body))
        self.assertEqual(bilingual_arabic["primaryLanguage"], "ar")

    def test_non_owner_author_cannot_publish(self):
        self.assertIsNone(build_item(issue(article_body(), login="someone-else")))

    def test_closed_issue_is_not_exported(self):
        self.assertIsNone(build_item(issue(article_body(), state="closed")))

    def test_pull_request_is_not_exported(self):
        self.assertIsNone(build_item(issue(article_body(), pull_request=True)))

    def test_no_publication_status_is_not_exported(self):
        body = article_body().replace("### Publication Status\n\nPublished / منشور\n\n", "")
        self.assertIsNone(build_item(issue(body)))

    def test_content_headings_do_not_steal_later_form_fields(self):
        body = article_body(content="Paragraph one.\n\n### References\n\nThis is part of the article text.")
        fields = parse_form_fields(body, SCHEMAS["writing"])
        self.assertIn("### References", fields["Content"])
        self.assertEqual(fields["References"], "")

    def test_markdown_field_like_headings_do_not_split_article_body(self):
        body_text = (
            "Main paragraph.\n\n"
            "### Second Language Version\n\nThis is part of the article.\n\n"
            "### References\n\nA heading about references, not the form field.\n\n"
            "### PDF / Files\n\nThis heading belongs to the article."
        )
        fields = parse_form_fields(article_body(content=body_text), SCHEMAS["writing"])
        self.assertEqual(fields["Content"], body_text)
        self.assertEqual(fields["Second Language Version"], "")
        self.assertEqual(fields["References"], "")
        self.assertEqual(fields["PDF / Files"], "")

    def test_unsafe_cover_scheme_is_rejected(self):
        self.assertEqual(image_url('<img src="javascript:alert(1)">'), "")

    def test_attachment_links_are_extracted_only_as_http_urls(self):
        items = extract_links("[Paper.pdf](https://example.org/paper.pdf)\njavascript:alert(1)")
        self.assertEqual(items, [{"label": "Paper.pdf", "url": "https://example.org/paper.pdf"}])

    def test_article_page_has_unique_metadata_and_escapes_script_breakout(self):
        dangerous = article_body(content="A harmless paragraph.\n\n</script><img src=x onerror=alert(1)>")
        item = build_item(issue(dangerous, number=27))
        page = build_article_page(item)
        self.assertIn('rel="canonical" href="https://ahmad-sadek.github.io/articles/27/"', page)
        self.assertIn('property="og:type" content="article"', page)
        self.assertIn('id="articleData" type="application/json"', page)
        self.assertIn(r"\u003c/script\u003e", page)
        self.assertNotIn("</script><img src=x", page)
        self.assertIn("A harmless paragraph.", page)
        self.assertNotIn("<img src=x onerror=alert(1)>", page)
        self.assertNotIn("<script>alert", page)
        payload = re.search(r'<script id="articleData" type="application/json">(.*?)</script>', page, re.S)
        self.assertIsNotNone(payload)
        decoded = json.loads(payload.group(1))
        self.assertIn("</script><img src=x", decoded["contentMarkdown"])

    def test_static_markdown_renderer_escapes_html_and_rejects_unsafe_urls(self):
        source = "# Heading\n\n**Bold** [unsafe](javascript:alert(1))\n\n<script>alert(1)</script>\n\n![x](javascript:alert(1))"
        rendered = render_markdown_static(source)
        self.assertIn("<h2>Heading</h2>", rendered)
        self.assertIn("<strong>Bold</strong>", rendered)
        self.assertNotIn("<script>", rendered)
        self.assertNotIn('href="javascript:', rendered)
        self.assertNotIn('src="javascript:', rendered)

    def test_external_urls_reject_credentials_and_cover_prose(self):
        self.assertEqual(allowed_url("https://user:pass@example.org/file.pdf"), "")
        self.assertEqual(allowed_url("javascript:alert(1)"), "")
        self.assertEqual(image_url("An explanatory note: https://example.org/not-a-cover"), "")
        self.assertEqual(image_url("https://example.org/cover.png"), "https://example.org/cover.png")
        self.assertEqual(image_url("http://example.org/cover.png"), "")

    def test_unpublished_article_pages_are_removed_without_deleting_other_folders(self):
        item = build_item(issue(article_body(), number=44))
        with tempfile.TemporaryDirectory() as temp_dir:
            articles_dir = Path(temp_dir) / "articles"
            notes_dir = articles_dir / "notes"
            notes_dir.mkdir(parents=True)
            (notes_dir / "keep.txt").write_text("keep", encoding="utf-8")
            with patch("scripts.build_archive.ARTICLES_DIR", articles_dir):
                write_article_pages([item])
                self.assertTrue((articles_dir / "44" / "index.html").is_file())
                write_article_pages([])
                self.assertFalse((articles_dir / "44").exists())
                self.assertTrue((notes_dir / "keep.txt").is_file())

    def test_sitemap_is_valid_xml_and_contains_standalone_article_urls(self):
        item = build_item(issue(article_body(), number=45))
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch("scripts.build_archive.ROOT", Path(temp_dir)):
                write_sitemap([item])
            sitemap_path = Path(temp_dir) / "sitemap.xml"
            root = ET.parse(sitemap_path).getroot()
            namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            locations = [node.text for node in root.findall("sm:url/sm:loc", namespace)]
            self.assertIn("https://ahmad-sadek.github.io/", locations)
            self.assertIn("https://ahmad-sadek.github.io/articles/45/", locations)

    def test_archive_is_sorted_newest_first_and_only_contains_approved_content(self):
        older = issue(article_body(), number=1)
        newer = issue(article_body().replace("A safe title", "New article"), number=2)
        newer["created_at"] = "2026-10-09T11:00:00Z"
        draft = issue(article_body("Draft / مسودة"), number=3)
        result = build_archive([older, draft, newer])
        self.assertEqual([item["id"] for item in result["items"]], [2, 1])
        self.assertEqual(result["version"], 1)


if __name__ == "__main__":
    unittest.main()
