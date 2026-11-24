import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Instrument_Sans, Source_Serif_4 } from "next/font/google";
import { connection } from "next/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: "Urkundenwerk", description: t("description") };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Next applies the proxy's script nonce as it renders each request.
  await connection();
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${instrumentSans.variable} ${sourceSerif.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {/* Inherits the request's locale, messages, and time zone. */}
        <NextIntlClientProvider>
          <DemoNotice />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
