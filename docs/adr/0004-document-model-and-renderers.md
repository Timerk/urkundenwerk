# ADR-0004 · Shared document model and server-side renderers

## Context

The single-founder Musterprotokoll needs a live preview and two downloadable
formats. Each format must render the same versioned statutory wording alongside
the validated case data. The PDF renderer must run in a Node serverless function.

## Decision

Core validates the case with Zod and produces a renderer-neutral
`DocumentModel`. It contains headings, paragraphs, numbered clauses, signature
blocks, and text runs with optional field provenance or an unfilled field path.
A template registry exposes each template's version, legal source, schema, and builder.
The browser can render the model directly, and core can flatten it to plain
text for golden tests.

Use [docx](https://docx.js.org/) for editable Word paragraphs and
[PDFKit](https://pdfkit.org/docs/getting_started.html) for PDF text layout.
PDFKit wraps text across A4 pages and embeds a font subset with JavaScript
dependencies, without a browser or native PDF runtime. The Node package
bundles the regular TrueType face from
[Adobe Source Serif 4.005](https://github.com/adobe-fonts/source-serif/releases/tag/4.005R)
with its SIL Open Font License. Both formats embed it for consistent German
typography. When deploying the Node renderer, include the font asset with the
server bundle. The static file read is relative to the rendering module.

## Consequences

Both exporters use the same text, with layout and pagination handled in Node.
PDFKit derives the PDF ID from fixed document metadata. The DOCX packer uses
wall-clock dates and generates a fresh font key, so the renderer replaces
both dates, the key and its matching font obfuscation, and the ZIP timestamps.
Tests compare export bytes across different clock times and check exported text
against a committed golden.

The statutory identity blank is assembled from the structured founder fields,
plus any supplied identification details. Salutations, payment timing, and
video wording follow the template's alternatives. The version is the DiRUG
effective date for the source text.

The in-person template appends a procedural signature block after the
statutory text. DOCX links its paragraphs for pagination, and PDF measures
the whole block before placing it. Statutory-fidelity tests compare the
blocks sourced from Anlage 1 a). Video exports end at clause 7 and leave
qualified electronic signing to the external notarisation workflow.
