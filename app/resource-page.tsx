import type { ReactNode } from "react";

const resources = [
  ["策略原理", "../methodology/"],
  ["回測說明", "../backtest-guide/"],
  ["風險管理", "../risk-management/"],
  ["資料來源", "../data-sources/"],
  ["常見問題", "../faq/"],
  ["關於本站", "../about/"],
] as const;

export function ResourcePage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <main className="resource-page">
      <header className="resource-topbar">
        <a className="resource-brand" href="../">台股進場判斷器</a>
        <a className="resource-tool-link" href="../">開啟分析工具</a>
      </header>

      <div className="resource-layout">
        <aside className="resource-sidebar">
          <strong>研究與網站說明</strong>
          <nav aria-label="研究說明頁面">
            {resources.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
            <a href="../privacy/">隱私權政策</a>
          </nav>
        </aside>

        <article className="resource-main">
          <header className="resource-hero">
            <span>{eyebrow}</span>
            <h1>{title}</h1>
            <p>{lead}</p>
            <small>最後更新：2026 年 8 月 31 日</small>
          </header>
          <div className="resource-content">{children}</div>
          <p className="resource-disclaimer">本網站內容為公開歷史資料的規則化研究與風險管理說明，不構成個別投資建議、證券推薦、招攬、報酬保證或自動下單服務。投資人應自行查證資料並承擔交易決策及損益。</p>
        </article>
      </div>

      <footer className="resource-footer">
        <a href="../">分析工具</a>
        <a href="../privacy/">隱私權政策</a>
        <span>TWSE＋TPEx 盤後日線研究</span>
      </footer>
    </main>
  );
}
