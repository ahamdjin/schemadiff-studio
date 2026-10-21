# SchemaDiff Studio

An open-source, readable OpenAPI change-review workbench. Built by [Ahmad Yar](https://www.ahmadyar.co/).

**Functional first implementation:** compare two pasted OpenAPI JSON or YAML documents, review the changelog and potentially breaking changes, and download a Markdown report. The comparison runs server-side using [oasdiff](https://github.com/oasdiff/oasdiff) (Apache-2.0), rather than reinventing its 400+ change classifications.

## Local setup

Prerequisites: Node.js 20+ and the **oasdiff** CLI available on PATH ([install instructions](https://www.oasdiff.com/docs/getting-started)).

    npm install
    npm start

Visit `http://127.0.0.1:4170`. The `PORT` variable changes the port. By default the server only binds to localhost; set `HOST=0.0.0.0` for deployment behind a trusted HTTPS proxy.

Run unit tests with `npm test`. Integration tests against a real oasdiff installation remain to be run before launch.

## Security and privacy

- No URL import: specs must be pasted. Document size is limited to 400 KiB each.
- The app sends pasted specs to **your instance's server** for analysis. Do not paste secrets into a public instance. No analytics or database in this MVP.
- oasdiff executes as a subprocess on the server with a timeout and explicit `--allow-external-refs=false`. We deliberately do not use its remote reference fetching or the upload-capable `--open` flag.
- Never deploy this development server on the public internet without HTTPS, rate limiting, resource constraints, and request monitoring.
- Outputs are rendered as plain text, not HTML generated from arbitrary user inputs.

## Why this tool

An API diff is not just a wall of red and green JSON. SchemaDiff separates actionable potentially breaking changes from a fuller changelog, allowing a developer to share a Markdown review without guessing what an OpenAPI edit means.

## Upstream and attribution

[oasdiff](https://github.com/oasdiff/oasdiff) is an independent Apache-2.0 licensed project. This repository invokes a separately installed oasdiff binary rather than copying its source. All upstream rights and notices remain with oasdiff contributors. Original UI and integration code Copyright © 2026 Ahmad Yar, MIT licensed.

## Related work

[API Contract Inspector MCP](https://github.com/ahamdjin/api-contract-inspector-mcp) provides an MCP interface for similar checks using the same upstream engine, for assistant workflows.

**Status:** Source MVP in development, not an announced or independently hosted SaaS release.
