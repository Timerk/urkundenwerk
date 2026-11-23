# ADR-0012 · German and English UI with a cookie-based locale

## Context

Urkundenwerk is built for German law firms and notaries, but its UI was
English only. The UI must work in German, in the terms of art of a notary's
office, and in English, and users must be able to switch at any time
without losing typed input. The documents themselves stay German: the
statutory Musterprotokoll and the Handelsregisteranmeldung are German legal
texts (ADR-0002, ADR-0004). Core rules must keep stable codes, because
explanations, caches, the export route, and the MCP server rely on them
(ADR-0006, ADR-0011).

## Decision

**Library.** The web app uses [next-intl](https://next-intl.dev) 4, which
supports the App Router, Server Components, Server Actions, and Next.js 16
with React 19 (its plugin configures Turbopack). `useTranslations` works in
server and client components alike, ICU messages handle plurals and rich
text, and the messages are typed. We use it without i18n routing.

**Locale from a cookie, not the URL.** `src/i18n/request.ts` resolves the
locale per request: the `uw-locale` cookie if it holds `de` or `en`, then
the first supported language in `Accept-Language` by quality, then German.
URLs stay as they are, so links, the proxy matcher, and the export route are
unchanged. The root layout sets `<html lang>`. The switcher, DE | EN in the
public header and the app shell, is a Server Action form: it works before
hydration, and setting a cookie in a Server Action re-renders the current
page while client state is kept, so unsaved builder input survives a
switch. Pages that read the cookie render per request, which now includes
the landing and sign-in pages.

**Typed catalogues.** `src/i18n/messages/en.ts` is the reference catalogue
and types the keys and ICU arguments of `useTranslations`.
`de.ts` must have the same shape, which the compiler enforces. A test checks
that both have the same keys, no empty messages, and the same ICU arguments.
Server Actions and route handlers translate in the request's language, and
validation schemas carry message keys instead of English sentences.

**Language-neutral core.** Rule issues carry a code, params (numbers and
booleans only), and paths. `src/i18n/rule-messages.ts` maps each code to a
sentence in the UI language, choosing the wording from params and paths and
formatting amounts with `Intl`. Legal references are shown as the rules
state them. Core keeps its deterministic English `message` and `summary` for
logs, API diagnostics, the MCP server, and the model prompt; the web UI does
not show them. A test fails when a rule code has no message or summary in
either language.

**Locale-aware explanations.** `explainIssues` takes the locale. The system
prompt asks for German in the formal register with the statutory terms, or
for plain English, and the payload names the language. The cache key
includes the locale, and the prompt version changed to
`explain-2026-11-24`. Only the language code is added to the request, so no
personal data can travel with it. When no model answers, the panel shows the
rule's summary from the catalogue in the UI language.

**Formats.** Dates, amounts, and times use `Intl` with `de-DE` or `en-GB`:
`20.11.2026` and `25.000 €` in German, `20/11/2026` and `€25,000` in
English, in German time. Date fields are text inputs that show and accept
`TT.MM.JJJJ` or `DD/MM/YYYY` and store ISO dates, because the native date
input follows the browser's locale and showed US dates to German users.
Amount fields use the UI language's separators.

## Consequences

Every user-facing string lives in two catalogues, and adding a rule means
adding its message and summary in both languages, or a test fails. English
users type amounts as `25,000`; the deed and the exports keep German
formatting in both languages. A document's default title is created in the
creator's language and stays as created. Explanations are cached per
language, so switching languages can cost one more model call per issue.
More languages would need only another catalogue and an entry in `LOCALES`;
the cookie approach would not give search engines a URL per language, which
this authenticated tool does not need.
