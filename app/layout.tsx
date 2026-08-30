import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "台股進場判斷器｜趨勢、回檔與風控",
  description: "輸入上市／上櫃股票或 ETF 代碼，分析進場條件、停損、目標價與可承擔部位。",
  manifest: "./manifest.webmanifest",
  other: {
    "google-adsense-account": "ca-pub-6042352419761579",
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
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var value=localStorage.getItem("tw-signal-font-size");if(["small","standard","large","extra-large"].includes(value)){document.documentElement.dataset.fontSize=value}}catch(e){}})();`,
          }}
        />
        <script
          async
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6042352419761579"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
