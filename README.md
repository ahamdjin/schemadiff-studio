# SchemaDiff Studio

An open-source visual workbench for reviewing API contract changes. Project by [Ahmad Yar](https://www.ahmadyar.co/).

## Project direction

The planned comparison engine is [oasdiff](https://github.com/oasdiff/oasdiff) (Apache-2.0), used as an explicitly attributed upstream dependency rather than copying or misrepresenting its source. We will build original UX around readable breaking-change reports, examples, and guided review.

**Status:** Initial project setup; no published application or verified API-diff capability yet. Do not submit this as a finished product.

## License and upstream

Before incorporating upstream code, retain applicable Apache-2.0 notices and comply with its terms. Until the integration is implemented, this repository contains only project planning and attribution. The project is independent of the oasdiff maintainers.

## Proposed MVP

- Compare two user-supplied OpenAPI specs securely.
- Display changes grouped by endpoint and severity.
- Explain breaking changes and allow a Markdown report export.
- Tests for removed endpoints, required fields, and compatible additions.

## Related planned project

[API Contract Inspector MCP](https://github.com/ahamdjin/api-contract-inspector-mcp) will expose contract comparison to MCP clients once a tested engine is available.
