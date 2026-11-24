import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Instrument_Sans, Source_Serif_4 } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { LegalFooter } from "../components/legal-footer";
import { DemoNotice } from "../components/demo-notice";
import { INTL_LOCALES } from "../i18n/locale";
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
  const [t, locale] = await Promise.all([
    getTranslations("metadata"),
    getLocale(),
  ]);
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const metadataBase = new URL(
    productionHost ? `https://${productionHost}` : "http://localhost:3000",
  );
  const title = "Urkundenwerk";
  const description = t("description");
  return {
    metadataBase,
    title,
    description,
    openGraph: {
      type: "website",
      siteName: title,
      title,
      description,
      url: "/",
      locale: INTL_LOCALES[locale].replace("-", "_"),
      alternateLocale: INTL_LOCALES[locale === "de" ? "en" : "de"].replace(
        "-",
        "_",
      ),
    },
    twitter: { card: "summary_large_image" },
  };
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
      <body className="flex min-h-dvh flex-col antialiased">
        {/* Inherits the request's locale, messages, and time zone. */}
        <NextIntlClientProvider>
          <DemoNotice />
          {children}
          <LegalFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
