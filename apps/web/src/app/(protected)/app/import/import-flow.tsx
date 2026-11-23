"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useId,
  useState,
} from "react";
import { Notice } from "../../../../components/ui/notice";
import {
  ACCEPT_ATTRIBUTE,
  checkUpload,
  MAX_UPLOAD_BYTES,
} from "../../../../lib/import/limits";
import { type ExtractedContract, extractContract } from "./actions";
import { ReviewScreen } from "./review-screen";

type Phase =
  | { kind: "choose"; error?: string }
  | { kind: "extracting"; file: { name: string; size: number } }
  | { kind: "review"; contract: ExtractedContract };

const sizeFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${sizeFormat.format(bytes / 1024)} KB`
    : `${sizeFormat.format(bytes / 1024 / 1024)} MB`;
}

function DocumentGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 48" className="h-12 w-10">
      <path
        d="M4 2h22l10 10v34H4z"
        fill="var(--color-paper)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M26 2v10h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 22h20M10 28h20M10 34h13"
        stroke="var(--color-stamp)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/** Seconds since the extraction started, shown but not announced. */
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <span aria-hidden="true" className="tabular-nums">
      {seconds} s
    </span>
  );
}

export function ImportFlow({
  tenantId,
  firmName,
  provider,
  model,
}: {
  tenantId: string;
  firmName: string;
  provider: "anthropic" | "openai" | "fake";
  model: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const [dragging, setDragging] = useState(false);
  const hintId = useId();

  async function upload(file: File) {
    const problem = checkUpload(file);
    if (problem) {
      setPhase({ kind: "choose", error: problem });
      return;
    }
    setPhase({
      kind: "extracting",
      file: { name: file.name, size: file.size },
    });
    const formData = new FormData();
    formData.set("tenantId", tenantId);
    formData.set("file", file);
    try {
      const result = await extractContract(formData);
      setPhase(
        result.ok
          ? { kind: "review", contract: result.contract }
          : { kind: "choose", error: result.error },
      );
    } catch {
      // The request itself failed, for example over the body size limit.
      setPhase({
        kind: "choose",
        error:
          "The upload did not reach the server. Check your connection and the file, then try again.",
      });
    }
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void upload(file);
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (files.length > 1) {
      setPhase({ kind: "choose", error: "Drop one file at a time." });
      return;
    }
    if (files[0]) void upload(files[0]);
  }

  if (phase.kind === "review") {
    return (
      <ReviewScreen
        tenantId={tenantId}
        contract={phase.contract}
        onRestart={() => setPhase({ kind: "choose" })}
      />
    );
  }

  const extracting = phase.kind === "extracting";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 rounded-sm text-sm text-ink-soft hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4">
          <path
            d="M10 3.5 5.5 8l4.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Documents
      </Link>
      <h1 className="mt-6 font-serif text-3xl text-ink">
        Import from a contract
      </h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Upload an existing formation deed or articles of association. An AI
        model proposes values for a new Musterprotokoll in {firmName} and quotes
        the passage each one comes from. You review every value, and nothing is
        saved until you create the draft.
      </p>

      <div className="mt-8">
        {extracting ? (
          <div
            className="rounded-md border border-rule bg-paper px-6 py-8"
            aria-busy="true"
          >
            <div className="flex items-start gap-4">
              <DocumentGlyph />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {phase.file.name}
                </p>
                <p className="text-sm text-ink-faint">
                  {formatSize(phase.file.size)}
                </p>
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-4 flex items-baseline justify-between gap-4 text-sm text-ink"
                >
                  <span>
                    Reading the document and extracting values. This usually
                    takes under a minute.
                  </span>
                  <Elapsed />
                </p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-desk">
                  <div className="import-progress h-full w-1/3 rounded-full bg-stamp" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={drop}
              className={`group flex cursor-pointer flex-col items-center gap-3 rounded-md border-2 border-dashed px-6 py-12 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-stamp ${
                dragging
                  ? "border-stamp bg-stamp-wash text-stamp"
                  : "border-rule-strong bg-paper text-ink-faint hover:border-ink-faint"
              }`}
            >
              <DocumentGlyph />
              <span className="text-lg text-ink">
                Drop a PDF or DOCX here, or{" "}
                <span className="font-medium text-stamp underline underline-offset-4">
                  choose a file
                </span>
              </span>
              <span id={hintId} className="text-sm text-ink-faint">
                A text-based PDF or a DOCX, up to{" "}
                {MAX_UPLOAD_BYTES / 1024 / 1024} MB. Scans cannot be read yet.
              </span>
              <input
                type="file"
                name="file"
                accept={ACCEPT_ATTRIBUTE}
                aria-describedby={hintId}
                onChange={choose}
                className="sr-only"
              />
            </label>
            {phase.error ? (
              <Notice tone="error" className="mt-4">
                {phase.error}
              </Notice>
            ) : null}
          </>
        )}
      </div>

      <section
        aria-labelledby="import-privacy"
        className="mt-10 border-t border-rule pt-6 text-sm text-ink-soft"
      >
        <h2 id="import-privacy" className="font-medium text-ink">
          What happens to the document
        </h2>
        <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-5">
          {provider === "fake" ? (
            <li>
              This server uses scripted extraction for testing. The document
              text does not leave the server, and no AI model reads it.
            </li>
          ) : (
            <li>
              The document&apos;s text is sent to{" "}
              {provider === "openai" ? "OpenAI" : "Anthropic"}&apos;s API, model{" "}
              <code className="text-xs">{model}</code>, to extract the values.
              Use fictional documents in this demo.
            </li>
          )}
          <li>
            Urkundenwerk does not store the file or its text. Only the values
            you accept are saved, in a new draft.
          </li>
          <li>
            The AI may be wrong. Each value shows its source passage, and our
            code checks that the passage exists and states the value.
          </li>
        </ul>
      </section>
    </div>
  );
}
