# Design direction

## Audience and job

German notaries, lawyers, and paralegals who prepare a GmbH formation. They
read deeds all day and trust exact wording, not decoration. The interface has
one job: collect structured case data quickly and show, at every moment, the
deed that this data produces. It must feel calm and precise, like a well-kept
file, and must not look like a generic SaaS dashboard or any existing
legal-tech product.

## Concept: the form filled in ink

The Musterprotokoll is itself a statutory form with blanks. The preview shows
it that way. Missing values are dotted lines labelled with what belongs there,
and every value from the form appears in blue-black document ink with a faint
wash. The paper preview is the one bold element. Everything around it stays
quiet: plain sans-serif controls, hairline rules, no shadows except on the
sheet itself.

Selecting a value or a blank on the sheet moves focus to its field. Focusing a
field marks its values on the sheet. The landing page writes the fictional
example into the sheet once on load. This is the only motion that is not a
response to the user, and it is skipped when reduced motion is preferred.

## Type

- **Source Serif 4** is used for text that belongs to the deed: the preview,
  document titles, and empty-state headings. It is the face that the PDF and
  DOCX exports embed, so the preview reads like the download.
- **Instrument Sans** is used for the tool: labels, controls, and status. It is
  a compact grotesque with clear figures for dates, deed numbers, and amounts.

The scale is a 1.2 ratio from a 16 px body. Labels are sentence case and never
set in all caps. German terms of art stay in German where they are the precise
term, with a short English gloss: Firma (company name), Stammkapital (share
capital), Geschäftsführer (managing director).

## Colour

| Token        | Hex       | Use                                                        |
| ------------ | --------- | ---------------------------------------------------------- |
| `ink`        | `#18213a` | Text and primary actions; blue-black like document ink     |
| `stamp`      | `#2b46a6` | Filled values on the sheet, focus rings, links in the deed |
| `paper`      | `#ffffff` | The sheet and form controls                                |
| `surface`    | `#f4f6f9` | Application background                                     |
| `desk`       | `#e6eaf0` | The area the sheet lies on                                 |
| `alert`      | `#b3261e` | Errors that block an export                                |
| `hint`/amber | `#74490a` | The demonstration notice and guidance                      |

All text colours meet WCAG AA against their backgrounds. Light mode only for
now; the tokens are CSS variables in `apps/web/src/app/globals.css` (Tailwind
v4 `@theme`), so a dark theme can redefine them later.

## Layout principles

- **Two panes, one truth.** On wide screens the form sits on the left in a
  readable column and the sheet stays in view on the right. On narrow screens a
  Form/Preview toggle replaces the second pane; choosing a value in the preview
  switches back to the form and focuses the field.
- **Order follows the deed.** Sections run Notarisation, Founder, Company,
  Capital, Geschäftsführer, Notes, in the order the clauses use them. Sections
  are not numbered because the deed's own clause numbers are different.
- **Status is information.** Each section reports what is still missing. The
  toolbar shows the save state (`aria-live`) and how many fields remain, and
  the download buttons explain themselves instead of silently doing nothing.
- **Rules as guidance.** Findings of the core rule engine appear next to the
  field as soon as their inputs exist: errors in alert red, warnings and notes
  in place of the hint. Descriptions explain the rule before it is broken.
- **One list of checks.** The Checks panel above the form groups the same
  findings into "To correct", "Worth checking", and "Notes", each with a
  3 px rule in its severity colour like a `Notice`. Legal references are set
  in the deed's serif, because they belong to the law rather than the tool.
  "Go to …" focuses the field as the preview does.
- **AI stays labelled.** An explanation sits in a pale stamp-blue box headed
  "AI-generated explanation — not legal advice", with the model and prompt
  version in small print. The rule's own summary, shown when no model
  answers, uses a neutral box without that label.
- **One radius per role.** Controls use 4 px, panels 6 px, and the sheet has
  square corners because paper does.

## Accessibility

Native inputs and radio groups, with labels, descriptions, hints, and errors
linked through `aria-describedby`. Segmented controls are real radio groups.
Values on the sheet are keyboard-focusable and named, for example "Missing:
Sitz (registered seat)". Focus is always visible, and scrolling leaves room
for the sticky toolbar. Viewers get a read-only form with a notice instead of
disabled controls they cannot explain.

## Components

`apps/web/src/components/ui` holds the primitives: `Button`, `Field` with
`TextInput`, `TextArea`, and `Select`, `SegmentedControl`, `Notice`, and
`Section`. `DocumentPreview` renders any core `DocumentModel` and adds only
layout and field affordances; it never changes the wording. `ChecksPanel`
renders rule issues and their explanations; it never changes an issue.
