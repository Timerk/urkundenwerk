/**
 * Upload limits for contract imports. The browser checks them before
 * uploading, and the server action checks them again, because a client
 * check is only a convenience.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx"] as const;
export const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
/** For the file input's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = [
  ...ACCEPTED_EXTENSIONS,
  ...ACCEPTED_TYPES,
].join(",");

export const UPLOAD_MESSAGES = {
  missing: "Choose a PDF or DOCX file to import.",
  type: "Only PDF and DOCX files can be imported. Export the contract as PDF or DOCX and try again.",
  empty: "The file is empty. Choose the contract again.",
  size: `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Upload the formation deed or the articles on their own.`,
} as const;

/** The first problem with a file before it is uploaded, if any. */
export function checkUpload(file: {
  name: string;
  size: number;
}): string | undefined {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return UPLOAD_MESSAGES.type;
  }
  if (file.size === 0) return UPLOAD_MESSAGES.empty;
  if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_MESSAGES.size;
  return undefined;
}
