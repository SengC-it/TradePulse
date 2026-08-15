import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "TradePulse",
  description: "Crypto market analysis and candidate signal research.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
