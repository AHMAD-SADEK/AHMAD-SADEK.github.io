# Repository-native publishing

This folder is the source of truth for long-form publications. It is file-based: no external database, CMS, hosting provider, or service account is required.

## Create a publication

Create a folder under the matching type:

- `content/writing/<slug>/` — articles and essays
- `content/research/<slug>/` — research papers and reports
- `content/book/<slug>/` — books and book notes
- `content/project/<slug>/` — projects
- `content/idea/<slug>/` — ideas
- `content/personal/<slug>/` — personal writing

Every publication requires `metadata.json` and `content.md`.

Example `metadata.json`:

```json
{
  "title": "The title of the work",
  "subtitle": "An optional short description",
  "type": "writing",
  "category": "thought",
  "language": "Arabic",
  "author": "Ahmad Sadek",
  "date": "2026-11-05",
  "status": "draft",
  "tags": ["essay", "philosophy"],
  "coverImage": "",
  "abstract": "",
  "readingTime": ""
}
```

Only `title`, `type`, and `status` are required. Type must be one of `writing`, `research`, `book`, `project`, `idea`, or `personal`. Status must be `draft` or `published`. Draft manuscripts remain in the repository but are excluded from the public archive. Never store secrets or credentials in this public repository.

Put the complete work in `content.md`. There is no GitHub Issue body limit on this file. Use Markdown headings, lists, tables, quotations, code blocks, links, images, and references naturally. References do not need a separate metadata field; keep them in the manuscript where they belong.

Optional sibling Markdown files may be referenced with `secondLanguageFile` and `referencesFile`, each containing a simple filename such as `content-en.md` or `references.md`. Optional `attachments` and `links` accept external HTTPS URLs. Upload images and documents under `assets/uploads/` and link to them in the manuscript using site-root paths.

## Automatic Arabic–English versions

Every published item is prepared in both Arabic and English. The language selected for the manuscript remains the canonical original; GitHub Actions generates the other language with the open-source M2M100 neural translation model. The generated version is stored with the archive data, so switching the site language does not wait for a live translation service.

The original text is preserved. A manually supplied second-language manuscript takes precedence over automatic translation for the article body. Automatically translated text is marked as machine-translated in the reader. Please review medical, pharmaceutical, scientific, legal, and other specialist terminology before relying on a translated version.

Translations are generated during publication builds and reused when the original manuscript has not changed.

## Publish, edit, and unpublish

- **Draft:** leave `"status": "draft"`.
- **Publish:** change it to `"status": "published"` and commit.
- **Edit:** edit `content.md` or `metadata.json` and commit.
- **Unpublish:** change the status back to `"draft"`.
- **Delete:** remove the publication folder and commit.

GitHub Actions validates the content, builds `archive.json`, creates the standalone article page, and updates the sitemap. Existing GitHub Issue publications continue to work alongside these files.
