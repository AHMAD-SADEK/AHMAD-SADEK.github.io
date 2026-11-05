# Repository-native publishing

This folder is the single source of truth for publications. All published work is stored as Markdown and metadata files in this repository.

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
  "language": "English",
  "author": "Ahmad Sadek",
  "date": "2026-11-05",
  "status": "draft",
  "tags": ["essay", "philosophy"],
  "coverImage": "",
  "abstract": "",
  "readingTime": "",
  "secondLanguageFile": ""
}
```

Only `title`, `type`, and `status` are required. Type must be one of `writing`, `research`, `book`, `project`, `idea`, or `personal`. Status must be `draft` or `published`. Draft manuscripts remain in the repository but are excluded from the public archive. Never store secrets or credentials in this public repository.

Put the complete original work in `content.md`. Use Markdown headings, lists, tables, quotations, code blocks, links, images, and references naturally. Keep references with the manuscript where appropriate.

## Human-reviewed second-language versions

The site does not generate automatic translations. When a human-reviewed second-language manuscript is ready, save it as a sibling Markdown file, such as `content-ar.md`, and set `"secondLanguageFile": "content-ar.md"` in `metadata.json`. The manuscript's `language` field identifies the original language; the second-language file is the authored version for the other language.

The reader displays the supplied second-language manuscript when available. If the file is absent, visitors see the original text with a notice that no reviewed translation has been supplied. There is no automatic substitution with machine-generated prose.

For specialist material, including pharmaceutical, medical, scientific, and legal writing, translations must be reviewed by a person with relevant language and subject-matter competence. Verify terminology, numerical values, units, references, and the meaning of every claim against the original before publishing.

Optional sibling Markdown files may also be referenced with `referencesFile`. Optional `attachments` and `links` accept external HTTPS URLs. Upload images and documents under `assets/uploads/` and link to them in the manuscript using site-root paths.

## Publish, edit, unpublish, and delete

- **Draft:** leave `"status": "draft"`.
- **Publish:** change it to `"status": "published"` and commit.
- **Edit:** edit `content.md` or `metadata.json` and commit.
- **Unpublish:** change the status back to `"draft"`.
- **Delete:** use **Publication Management** from the Publishing Studio. This permanently removes the publication's source folder from the repository and triggers archive regeneration.

The build workflow validates the content, builds `archive.json`, creates standalone article pages, removes stale generated pages, and updates the sitemap.
