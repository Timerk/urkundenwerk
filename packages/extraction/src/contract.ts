// Browser-safe part of the package: the result contract, citations, and field
// kinds, without ingestion or model calls. Review UIs import this entry.
export {
  citationSchema,
  locateQuote,
  verifyCitation,
  type Citation,
} from "./citations";
export {
  FIELD_SPECS,
  fieldKind,
  type FieldKind,
  type FieldSpec,
} from "./fields";
export {
  extractedFieldSchema,
  extractionFieldPaths,
  extractionFieldPathSchema,
  extractionResultSchema,
  isFieldValue,
  type ExtractedField,
  type ExtractionFieldPath,
  type ExtractionFieldValue,
  type ExtractionResult,
} from "./result";
export type { SourceDocument, SourceSegment } from "./source";
export type {
  ExtractionReview,
  FieldReview,
  FieldStatus,
  UnverifiedReason,
} from "./llm/service";
