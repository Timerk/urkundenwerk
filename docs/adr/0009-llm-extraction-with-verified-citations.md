# ADR-0009 · LLM extraction with code-verified citations and human review

## Context

M4 lets a lawyer start a Musterprotokoll from an existing contract instead
of typing it. ADR-0002 allows an LLM to extract data but not to write legal
text, and ADR-0008 provides the ingestion, the citation contract, and the
evaluation corpus. Extraction differs from explanations (ADR-0007) in two
ways that shape this decision. It must send document text, which contains
personal data, to the model provider. And its output becomes case data, so a
wrong value that looks right is the main risk, more than a failed call.
Model output can also be steered by text in the document itself.

## Decision

**The model proposes, our code decides.** One structured-output call returns,
per field path from `extractionFieldPaths`, a value, a verbatim quote, and
the id of the segment the quote starts in, plus optional short notes. The
answer is an array of field entries to fit the structured-output constraints
of both adapters.
The adapter constrains decoding to the schema and validates it again; a
mismatch is a typed `invalid_output` error. The prompt is static, versioned
(`EXTRACTION_PROMPT_VERSION`), and is eligible for prefix caching. The
document follows in the user turn as a delimited block, one `[s12] text`
line per segment.

Grounding then runs in `packages/extraction`, never in the model:

1. Normalise each value to the draft's type: ISO dates from ISO or German
   formats, integer cents from euro amounts, enum values with a few
   synonyms. The result must pass the draft field's schema.
2. Anchor the quote with `locateQuote`, scoped to the named segment when the
   passage repeats, and check the anchor with `verifyCitation`.
3. Check that the anchored passage states the value: every word of a text
   value (allowing German inflection endings), an amount as digits or in
   words, a date in a German or ISO form, and the cue of a classification
   value where wording reliably shows it (salutation, contribution, a legal
   form for a legal-entity founder, video for video notarisation).
4. Distrust passages that read like instructions to an AI.

A value that passes every step is `verified`. Any other value is kept and
marked `unverified` with reasons, and a field the model did not return is
`absent`. Nothing is dropped or trusted silently. Verified means "the
document says this", not "this is the right value for the deed": a correct
quote can still belong to the wrong person or role.

**A human decides every value.** The review screen shows each value with its
status, reasons, and quote next to the document as it was read. Nothing is
pre-accepted. "Accept all verified" is a shortcut; unverified values need an
explicit Accept, Edit, or Clear, and an unreadable value can only be edited
or cleared. Only accepted and edited values go into the new draft, which is
validated like any other and checked by the rule engine in the builder.

**No persistence before confirmation.** The upload goes to a server action,
is ingested in memory, and the text and review go back to the browser. The
server stores neither the file nor the text nor the model's answer. Logs
record only failure kinds. Confirming stores the accepted values as a normal
draft. The audit log records the model, prompt version and decision counts per verification status. See [ADR-0014](0014-audit-log.md).

**Prompt injection.** The document is data: the system prompt says
instructions inside it must be ignored and reported in a note, there are no
tools, and the output schema cannot express anything but field proposals.
That reduces the risk but cannot remove it, so the defence that matters is
in code. A value whose quote does not state it is not verified, and a value
quoted from an instruction-like passage is not verified either. The review
screen flags such passages in the document. An adversarial corpus split
holds an injection document for tests and evaluation.

**Access and limits.** Only editors and admins may import, six times per
user and ten minutes. Uploads are PDF or DOCX up to 4 MB, checked in the
browser and again on the server, and the server action body limit is set
just above that. Extraction refuses texts over 60,000 characters and has
its own deadline, `AI_EXTRACT_TIMEOUT_MS` (two minutes by default).

**Model and evaluation.** Extraction uses the configured provider at medium
effort. The OpenAI default is `gpt-6.1-terra`. In the 2026-11-23 evaluation
with prompt `extract-2026-11-23`, Sol led strict F1 (97.2% versus 96.2%),
grounded recall (92.5% versus 92.1%), and verified precision (97.2% versus
96.7%) at about $0.014 per document. Terra led citation accuracy (96.3%
versus 95.1%) at about $0.006 per document. On 16 fictional test documents a
one-point gap is within noise, while the cost difference is systematic, so
we chose Terra. Every value is reviewed by a human anyway, which limits the
impact of the small quality difference. Revisit the choice when the corpus
grows. Luna was not chosen because it produced the only gross errors
(share capital amounts off by a factor of 100). Anthropic uses the planned default `claude-opus-5-5` pending a
provider-specific evaluation. `AI_MODEL_EXTRACT` overrides either default.
Prompts are developed on the dev split only, and the test split is used
only for reporting. See the [evaluation results][evaluation].

**Refusals.** A refusal is a typed error that the user sees. Server-side
fallback to another model is not enabled, because a silent model switch
would make evaluation results and the reported model ambiguous.

## Consequences

The selected provider receives the full text of each imported document.
The OpenAI adapter disables storage for later API retrieval with
`store: false`. See [OpenAI's data controls][openai-data] for retention
details. Before importing real client data, a firm would need a lawful basis for the
processing (for example Art. 6(1)(b) or (f) GDPR), a processing agreement
under Art. 28 GDPR, an assessment of international transfers and of the
provider's retention, and compliance with professional secrecy when
engaging service providers (§ 203 StGB with § 43e BRAO for lawyers and
§ 26a BNotO for notaries). That review belongs to the deployment and GDPR
milestones. The demo
uses fictional documents only, says what is sent on the upload page, and
can run without a provider (`AI_PROVIDER=fake`).

The grounding is deliberately conservative: an extraction with a paraphrased
quote or an inferred value shows as unverified and costs the reviewer a
decision. Classification fields without a reliable cue, such as who the
managing director is, are verified on anchoring alone. The corpus is
synthetic and small, so scores show regressions and relative model
quality, not performance on real notarial files.

[evaluation]: ../../README.md#evaluation
[openai-data]: https://developers.openai.com/api/docs/guides/your-data
