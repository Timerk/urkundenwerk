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
set in all caps. The UI is German or English. German uses the terms of a
notary's office and the formal „Sie“. English keeps German terms of art where
they are the precise term, with a short gloss: Firma (company name),
Stammkapital (share capital), Geschäftsführer (managing director). Dates and
amounts follow the UI language (`07.03.1990`, `25.000 €` or `07/03/1990`,
`€25,000`); the deed is always German.

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
- **Two documents in one draft.** The builder toolbar switches between the
  Musterprotokoll and the Handelsregisteranmeldung. Each step shows its
  preview, checks and downloads. Selecting a shared value in the filing
  preview opens its field in the Musterprotokoll.
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
- **Review beside the source.** The contract import keeps the builder's two
  panes: extracted values in the form's sections on the left, and the
  uploaded document as it was read on a sheet on the right, in the deed's
  serif. Quoted passages carry the stamp-blue wash of filled values; a
  passage behind an unverified value is amber with a dotted underline, and a
  passage that reads like an instruction to an AI is set off in alert red.
  Choosing a value marks its passage, and choosing a passage focuses its
  value. Each value shows "Verified in source" or "Unverified" with the
  reason, its quote in the serif, and Accept, Edit, and Clear. The screen is
  headed "AI-extracted — review every value; not legal advice". On narrow
  screens a Values/Document toggle replaces the second pane.
- **Language at hand.** A DE | EN control, drawn like the pane toggle with
  the current language filled in ink, sits at the right of the app header,
  in the top right corner of the landing page, and above the sign-in card.
  Switching keeps everything typed. Layouts allow for German, which runs
  about a third longer: toolbars and button rows wrap rather than overflow.
- **Firm on the left, person on the right.** The app header carries the
  firm and its sections, Documents, Members and, for admins, the audit log,
  as tabs underlined in ink along its bottom edge (`aria-current="page"`).
  The signed-in person, their Account link, the language control and Sign
  out sit on the right, because they belong to the person, not the firm.
  Below `lg` the tabs move to a second row that ends with the account icon.
  Settings and list pages share the dashboard's 5xl column and its
  `PageHeader`: a title and one sentence that names the firm or account.
- **One radius per role.** Controls use 4 px, panels 6 px, and the sheet has
  square corners because paper does.

## Patterns for firm and account pages

- **Destructive actions confirm in place.** Remove, Revoke, Leave firm and
  Delete account first show a quiet red trigger. It opens a `ConfirmPanel`
  where the control was: a 3 px alert rule on an alert wash, a question
  that names the person, firm or invitation, one sentence on what is lost
  and what stays, the action again as a solid alert button with the same
  verb, and Cancel. Focus moves to the question; Escape or Cancel closes
  the panel and returns focus to the trigger. There are no browser
  `confirm()` dialogs and no modals. Account deletion keeps its confirmation
  checkboxes inside the panel, and firms that will be deleted with the
  account are listed beforehand in a hint box.
- **Results are announced where they stay visible.** A role save reports
  next to its row through an always-present `role="status"` region. A
  result that removes its own row, such as a removal or a revocation, is
  announced in one status line above the lists, which also takes focus so
  keyboard users are not left on a control that no longer exists. Errors
  use `role="alert"`. Buttons say what they are doing while pending
  ("Saving…", "Removing…").
- **Change only what changed.** A member's role is a select; Save and
  Cancel appear only once it differs from the stored role.
- **Activity as a timeline.** The audit log and a document's Verlauf share
  `AuditList`: events grouped by German calendar day (headed "Today /
  Tuesday, 24 November 2026"), the time in tabular figures on the left, and
  a hairline rail with a stamp-blue dot per event, alert red for deletions
  and removals. Each event reads as "Document edited by Erik Editor" with
  its details below; changed fields fold after five. Document titles are
  set in the deed's serif, link to the document, and offer "Show only this
  document". Closed, the Verlauf panel says what happened last.
- **Settings rows.** The account page pairs a heading and one sentence on
  the left with the control on the right (`SettingsRow`), stacked on narrow
  screens. What a download contains or what a deletion does is a short
  list, not a paragraph.
- **Empty states invite the next step.** Empty lists use the dashboard's
  dashed panel with a serif heading and one sentence; filtered views add
  "Reset filters". The unconfigured legal notice says who must act and how.

## Accessibility

Native inputs and radio groups, with labels, descriptions, hints, and errors
linked through `aria-describedby`. Date fields are text inputs whose format,
`TT.MM.JJJJ` or `DD/MM/YYYY`, is their description, because native date
pickers follow the browser's locale rather than the UI's. `<html lang>`
follows the UI language, the deed preview is marked `lang="de"`, and blanks
in it carry the UI language. Segmented controls are real radio groups.
Values on the sheet are keyboard-focusable and named, for example "Missing:
Sitz (registered seat)". Focus is always visible, and scrolling leaves room
for the sticky toolbar. Viewers get a read-only form with a notice instead of
disabled controls they cannot explain.

## Components

`apps/web/src/components/ui` holds the primitives: `Button`, `Field` with
`TextInput`, `TextArea`, and `Select`, `SegmentedControl`, `Notice`, and
`Section`, plus `ConfirmPanel` and `StatusMessage` for destructive
confirmation and announced results. `PageHeader`, `SettingsRow` and
`AuditList` sit in `apps/web/src/components`.

`DocumentPreview` renders any core `DocumentModel` and adds only layout
and field affordances; it never changes the wording. `ChecksPanel` renders
rule issues and their explanations; it never changes an issue.
