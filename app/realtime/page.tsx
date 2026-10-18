import type { Metadata } from "next";
import PrivateQuotePage from "./private-quote-page";

export const metadata: Metadata = {
  title: "私人報價測試｜台股進場判斷器",
  description: "受保護的個人行情測試頁。",
  robots: { index: false, follow: false, noarchive: true },
  alternates: { canonical: "/realtime/" },
};

export default function RealtimePage() {
  return <PrivateQuotePage />;
}
