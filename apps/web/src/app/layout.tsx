import type { Metadata } from "next";
import { Instrument_Sans, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { DemoNotice } from "../components/demo-notice";
import "./globals.css";

// The tool's voice: a compact grotesque with clear figures for form input.
const instrumentSans = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument-sans",
  display: "swap",
});

// The deed's voice: the same face the PDF and DOCX exports embed.
const sourceSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Urkundenwerk",
  description:
    "A document builder for German law firms that assembles the statutory Musterprotokoll from structured case data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${sourceSerif.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <DemoNotice />
        {children}
      </body>
    </html>
  );
}
