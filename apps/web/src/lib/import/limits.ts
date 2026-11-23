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

export const MAX_UPLOAD_MEGABYTES = MAX_UPLOAD_BYTES / 1024 / 1024;

/** A problem with an upload; `import.upload.<problem>` words it. */
export type UploadProblem = "missing" | "type" | "empty" | "size";

/** The first problem with a file before it is uploaded, if any. */
export function checkUpload(file: {
  name: string;
  size: number;
}): UploadProblem | undefined {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "type";
  }
  if (file.size === 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "size";
  return undefined;
}
