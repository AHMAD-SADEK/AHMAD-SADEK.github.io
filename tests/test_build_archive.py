import unittest

from scripts.build_archive import (
    build_archive,
    build_item,
    explicitly_published,
    extract_links,
    image_url,
    parse_form_fields,
    SCHEMAS,
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

    def test_unsafe_cover_scheme_is_rejected(self):
        self.assertEqual(image_url('<img src="javascript:alert(1)">'), "")

    def test_attachment_links_are_extracted_only_as_http_urls(self):
        items = extract_links("[Paper.pdf](https://example.org/paper.pdf)\njavascript:alert(1)")
        self.assertEqual(items, [{"label": "Paper.pdf", "url": "https://example.org/paper.pdf"}])

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
