import { musterprotokollTemplate } from "./musterprotokoll-einpersonen/template";

const templates = {
  [musterprotokollTemplate.metadata.id]: musterprotokollTemplate,
} as const;

export type TemplateId = keyof typeof templates;

export function getTemplate<T extends TemplateId>(id: T): (typeof templates)[T];
export function getTemplate(
  id: string,
): (typeof templates)[TemplateId] | undefined;
export function getTemplate(id: string) {
  return Object.hasOwn(templates, id) ? templates[id as TemplateId] : undefined;
}
