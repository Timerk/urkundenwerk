"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveResult =
  { ok: true; updatedAt: string } | { ok: false; error: string };

export type SaveState =
  | { status: "saved"; savedAt: string | null }
  | { status: "unsaved" }
  | { status: "saving" }
  /** `message` is the server's, or `null` when the request itself failed. */
  | { status: "error"; message: string | null };

/**
 * Saves `value` after it has been stable for `delay` ms. One save runs at a
 * time; changes made while a save is in flight are saved right after it.
 * `flush` saves immediately and resolves once the latest value is stored.
 */
export function useAutosave<T>({
  value,
  save,
  enabled,
  delay = 800,
  initialSavedAt = null,
}: {
  value: T;
  save: (value: T) => Promise<SaveResult>;
  enabled: boolean;
  delay?: number;
  initialSavedAt?: string | null;
}) {
  const [state, setState] = useState<SaveState>({
    status: "saved",
    savedAt: initialSavedAt,
  });
  const latest = useRef(value);
  const stored = useRef(value);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const run = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) {
      await inFlight.current;
    }
    if (latest.current === stored.current) return true;

    const snapshot = latest.current;
    setState({ status: "saving" });
    const attempt = (async () => {
      let result: SaveResult | null;
      try {
        result = await saveRef.current(snapshot);
      } catch {
        result = null;
      }
      if (!result?.ok) {
        setState({ status: "error", message: result?.error ?? null });
        return false;
      }
      stored.current = snapshot;
      setState(
        latest.current === snapshot
          ? { status: "saved", savedAt: result.updatedAt }
          : { status: "unsaved" },
      );
      return true;
    })();
    inFlight.current = attempt;
    const ok = await attempt;
    inFlight.current = null;
    // Changes that arrived during the save are written next.
    if (ok && latest.current !== stored.current) return run();
    return ok;
  }, []);

  useEffect(() => {
    latest.current = value;
    if (!enabled || value === stored.current) return;
    setState((current) =>
      current.status === "saving" ? current : { status: "unsaved" },
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), delay);
  }, [value, enabled, delay, run]);

  useEffect(() => {
    if (!enabled) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current !== stored.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled]);

  return { state, flush: run };
}
