# Ahmad Sadek — Personal Archive

A bilingual (Arabic/English) personal archive built as a lightweight static site and hosted on GitHub Pages.

## How publishing works

1. Open the repository's **Issues** page and choose the appropriate Issue Form (Article, Research, Book, Project, Idea, or Personal).
2. Complete the title, category, language, content, and any metadata or file links.
3. New submissions default to **Draft**. Keep the item as a draft while writing and reviewing it.
4. Change **Publication Status** to **Published** only when the work is ready to be public.
5. The archive is generated automatically from open issues authored by the repository owner account, `AHMAD-SADEK`, with an explicit Published status. Issues from other accounts, closed issues, drafts, and pull requests are not exported.
6. To unpublish an item, change its Publication Status back to **Draft** or close its issue. Reopen the issue and set it to Published to republish.

Do not put passwords, access tokens, private correspondence, or other secrets in issue bodies: issue data is stored in GitHub.

## Supported content

The article renderer supports headings, paragraphs, bold/italic text, links, images, ordered and unordered lists, block quotes, fenced code blocks, horizontal rules, and simple tables. Raw HTML from issue content is escaped. Links and image URLs are checked before rendering.

Links entered under **PDF / Files** appear as attachments. PDF attachments include an in-page preview where the browser supports it, plus an independent open/download link.

## Repository layout

- `index.html` — page structure and metadata
- `assets/css/styles.css` — responsive editorial design and accessibility styles
- `assets/js/app.js` — bilingual navigation, search, archive lists, and article pages
- `assets/js/markdown.js` — safe Markdown renderer
- `archive.json` — generated public content consumed by the site
- `scripts/build_archive.py` — fetches issue metadata and generates the approved archive
- `.github/workflows/build-approved-archive.yml` — refreshes the archive when an issue changes
- `.github/ISSUE_TEMPLATE/` — content submission forms
- `tests/test_build_archive.py` — publication-policy and URL-validation tests

## Validation

Run the archive tests locally with Python 3.12 or newer:

```sh
python -m unittest discover -s tests -v
python -m py_compile scripts/build_archive.py tests/test_build_archive.py
python -m json.tool archive.json > /dev/null
node --check assets/js/markdown.js
node --check assets/js/app.js
```

GitHub Actions runs these checks for repository changes. Performance scores should be measured on the deployed site rather than inferred from source code alone.
