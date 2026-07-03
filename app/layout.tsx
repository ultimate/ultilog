import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { I18nProvider } from "./lib/i18n";

export const metadata: Metadata = {
  title: "Ultilog · Personal skipper logbook",
  description: "A responsive personal logbook for skippers tracking Hochseeausweis / ICC nautical miles across boats and passages.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102033",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      {/* The root layout is rendered on the server, so it cannot read the client-only localStorage locale here. I18nProvider updates document.documentElement.lang after hydration. */}
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
