# Document extraction

`@urkundenwerk/extraction` extracts a single-founder Musterprotokoll draft
from an uploaded formation document: ingestion, LLM extraction with
citations that our code verifies, and the evaluation
([ADR-0008](../../docs/adr/0008-ingestion-citations-and-evaluation.md),
[ADR-0009](../../docs/adr/0009-llm-extraction-with-verified-citations.md)).
The main entry is Node-only. `@urkundenwerk/extraction/contract` holds the
browser-safe result types, field kinds, and citation checks for review UIs.

1. Pass the upload bytes to `ingestDocument`. It returns a SHA-256 document ID,
   the detected format, normalized text, and ordered segments. PDF lines have
   one-based page numbers. DOCX paragraphs include table cells in document
   order.
2. An extraction adapter can use the segments as input and return an
   `ExtractionResult`. The Zod schema checks each value against the
   corresponding draft field and rejects duplicate paths. Omit unsupported
   fields and use `citation: null` when a predicted value cannot be anchored.
3. Resolve the adapter's quote with `locateQuote` and check the resulting
   `Citation` with `verifyCitation`. The review layer can display a source
   excerpt and let a human confirm each proposed value before saving it to a
   draft.

## LLM extraction

`extractDraftFields(doc, { client, model })` sends the segments to a model
through the `LlmClient` port of `@urkundenwerk/ai` and grounds the answer.

- **Prompt.** `EXTRACTION_SYSTEM_PROMPT` is static and versioned
  (`EXTRACTION_PROMPT_VERSION`) and is sent as a cacheable prefix. It lists
  every path in `extractionFieldPaths` with its meaning and format from
  `FIELD_SPECS`, and says that the document is untrusted data. The user turn
  holds the document as one `[s12] text` line per segment.
- **Answer.** `extractionOutputSchema`: an array of `{ path, value, quote,
segmentId }` and an array of `{ path, note }`. It is an array because
  structured outputs allow at most 16 union-typed and 24 optional properties.
- **Grounding.** `groundExtraction` normalises each value to the draft's type
  (`normaliseValue`), anchors the quote, scoped to the named segment when it
  repeats, checks that the quote states the value (`quoteSupportsValue`), and
  distrusts passages that read like instructions to an AI
  (`looksLikeInstruction`). Each path ends up `verified`, `unverified` with
  reasons, or `absent`, and the `ExtractionResult` carries every readable
  value with its anchored citation.
- **Failures.** `ExtractionError` has a code (`DOCUMENT_TOO_LONG` or an
  `LlmErrorKind`) and a message fit to show. Texts over 60,000 characters are
  refused before any call.
- **Fake.** `fakeExtractionResponder` finds a few fields with fixed patterns
  for local development and end-to-end tests. It is not a predictor.

## Normalization and offsets

- The normalized text uses Unicode NFC, expands the presentation ligatures
  from `ﬀ` through `ﬆ`, removes soft hyphens, and trims each segment after
  collapsing whitespace to single spaces. A single newline separates nonempty
  segments.
- PDF.js reads the text layer in content-stream order. Items are grouped by
  baseline position and orientation, with horizontal gaps treated as spaces.
  A trailing soft hyphen that survives PDF decoding joins the next line on the
  same page. Visible hyphens are preserved because the PDF may use them for
  compound names. Complex columns and layout can affect reading order.
- DOCX reads the WordprocessingML body, joins text runs, and converts tabs and
  explicit line breaks inside a paragraph to spaces. It skips separate parts
  for headers, footers, comments, and footnotes. Pagination depends on a Word
  layout engine, so DOCX sources have no page numbers.
- `start` is inclusive and `end` is exclusive. Both are UTF-16 code unit
  offsets into `SourceDocument.text`. The citation's `segmentId` must contain
  its starting offset. A citation can span several segments, and its quote
  must exactly equal `doc.text.slice(start, end)`.
- The locator prefers a unique verbatim match. Otherwise it accepts a unique
  match after collapsing whitespace and folding case, including across line
  breaks. It returns the original slice and offsets. Missing or ambiguous
  quotes return `null`. Add surrounding context to distinguish repeated
  passages.

## Upload limits

