import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "TradePulse 信号监控中心",
  description: "TradePulse 中文量化信号监控与邮件提醒后台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
