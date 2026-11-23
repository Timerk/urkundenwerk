# ADR-0007 · Ingestion with verifiable source offsets

## Context

An imported formation document needs a review trail from each proposed draft
value to the text that supports it. LLM output varies, so the source parser,
citation validation, and evaluation need stable contracts.

## Decision

Keep byte ingestion and the extraction result schema in a Node-only
workspace package. Use the text layer of PDFs and the main WordprocessingML
body of DOCX files. Identify an upload by the SHA-256 hash of its bytes.
Produce normalized text once and address it with half-open UTF-16 spans.
Store the segment ID and verbatim slice in a citation. Allow whitespace- and
case-tolerant quote location only when it yields a unique anchor at the
selected match level. Verify the final citation with an exact slice check.

Check signatures, input size, PDF page count and encryption, ZIP expansion
and entry count, and extracted text size. Keep OCR outside the ingestion
contract. Reuse the draft field schemas so a result describes proposals
that a later, human-reviewed import can apply to an incomplete draft.

Evaluate structured values and their evidence on a fixed split of fictional
statutory and independently authored documents. Commit their sources,
rendered bytes, and gold labels together. Count unsupported predictions
as false positives and wrong values as both false positives and false
negatives. Use verbatim gold spans for free-text fields and publish strict
and lenient scores side by side. Lenient scoring uses token overlap only
for company purpose, founder identification details, and notary notes.
Publish per-field metrics, micro and macro averages, and citation overlap
for correct values. Use grounded recall to report how often a gold field
is both extracted and supported. Run the oracle during unit tests and keep
a deterministic regex baseline for model comparisons.

## Consequences

A reviewer can recover the exact excerpt from the normalized source without
trusting model offsets. Changes to the parser or normalization can change
offsets for the same upload bytes, so persisted citations must be paired
with the normalized source they reference. PDF reading order and DOCX
paragraph boundaries reflect the available text layer. Ambiguous quotes
require more context from the extraction adapter.

The benchmark is reproducible and can reveal regressions in value extraction
or grounding. It measures the committed synthetic cases. Keep predictor
development on the dev split and report scores on the test split with the
predictor version. [The package README](../../packages/extraction/README.md)
records limits, normalization, and the initial baseline.