The default upload limit is 10 MiB. A caller can set a positive integer
`maxBytes`. The filename is accepted as upload metadata. Classification uses
the leading PDF or ZIP signature and, for a ZIP, the DOCX main-part content
type. Set the HTTP request size limit before buffering the upload.

| Error code           | Rejected input                                                                  |
| -------------------- | ------------------------------------------------------------------------------- |
| `INVALID_LIMIT`      | Invalid size-limit override                                                     |
| `FILE_TOO_LARGE`     | Upload above the byte limit                                                     |
| `UNSUPPORTED_FORMAT` | Unknown signature or ZIP without a recognized DOCX main part                    |
| `INVALID_PDF`        | Unreadable PDF                                                                  |
| `PDF_ENCRYPTED`      | Encrypted PDF, including password restrictions                                  |
| `PDF_PAGE_LIMIT`     | More than 30 PDF pages                                                          |
| `PDF_NO_TEXT`        | Empty or image-only PDF. OCR is outside the pipeline                            |
| `INVALID_DOCX`       | Unreadable ZIP or XML, duplicate ZIP entries, encrypted ZIP entries, or XML DTD |
| `DOCX_ARCHIVE_LIMIT` | More than 512 ZIP entries or more than 25 MiB declared uncompressed in total    |
| `DOCX_NO_TEXT`       | No extractable text in the DOCX body                                            |
| `TEXT_LIMIT`         | Extracted content exceeds the two-million UTF-16 unit budget                    |

