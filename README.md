# Ahmad Sadek — Personal Archive

A bilingual (Arabic/English) personal archive built as a lightweight static site and hosted on GitHub Pages.

## Publishing model

The Publishing Studio is the only submission interface. It stores manuscripts as repository-native Markdown files under `content/`; GitHub Issues, issue forms, and issue-driven publication are not part of the publishing system.

Each publication has a `metadata.json` file and a `content.md` manuscript. Keep a work in `draft` status while preparing it, then change its status to `published` when it is ready. The build workflow validates the files and regenerates `archive.json`, standalone article pages, and `sitemap.xml`.

To manage existing work, open [Publishing Studio](/studio/). The Studio includes a link to **Publication Management**, where you can review the published list and permanently delete a publication. Deletion removes the publication's source folder from `content/`; the archive, generated article page, and sitemap are rebuilt automatically. Deletion requires a GitHub fine-grained token restricted to this repository with **Contents: Read and write**. The token is entered in the management page, used in memory for that session, and is not stored.

For PDFs and images, upload files under `assets/uploads/` and link them from the manuscript using site-root paths, for example `/assets/uploads/my-article/figure-1.png`. Deleting a publication removes its own `content/<type>/<slug>/` folder; separately uploaded assets are intentionally left untouched because they may be shared by other work.

## Language and translation policy

The interface is available in Arabic and English, but manuscripts are **not translated automatically**. The archive will never label an unreviewed machine-generated text as an accepted Arabic or English version.

A second-language manuscript may be supplied as a sibling Markdown file and referenced through `secondLanguageFile` in `metadata.json`. The reader displays that authored version when the visitor selects the other language. When no reviewed second-language manuscript exists, the reader keeps the original text and says that a reviewed translation has not been provided.

For pharmaceutical, medical, scientific, legal, or other specialist writing, a translation should be prepared or reviewed by a competent human translator with the relevant subject knowledge before publication. References, units, terminology, numbers, and claims must be checked against the original.

## Supported content

The article renderer supports headings, paragraphs, bold/italic text, links, images, ordered and unordered lists, block quotes, fenced code blocks, horizontal rules, and simple tables. Raw HTML from manuscripts is escaped. Links and image URLs are checked before rendering.

PDF attachments include an in-page preview where the browser supports it, plus an independent open/download link.

## Repository layout

- `index.html` — English homepage and language alternate links
- `ar/index.html` — Arabic-language landing page with its own canonical URL
- `assets/css/styles.css` — responsive editorial design and accessibility styles
- `assets/js/app.js` — bilingual navigation, search, archive lists, and article rendering
- `assets/js/article.js` — standalone article-page language handling
- `assets/js/markdown.js` — safe Markdown renderer
- `assets/js/studio-bootstrap.js` — loads the compressed Publishing Studio and its management link
- `assets/js/studio-manage.js` — authenticated publication deletion
- `studio/manage.html` — publication-management page
- `content/<type>/<slug>/metadata.json` and `content.md` — publication source records
- `assets/uploads/` — repository-hosted publication attachments
- `archive.json` — generated public content consumed by the archive
- `articles/<publication-id>/index.html` — generated standalone article pages
- `sitemap.xml` and `robots.txt` — search discovery files
- `scripts/build_archive.py` — builds the archive from published Markdown records and removes stale generated pages
- `.github/workflows/build-approved-archive.yml` — rebuilds the site after repository content changes
- `tests/test_build_archive.py` — file-based publishing, validation, page-generation, and sitemap tests
- `tests/test_markdown.js` — Markdown rendering and injection-safety tests

## Validation

Run the archive tests locally with Python 3.12 or newer:

```sh
python -m unittest discover -s tests -v
python -m py_compile scripts/build_archive.py tests/test_build_archive.py
python -m json.tool archive.json > /dev/null
node --check assets/js/markdown.js
node --check assets/js/app.js
node --check assets/js/article.js
node --check assets/js/studio-manage.js
node tests/test_markdown.js
```

GitHub Actions runs these checks for repository changes. Performance scores should be measured on the deployed site rather than inferred from source code alone.
