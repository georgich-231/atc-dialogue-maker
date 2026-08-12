import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    title: "ATC Dialogue Maker",
    description: "Two-voice ATC dialogue generation with radio effects and MP3 export.",
    openGraph: {
      title: "ATC Dialogue Maker",
      description: "Two voices. Radio effects. MP3 export.",
      images: [`${baseUrl}/og.png`]
    },
    twitter: {
      card: "summary_large_image",
      title: "ATC Dialogue Maker",
      description: "Two voices. Radio effects. MP3 export.",
      images: [`${baseUrl}/og.png`]
    }
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
