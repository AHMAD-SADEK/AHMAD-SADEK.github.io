import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch
from scripts.build_archive import build_archive, build_content_items, build_article_page, allowed_url, extract_links, image_url, render_markdown_static, write_article_pages, write_sitemap

def publication(root, slug, title="Title", status="published", content="Text.", date="2026-10-08"):
    folder=Path(root)/"writing"/slug;folder.mkdir(parents=True,exist_ok=True)
    (folder/"metadata.json").write_text(json.dumps({"title":title,"type":"writing","status":status,"language":"English","category":"Thought & Philosophy","date":date,"tags":["essay"]}),encoding="utf-8")
    if content is not None:(folder/"content.md").write_text(content,encoding="utf-8")
    return folder

class StudioArchiveTests(unittest.TestCase):
    def test_only_published_studio_items_are_exported(self):
        with tempfile.TemporaryDirectory() as root:
            publication(root,"live");publication(root,"draft",status="draft")
            result=build_archive(build_content_items(Path(root)));self.assertEqual(len(result["items"]),1);self.assertEqual(result["items"][0]["title"],"Title")
    def test_long_manuscripts_are_supported(self):
        with tempfile.TemporaryDirectory() as root:
            body=("A paragraph with a full manuscript.\n\n"*4000).strip();publication(root,"long",content=body)
            item=build_content_items(Path(root))[0];self.assertEqual(item["contentMarkdown"],body);self.assertGreater(len(body),65536)
    def test_published_item_requires_content(self):
        with tempfile.TemporaryDirectory() as root:
            publication(root,"missing",content=None)
            with self.assertRaisesRegex(ValueError,"missing content.md"):build_content_items(Path(root))
    def test_invalid_slug_is_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/"writing"/"Bad Slug";folder.mkdir(parents=True)
            (folder/"metadata.json").write_text(json.dumps({"title":"Bad","type":"writing","status":"published"}),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"Invalid publication slug"):build_content_items(Path(root))
    def test_archive_sorts_newest_first(self):
        with tempfile.TemporaryDirectory() as root:
            publication(root,"old","Old",date="2026-10-08");publication(root,"new","New",date="2026-10-09")
            self.assertEqual([x["title"] for x in build_archive(build_content_items(Path(root)))["items"]],["New","Old"])
    def test_article_page_escapes_script_breakout(self):
        with tempfile.TemporaryDirectory() as root:
            publication(root,"safe",content="Paragraph.\n\n</script><img src=x onerror=alert(1)>")
            page=build_article_page(build_content_items(Path(root))[0]);self.assertIn('id="articleData" type="application/json"',page);self.assertNotIn("</script><img src=x",page)
    def test_markdown_renderer_escapes_html_and_unsafe_urls(self):
        page=render_markdown_static("# Heading\n\n**Bold** [bad](javascript:alert(1))\n\n<script>x</script>")
        self.assertIn("<h2>Heading</h2>",page);self.assertIn("<strong>Bold</strong>",page);self.assertNotIn("<script>",page);self.assertNotIn("javascript:",page)
    def test_url_and_attachment_validation(self):
        self.assertEqual(allowed_url("https://user:pass@example.org/x"),"");self.assertEqual(allowed_url("javascript:alert(1)"),"")
        self.assertEqual(image_url("Note https://example.org/no"),"");self.assertEqual(image_url("https://example.org/a.png"),"https://example.org/a.png")
        self.assertEqual(extract_links("[PDF](https://example.org/a.pdf)"),[{"label":"PDF","url":"https://example.org/a.pdf"}])
    def test_stale_issue_article_pages_are_removed(self):
        with tempfile.TemporaryDirectory() as root:
            articles=Path(root)/"articles";old=articles/"3";old.mkdir(parents=True);(old/"index.html").write_text("legacy")
            notes=articles/"notes";notes.mkdir();(notes/"keep.txt").write_text("keep")
            with patch("scripts.build_archive.ARTICLES_DIR",articles):write_article_pages([])
            self.assertFalse(old.exists());self.assertTrue((notes/"keep.txt").exists())
    def test_sitemap_is_valid(self):
        with tempfile.TemporaryDirectory() as root:
            publication(root,"entry");item=build_content_items(Path(root))[0]
            with patch("scripts.build_archive.ROOT",Path(root)):write_sitemap([item])
            self.assertTrue((Path(root)/"sitemap.xml").is_file())

if __name__=="__main__":unittest.main()
