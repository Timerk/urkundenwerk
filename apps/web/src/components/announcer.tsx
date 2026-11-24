"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { StatusMessage } from "./ui/confirm";

/*
 * A removed member, a revoked invitation or a deleted document disappears
 * from its list when the page revalidates, and with it any message next to
 * it. Results that remove their row are therefore announced in one region
 * above the list, and focus moves there so keyboard users are not left on a
 * vanished control.
 */
const AnnounceContext = createContext<(message: string) => void>(() => {});

export function Announcer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const region = useRef<HTMLDivElement>(null);
  function announce(text: string) {
    setMessage(text);
    requestAnimationFrame(() => region.current?.focus());
  }
  return (
    <AnnounceContext.Provider value={announce}>
      <div ref={region} tabIndex={-1} className="outline-none">
        <StatusMessage
          tone="success"
          message={message}
          className="rounded-sm border border-ok/30 bg-paper px-4 py-2.5"
        />
      </div>
      {children}
    </AnnounceContext.Provider>
  );
}

/** Announces a result in the nearest `Announcer`'s status line. */
export function useAnnounce() {
  return useContext(AnnounceContext);
}
