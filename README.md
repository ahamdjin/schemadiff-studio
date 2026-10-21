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
- **Portable review packets:** export a validated, versioned JSON review file and import it later (or give the file to a teammate to continue triaging). The original spec files aren't included.
- **Manual browser snapshots:** name a review, optionally add a reviewer, and explicitly save up to 8 review snapshots on this device. Open them again after a refresh, update decisions/checklist, and save.
- Export a review to **Markdown** (including checked steps) or **JSON** (counts, findings, triage decisions, review metadata, and checklist).
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
- **Saving is opt-in:** changes remain only in the current page until you click **Save on this browser** or download a JSON/Markdown review. There is no background sync.
- Browser storage and downloaded review packets exclude the **raw OpenAPI source specs**, but include paths, change descriptions, analysis reports, user-entered notes, and API metadata. These **can be commercially sensitive**; only save or share data you are authorized to disclose.
- Local browser snapshots are **not encrypted** and can be accessed by other people or scripts with the same browser profile/origin. They can disappear when browsing data is cleared. Review JSON is not encrypted either.
- Imported reviews undergo strict schema/version checks, size limits, structural validation, and text-only rendering. Import does not execute arbitrary code, fetch network resources, or automatically overwrite a local snapshot.
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
5. Give the review a title and optionally a reviewer name. Click **Save on this browser** for a manual local snapshot.
6. Later use **Saved reviews** to reopen it; edit decisions and save again. Download **Export JSON** for a portable, versioned review packet.
7. Give that JSON file to a teammate using your normal approved secure file-sharing process. They can use **Import review file** to resume triage, save their own browser copy, and return a new file. **This is file-based handoff, not real-time collaboration, remote storage, identity verification, or multi-user synchronization.**
8. Attach exported Markdown or JSON to a release issue/pull request as appropriate.

## Quality gates

```bash
npm test       # endpoint inventory, oasdiff integration, input safety, UI element wiring
npm run build  # test suite + script syntax checks
```

The engine integration test uses a real removed-endpoint OpenAPI comparison rather than only stubbed responses. Playwright browser smoke tests cover guided review, file uploads, mobile layout, local saves, reload/reopen, triage edits, and JSON export/import. Extended accessibility audits, production rate limits, and large-spec performance testing remain on the roadmap.

## Relationship to oasdiff

The comparison engine and its rule coverage belong to [oasdiff](https://github.com/oasdiff/oasdiff) (Apache-2.0), wrapped by [oasdiff-js](https://github.com/mattiacerutti/oasdiff-js) (Apache-2.0). Those projects already provide sophisticated CLI and browser diff capabilities. **SchemaDiff Studio does not claim to replace their detection rules or official hosted comparison UI.** Its original value is the release decision workflow, endpoint inventory, review planning, and lightweight exports.

Original user interface and application code © 2026 Ahmad Yar, MIT. Not affiliated with the upstream projects.

## Next work

- More granular test checklist generation linked to exact change classes.
- Approval owner/date semantics and an auditable review history, avoiding misleading multi-user collaboration claims.
- Enhanced privacy for confidential API contracts (encrypted storage and approved enterprise sharing only after a threat-model review).
- Browser-level accessibility, security and cross-browser smoke tests.

No marketplace or directory listing is implied by publishing the code.
