import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "台股進場判斷器｜趨勢、回檔與風控",
  description: "輸入上市股票或 ETF 代碼，分析進場條件、停損、目標價與可承擔部位。",
  manifest: "./manifest.webmanifest",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "./icon.svg",
    shortcut: "./icon.svg",
    apple: "./icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