Every code has a user-presentable message on `IngestionError`. The ZIP reader
checks the central directory before inflating any part, then streams just
`[Content_Types].xml` and `word/document.xml` with actual size validation. It
does not unpack entries to disk, follow relationships, or resolve XML entities
from external resources. PDF extraction uses [unpdf's serverless PDF.js build](https://github.com/unjs/unpdf)
and ZIP inspection uses [yauzl](https://github.com/thejoshwolfe/yauzl).

## Fictional evaluation corpus

Each case has a `source.json`, one rendered file, and a `gold.json` with all
30 draft field paths. A gold entry contains the expected value and a unique
source quote. A `null` entry means the field is absent. For an absent field
the predictor omits the entire field.

| Split | Statutory Musterprotokoll | Authored contract | Authored minutes | PDF | DOCX | Total |
| ----- | ------------------------: | ----------------: | ---------------: | --: | ---: | ----: |
| Dev   |                         2 |                 4 |                2 |   4 |    4 |     8 |
| Test  |                         6 |                 6 |                4 |   8 |    8 |    16 |
| Total |                         8 |                10 |                6 |  12 |   12 |    24 |

The statutory cases use the versioned repository template and fixed fictional
inputs, with seeded variations in dates, amounts, addresses, and identifiers.
The original German contracts cover the company's purpose and seat, capital,
representation, shareholder resolutions, financial year, notices, formation
costs, and closing provisions. The minutes include the notarial introduction,
identification, adoption of the articles, appointment resolutions, notices,
and closing. Competing values arise from ordinary provisions and records, such
as formation costs, earlier draft dates, the notary's official seat, and
people whose roles differ from that of the company director.

| Document kind             | Documents | Mean normalized characters | Gold values |
| ------------------------- | --------: | -------------------------: | ----------: |
| Statutory Musterprotokoll |         8 |                      1,712 |         168 |
| Authored contract         |        10 |                      3,511 |          74 |
| Authored minutes          |         6 |                      2,585 |         132 |
| Total                     |        24 |                            |         374 |

The authored PDFs are two pages each. The corpus has 120 gold values in dev
and 254 in test, covering all 30 paths in the test split. The 24 binaries
total about 1.65 MB.

The `adversarial` split holds one authored DOCX contract with a prompt
injection that asks an AI to set the share capital to 1 € and to enter
another founder. Its gold labels are the contract's real values, and tests
use it to check that the grounding does not verify injected values.

Use `dev` to develop predictors and prompts. Keep `test` fixed for
reporting, and never tune a predictor or prompt against its labels. The split is public and synthetic,
so results measure performance on these cases. In particular, the corpus
contains clean exports and supplies no evidence about scanned or real-world
notarial files.

```sh
pnpm --filter @urkundenwerk/extraction eval:build
pnpm --filter @urkundenwerk/extraction eval -- --predictor oracle --split test
pnpm --filter @urkundenwerk/extraction eval -- --predictor regex-baseline --split test
# With ANTHROPIC_API_KEY exported or in apps/web/.env.local:
pnpm --filter @urkundenwerk/extraction eval -- --predictor llm \
  --model claude-opus-5-5 --model claude-sonnet-5-5 --model claude-haiku-5-5
pnpm --filter @urkundenwerk/extraction eval -- --predictor llm --model claude-opus-5-5 --dry-run
```

Repeat `--predictor` and `--model` to compare runs in one table. `--effort`
(`low`, `medium`, `high`; default `medium`), `--concurrency` (default 4),
and `--timeout-ms` tune LLM runs. The first document runs alone so the
others can read its cached system prompt. A failed document counts as
predicting nothing. `--dry-run` estimates tokens and cost without calling
the API. The `fake` predictor runs the LLM plumbing with the scripted
responder and no network.

The runner ingests the committed binaries and checks each predictor result
with Zod before scoring. It writes Markdown and JSON to the git-ignored
`eval/results/` directory, with a `comparison-<split>.md` table that it
also prints. LLM runs also report the verified rate (predictions the
grounding verified), verified precision (verified values that were right),
latency, tokens, and a cost estimate from `MODEL_PRICES`. Other predictors
can implement `Predictor` and pass their results to `scoreEvaluation` from
`@urkundenwerk/extraction/eval`.
The normal workspace unit job validates that gold labels assemble into valid
drafts and that every gold quote resolves in its rendered document. It also
checks that each free-text value occurs verbatim within its evidence after
collapsing whitespace at line breaks. The oracle scores 100% under both
scoring modes on both splits.

## Scoring

- Strict scoring compares text after NFC normalization, ligature expansion,
  whitespace collapsing, and lowercasing. Dates use ISO calendar strings
  and amounts use integer euro cents. Map `Herrn` to `Herr` before validation.
- Lenient scoring also accepts a token F1 of at least 0.8 for
  `company.purpose`, `founder.identificationDetails`, and `notaryNotes`.
  It tokenizes letters, marks, and digits, treats punctuation as separators,
  and drops one leading German article. It counts shared tokens by occurrence
  and computes F1 as twice the overlap divided by the combined token count.
  The matcher measures word overlap and ignores word order. Names, addresses,
  identifiers, dates, amounts, and enums use strict scoring in both modes.
- A correct value is a true positive. A missing prediction for a present
  gold field is a false negative. A prediction for an absent field is a
  false positive. A wrong value for a present field counts as both a false
  positive and a false negative.
- Precision is TP / (TP + FP), recall is TP / (TP + FN), and F1 is their
  harmonic mean. Micro pools counts across fields and documents. Macro
  averages per-field metrics for the paths with at least one gold or
  predicted value. A zero denominator scores zero.
- A citation hits when the field value is correct, the citation verifies
  against the ingested text, and its span shares at least one code unit
  with the anchored gold evidence. Citation accuracy divides these hits
  by true positives. Grounded recall divides hits by all present gold
  labels. The JSON report includes field status and citation results for
  every document.

### Regex baseline on the test split

The regex baseline tries nine paths covering company data, numerical capital,
contribution, and founder identification. Its first-match heuristics
produced 66 correct values, 7 false positives, and 188 false negatives across
254 labelled fields. Of the correct values, 57 had a matching citation.
Both modes give the same counts for the regex baseline.

| Scope | Strict precision | Strict recall | Strict F1 | Lenient precision | Lenient recall | Lenient F1 | Citation accuracy¹ | Grounded recall¹ |
| ----- | ---------------: | ------------: | --------: | ----------------: | -------------: | ---------: | -----------------: | ---------------: |
| Micro |            90.4% |         26.0% |     40.4% |             90.4% |          26.0% |      40.4% |              86.4% |            22.4% |
| Macro |            26.7% |         16.8% |     20.4% |             26.7% |          16.8% |      20.4% |              24.3% |            13.9% |

¹ Citation accuracy and grounded recall are identical across modes for this baseline.
