# SchemaDiff Studio

**The diff is data. The decision is yours.** A free, open-source API release-review workbench by [Ahmad Yar](https://www.ahmadyar.co/).

**Website:** https://schemadiff-studio.vercel.app/

Unlike another generic API diff viewer, SchemaDiff Studio helps developers turn an OpenAPI baseline and revision into a **release-review pack**: actionable endpoint inventory, proven breaking-change findings, a manual release checklist, and machine-readable/Markdown exports.

## Features

- Compare pasted or locally uploaded **OpenAPI 3.x / Swagger JSON or YAML** files (max 400 KiB per spec).
- Backed by the real [oasdiff](https://github.com/oasdiff/oasdiff) engine through [@oasdiff-js/oasdiff-js](https://github.com/mattiacerutti/oasdiff-js), not hand-written guesses about breaking changes.
- **Endpoint impact inventory:** added, removed, edited, unchanged operations, matched by exact HTTP method + path. Search and filter the inventory.
- **Compatibility findings:** engine-derived findings and separate full Markdown breaking-change / changelog reports.
- **Release readiness checklist:** human-review steps automatically suggested based on changes; check off steps as you perform them.
- Export a review to **Markdown** (including checked steps) or **JSON** (counts, findings and report, with no raw specs embedded).
- Guided example involving added/removed operations and a newly required parameter.
- Responsive accessible interface; no app account, tracking SDK, or database in the application source.

## Run locally

Requires Node.js **22** or compatible and npm:

```bash
npm install
npm test
npm start
```

Open http://127.0.0.1:4170. Your installation includes the platform-dependent oasdiff binary through the JavaScript wrapper. A separately installed Go CLI is **not required** for the hosted analysis code.

For iterative development run `npm run dev`. To run the deployment test gate: `npm run build`.

## Security, privacy and limits

- Specs are **sent from the browser to your configured server** to analyze. There is no automatic external URL loading. **Do not paste secrets or confidential contracts into a public instance.**
- The server doesn't intentionally persist supplied specs, but your hosting provider might log metadata. We do **not** claim end-to-end encryption or purely on-device processing.
- External, remote and relative-file `$ref` references are refused; only local `#/...` references are allowed in this hosted MVP.
- YAML is parsed with unique keys and limited aliases. Input size and complexity are capped; results are rendered as text rather than untrusted HTML.
- API change review isn't a formal compatibility proof. Runtime behavior, clients, authentication and environment differences still require testing.
- The operation impact inventory does *exact* method/path matches. Renamed paths show as removed+added, and an edited operation may be documentation-only.
- Public deployments should apply upstream rate limiting and abuse protection. This MVP is not a private contract vault.

## How release review works

1. Choose the existing baseline and proposed revision by pasting specs or uploading files.
2. Inspect the compatibility banner, operation totals, and oasdiff findings.
3. Filter operations and findings; consult the raw reports for detail.
4. Work through the release checklist with your team.
5. Export a Markdown or JSON review and attach it to your issue or pull request.

## Quality gates

```bash
npm test       # endpoint inventory, oasdiff integration, input safety, UI element wiring
npm run build  # test suite + script syntax checks
```

The engine integration test uses a real removed-endpoint OpenAPI comparison rather than only stubbed responses. Browser-level, accessibility audit, production rate limits and large-spec performance testing remain on the roadmap.

## Relationship to oasdiff

The comparison engine and its rule coverage belong to [oasdiff](https://github.com/oasdiff/oasdiff) (Apache-2.0), wrapped by [oasdiff-js](https://github.com/mattiacerutti/oasdiff-js) (Apache-2.0). Those projects already provide sophisticated CLI and browser diff capabilities. **SchemaDiff Studio does not claim to replace their detection rules or official hosted comparison UI.** Its original value is the release decision workflow, endpoint inventory, review planning, and lightweight exports.

Original user interface and application code © 2026 Ahmad Yar, MIT. Not affiliated with the upstream projects.

## Next work

- Human-in-the-loop approval notes per finding, with editable owner and disposition.
- Named release snapshots and team review without leaking proprietary contracts.
- More granular test checklist generation linked to exact change classes.
- Browser-level accessibility, security and cross-browser smoke tests.

No marketplace or directory listing is implied by publishing the code.
