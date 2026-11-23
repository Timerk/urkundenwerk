export type InlineRun =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "field"; readonly path: string; readonly text: string }
  | { readonly kind: "blank"; readonly path: string };

export type DocumentBlock =
  | {
      readonly kind: "heading" | "paragraph";
      readonly runs: readonly InlineRun[];
    }
  | {
      readonly kind: "clause";
      readonly number: number;
      readonly runs: readonly InlineRun[];
    };

export interface DocumentModel {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly title: string;
  readonly blocks: readonly DocumentBlock[];
}

export interface TemplateMetadata {
  readonly id: string;
  readonly version: string;
  readonly legalBasis: string;
  readonly sourceUrl: string;
}
