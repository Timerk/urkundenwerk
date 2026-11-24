# Demo video script

A two-minute screen recording of Urkundenwerk for the README. It shows the
hosted demo, one terminal clip of Claude Code using the MCP server, and the
repository. Every name, firm, and document in it is fictional.

## Before recording

- **Screen.** Record at 1920 × 1080 (or 2560 × 1440 scaled to 1080p) at
  30 fps. Close notifications and other apps.
- **Browser.** Use a clean Chrome profile with the bookmarks bar hidden
  (`Ctrl+Shift+B`), no extensions in the toolbar, and zoom at 110 % so
  the form and preview are readable in a compressed video. Keep the
  window at full screen width, so the builder shows the form and the
  preview side by side.
- **Data.** Use the seeded demo data on <https://urkundenwerk.vercel.app>.
  Record shortly after the nightly reset, or check that the Nord sample
  draft (complete Musterprotokoll and filing) is unchanged. Sign in as
  **Erik, editor, Demo-Kanzlei Nord**.
- **Import file.** Have a fictional contract from
  [`packages/extraction/eval/dev`](../packages/extraction/eval/dev) ready
  in a folder that shows nothing else. Do not upload real documents.
- **AI.** Check that the daily AI budget is not used up (one explanation
  works) before recording.
- **Terminal.** For the MCP clip, run Claude Code against the **local**
  stack (`pnpm db:start`, `pnpm db:env`) with the MCP server registered as
  in the [MCP README](../apps/mcp/README.md). Use a large font (18 pt or
  more), a dark theme, and a short prompt line. Make sure no environment
  variable, key, or password is visible in the scrollback.
- **Audio.** Record the voice-over separately and lay it under the video.
  Keep each line short; cut silence rather than speeding up the video.

## Shot list

| Time      | Show                                                                                        | Click or type                                                                                                                                                        | Voice-over                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:10 | Landing page in English with the "Not legal advice" notice visible.                         | Nothing; slow scroll by a few lines.                                                                                                                                 | "Urkundenwerk prepares the documents to found a German GmbH. The legal text is deterministic. AI only helps with the data, and a human checks it." |
| 0:10–0:18 | Sign-in page with the fictional demo accounts.                                              | Click **Erik, editor, Demo-Kanzlei Nord**. The documents list appears.                                                                                               | "The demo has shared fictional accounts. One click signs in."                                                                                      |
| 0:18–0:40 | Builder of the Nord sample draft: form left, live A4 preview right.                         | Change the Stammkapital to `20.000`. The preview updates, and the Checks panel shows a capital error.                                                                | "The form follows the deed. The preview is built from the same model as the PDF and Word exports."                                                 |
|           | The error in the Checks panel with its code and legal reference.                            | Click **Explain** on the finding. The AI explanation appears with its label. Set the capital back to `25.000`.                                                       | "Rules decide what is wrong, with a legal reference. An LLM may explain the finding in plain language, but it never decides."                      |
| 0:40–1:05 | Documents list, then **Import from contract**.                                              | Upload the prepared fictional contract. Wait for the review screen (cut the waiting time).                                                                           | "You can also start from an existing contract."                                                                                                    |
|           | Review screen: values with verified or unverified badges, the source document on the right. | Click a verified value; its passage is highlighted. Click one unverified value and show the reason. Accept, then **Create draft**.                                   | "The model must quote its source. Our code checks every quote against the document. Nothing is saved until a person reviews each value."           |
| 1:05–1:25 | The Nord sample draft, **Handelsregisteranmeldung** step with the filing preview.           | Switch to the filing step. Click **Download XML**. Open the file briefly in the browser or an editor.                                                                | "The same draft produces the register filing, as PDF, Word, and XML validated against a schema."                                                   |
| 1:25–1:33 | The builder header.                                                                         | Click **DE**. The UI switches to German with typed values kept, then switch back to **EN**, or stay in German.                                                       | "The interface is German or English. The documents are always German."                                                                             |
| 1:33–1:42 | The **Activity** panel (Verlauf in German) of the draft.                                    | Open the activity panel. Point at the entries for the capital change and the XML export.                                                                             | "Every change and export is in an audit log written by the database. It records which fields changed, not their values."                           |
| 1:42–1:52 | Terminal: Claude Code with the Urkundenwerk MCP server.                                     | Prompt: `Create a Musterprotokoll for Beispiel Software UG with 1,000 euros capital, check it, and list what is missing.` Show the tool calls and the rule findings. | "An agent can do the same through an MCP server. It signs in as the user, so the database enforces the same permissions."                          |
| 1:52–2:00 | GitHub: the README top with the green CI badge, then the commit list of `master`.           | Scroll the README to the architecture diagram, then show the Actions tab with green runs.                                                                            | "It was built by AI agents in reviewed pull requests with green CI. Architecture, evaluation, and limitations are in the README."                  |

## After recording

- Export as MP4 (H.264), 1080p, under 100 MB, with burnt-in English
  subtitles from the voice-over lines.
- Watch it once for anything that must not be public: keys, passwords,
  email addresses other than the fictional `demo.test` ones, or browser
  history.
- Upload it (for example unlisted on YouTube, or as a GitHub release
  asset) and replace `<VIDEO_URL>` in the [README](../README.md).
