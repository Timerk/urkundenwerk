"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useId,
  useState,
} from "react";
import { Button } from "../../../../components/ui/button";
import { Notice } from "../../../../components/ui/notice";
import { formatNumber } from "../../../../i18n/format";
import {
  ACCEPT_ATTRIBUTE,
  checkUpload,
  MAX_UPLOAD_MEGABYTES,
} from "../../../../lib/import/limits";
import type { importSamples } from "../../../../lib/import/samples";
import { type ExtractedContract, extractContract } from "./actions";
import { ReviewScreen } from "./review-screen";

type Phase =
  | { kind: "choose"; error?: string }
  | { kind: "extracting"; file: { name: string; size?: number } }
  | { kind: "review"; contract: ExtractedContract };

function FileSize({ bytes }: { bytes: number }) {
  const t = useTranslations("import");
  const locale = useLocale();
  // Formatted here, with one decimal; the messages only place the unit.
  const kb = bytes < 1024 * 1024;
  const size = formatNumber(locale, bytes / 1024 / (kb ? 1 : 1024), 1);
  return <>{t(kb ? "sizeKb" : "sizeMb", { size })}</>;
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
  const t = useTranslations("import");
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
      {t("seconds", { seconds })}
    </span>
  );
}

export function ImportFlow({
  samples,
  tenantId,
  firmName,
  provider,
  model,
}: {
  samples: typeof importSamples;
  tenantId: string;
  firmName: string;
  provider: "anthropic" | "openai" | "fake";
  model: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const t = useTranslations("import");
  const common = useTranslations("common");

  async function runExtraction(
    formData: FormData,
    file: { name: string; size?: number },
  ) {
    setPhase({ kind: "extracting", file });
    formData.set("tenantId", tenantId);
    try {
      const result = await extractContract(formData);
      setPhase(
        result.ok
          ? { kind: "review", contract: result.contract }
          : { kind: "choose", error: result.error },
      );
    } catch {
      // The request itself failed, for example over the body size limit.
      setPhase({ kind: "choose", error: t("errors.network") });
    }
  }

  function upload(file: File) {
    const problem = checkUpload(file);
    if (problem) {
      setPhase({
        kind: "choose",
        error: t(`upload.${problem}`, { size: MAX_UPLOAD_MEGABYTES }),
      });
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    void runExtraction(formData, { name: file.name, size: file.size });
  }

  function useSample(sample: (typeof samples)[number]) {
    const formData = new FormData();
    formData.set("sampleId", sample.id);
    void runExtraction(formData, { name: sample.filename });
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) upload(file);
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (files.length > 1) {
      setPhase({ kind: "choose", error: t("errors.oneFile") });
      return;
    }
    if (files[0]) upload(files[0]);
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
        {common("documents")}
      </Link>
      <h1 className="mt-6 font-serif text-3xl text-ink">{t("title")}</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        {t("intro", { firm: firmName })}
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
                {phase.file.size !== undefined ? (
                  <p className="text-sm text-ink-faint">
                    <FileSize bytes={phase.file.size} />
                  </p>
                ) : null}
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-4 flex items-baseline justify-between gap-4 text-sm text-ink"
                >
                  <span>{t("reading")}</span>
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
                {t.rich("drop", {
                  choose: (chunks) => (
                    <span className="font-medium text-stamp underline underline-offset-4">
                      {chunks}
                    </span>
                  ),
                })}
              </span>
              <span id={hintId} className="text-sm text-ink-faint">
                {t("dropHint", { size: MAX_UPLOAD_MEGABYTES })}
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
            <section aria-labelledby="import-samples" className="mt-6">
              <h2 id="import-samples" className="font-medium text-ink">
                {t("samples.title")}
              </h2>
              <ul className="mt-2 space-y-2">
                {samples.map((sample) => (
                  <li
                    key={sample.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2"
                  >
                    <Button
                      variant="secondary"
                      onClick={() => useSample(sample)}
                    >
                      {t(`samples.${sample.id}`, { format: sample.format })}
                    </Button>
                    <a
                      href={`/samples/${sample.id}`}
                      download
                      className="text-sm text-stamp underline underline-offset-4"
                    >
                      {t("samples.download", { format: sample.format })}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
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
          {t("privacy.title")}
        </h2>
        <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-5">
          {provider === "fake" ? (
            <li>{t("privacy.fake")}</li>
          ) : (
            <li>
              {t.rich("privacy.provider", {
                provider: provider === "openai" ? "OpenAI" : "Anthropic",
                model,
                code: (chunks) => <code className="text-xs">{chunks}</code>,
              })}
            </li>
          )}
          <li>{t("privacy.storage")}</li>
          <li>{t("privacy.accuracy")}</li>
        </ul>
      </section>
    </div>
  );
}
