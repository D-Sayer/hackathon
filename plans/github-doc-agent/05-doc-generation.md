# 05 Doc Generation

## Objective
Implement the doc-writing slice: turn a positive classification result into concrete MDX updates inside the Fumadocs content tree, while enforcing strict path and content safety.

## Allowed Write Scope
- Only create or update files under `apps/fumadocs/content/docs`.
- Only write documentation file types intended for Fumadocs content, primarily `.mdx`.
- Do not modify source code, configs, or files outside the docs root in v1.

## Generation Strategy
- Prefer updating an existing relevant page when one clearly matches the impacted area.
- Create a new page only when no existing page is a good fit.
- Preserve current docs tone and frontmatter conventions.
- Feed the model enough context to write repo-specific docs rather than generic product copy.

## Inputs To The Writer
- structured classification result
- relevant PR metadata
- selected code or diff context
- current contents of candidate docs pages
- allowed docs root path

## File Targeting Rules
- Resolve candidate pages from the classifier output and current docs tree.
- Keep generated file paths deterministic and slug-safe.
- Reject any path traversal or absolute-path output.
- If no target page is suitable, create a clearly named new MDX page in the nearest appropriate docs area.

## Validation And Safety
- Validate that every generated file path remains inside `apps/fumadocs/content/docs`.
- Reject outputs that attempt to modify unsupported file types.
- Require generation to return structured file operations rather than raw free-form text only.
- Preserve frontmatter where updating existing pages.
- Keep content changes limited to documentation prose and examples.

## Dry-Run Workflow
- In dry-run mode, generate the proposed file operations and show a diff or patch summary without writing to GitHub.
- Use this mode to refine prompts and file-targeting rules before enabling branch writeback.

## Tests For This Slice
- update an existing page
- create a new page when needed
- reject an out-of-scope path
- reject non-doc file output
- validate that generated content is shaped for MDX docs usage

## Done Criteria
- Positive classifications yield a deterministic set of doc file operations.
- All outputs stay inside the Fumadocs docs root.
- Dry-run mode can show proposed changes without opening a PR.
- Tests cover update, create, and path-safety behavior.
