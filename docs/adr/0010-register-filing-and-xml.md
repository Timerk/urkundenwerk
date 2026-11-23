# ADR-0010 · Register filing from the formation draft

## Context

A cash formation with the single-founder Musterprotokoll also needs a
Handelsregisteranmeldung. Both outputs use the same company and the director
appointed in the deed. The filing adds an address, facts about the contribution,
and assurances that can be confirmed after preparing the deed.

## Decision

Add an optional `filing` section to the saved draft under ADR-0005. The
register court, domestic business address, amount paid, three assurances and
optional payment evidence belong there. Company, founder and director stay in
the deed fields. The filing identifies the director directly from the
appointment. Both views use the existing row, autosave and RLS policies.
Contract extraction supplies only deed fields. The filing's separate rules
run in addition to the deed rules for filing exports.

The authored filing template has its own ID and version and emits the same
`DocumentModel` as the deed under ADR-0004. The case row keeps its immutable
deed template ID and version. The supported deed version supplies the source
data for the current filing template. A filing export records both template
versions in its generator metadata. Preserving a filed revision would require
pinning its filing version and locking its data when finalisation is added.

When the builder changes the appointed identity, it clears the assurances for
that person. Changing the paid amount clears the free-disposal confirmation.

Keep the project's XSD next to the domain types in `packages/core/schemas`.
The Node-only `@urkundenwerk/core/register-filing-xml` entry point uses
[xmlbuilder2](https://github.com/oozcitak/xmlbuilder2) for structured XML
writing and [xmllint-wasm](https://github.com/noppa/xmllint-wasm) to run libxml2
schema validation without a native addon. The dependency is MIT-licensed and
has published releases across the 5.x series, including 5.3.0. Next.js traces
the worker and WASM assets into the export function. The web route checks the
stored draft through RLS and validates each generated XML document before
sending it. Failure logs carry a fixed message.

## Consequences

Existing drafts keep working for deed exports. Filing PDF, DOCX and XML
downloads require the additional fields. The XML uses its own versioned
namespace. It can represent lists of shareholders and directors, while the
current case model fills one of each. Money is stored in cents and exported
as EUR decimals. The business rules apply across fields before serialization.
The caller supplies a generation timestamp, so identical data and timestamps
yield identical XML.

Signature, certification, actual attachments and electronic submission
remain in the notarial workflow. See the
[XJustiz mapping](../xjustiz-mapping.md) for the production boundary.
