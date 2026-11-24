import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

const tagline = "Build and review German GmbH formation documents";
const note = "Demonstration project · fictional data";

export const alt = `Urkundenwerk. ${tagline}. ${note}.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const serif = await readFile(
    new URL(
      "../../../../packages/render/assets/SourceSerif4-Regular.ttf",
      import.meta.url,
    ),
  );
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: "52px",
        background: "#e6eaf0",
        color: "#18213a",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: "100%",
          padding: "52px 66px",
          border: "1px solid #c9d1df",
          background: "#ffffff",
        }}
      >
        <svg width="76" height="76" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="6" fill="#18213a" />
          <path
            d="M10.5 7.5v8.25a5.5 5.5 0 0 0 11 0V7.5"
            fill="none"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M7.5 26h17"
            stroke="#8ea3e8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="0.1 3.6"
          />
        </svg>
        <div
          style={{
            fontFamily: "Source Serif 4",
            fontSize: 103,
            marginTop: 16,
          }}
        >
          Urkundenwerk
        </div>
        <div style={{ fontSize: 34, color: "#2b46a6" }}>{tagline}</div>
        <div
          style={{
            width: "100%",
            marginTop: "auto",
            paddingTop: 23,
            borderTop: "1px solid #c9d1df",
            color: "#74490a",
            fontSize: 24,
          }}
        >
          {note}
        </div>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Source Serif 4", data: serif }] },
  );
}
