const messages = {
  FILE_TOO_LARGE: "The document exceeds the upload size limit.",
  UNSUPPORTED_FORMAT: "Upload a PDF or DOCX document.",
  INVALID_LIMIT: "The upload size limit must be a positive integer.",
  INVALID_PDF: "The PDF could not be read.",
  PDF_ENCRYPTED: "Export an unencrypted copy of the PDF and upload it again.",
  PDF_PAGE_LIMIT: "The PDF exceeds the 30-page limit.",
  PDF_NO_TEXT:
    "The PDF has no text layer. Scanned PDFs require OCR, which is unavailable.",
  INVALID_DOCX: "The DOCX could not be read.",
  DOCX_ARCHIVE_LIMIT:
    "The DOCX contains too many entries or expands beyond the size limit.",
  DOCX_NO_TEXT: "The DOCX body contains no extractable text.",
  TEXT_LIMIT: "The document contains too much text to extract.",
} as const;

export type IngestionErrorCode = keyof typeof messages;

export class IngestionError extends Error {
  constructor(readonly code: IngestionErrorCode) {
    super(messages[code]);
    this.name = "IngestionError";
  }
}

export const MAX_TEXT_UNITS = 2_000_000;
