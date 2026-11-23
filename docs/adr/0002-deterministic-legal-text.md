# ADR-0002 · Deterministic legal text

## Context

The GmbH formation documents must be reproducible and traceable to a specific
version of the legal text and the case data used to assemble them.

## Decision

Render legal text from versioned templates and validated structured data. Use
LLMs only for extraction and explanations. Validate extracted data with Zod before
it reaches the template engine.

## Consequences

The same template version and inputs produce the same document text for review
and regression testing. Legal text changes require an explicit template update.
Extraction quality can be evaluated independently of rendering.
