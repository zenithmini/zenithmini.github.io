import type { Metadata } from "next";
import { ResourcePage } from "../resource-page";

export const metadata: Metadata = {
  title: "資料來源與更新方式｜台股進場判斷器",
  description: "說明上市、上櫃、0050成分股及加權指數資料來源、更新時間與可能限制。",
  alternates: { canonical: "/data-sources/" },
};

export default function DataSourcesPage() {
  return (
    <ResourcePage eyebrow="DATA SOURCES" title="資料來源與更新方式" lead="網站以臺灣市場的公開盤後資料進行研究，不提供交易所授權的盤中即時報價。">
      <section>
        <h2>上市與上櫃日線</h2>
        <p>上市股票與 ETF 主要依臺灣證券交易所公開資料整理；上櫃股票與 ETF 主要依證券櫃檯買賣中心公開資料整理。常用欄位包括交易日期、開盤、最高、最低、收盤、成交量與成交金額。資料會先經過格式檢查，再供技術指標與風險試算使用。</p>
        <ul>
          <li><a href="https://data.gov.tw/dataset/11549" rel="noreferrer" target="_blank">臺灣證券交易所個股日成交資訊</a></li>
          <li><a href="https://www.tpex.org.tw/zh-tw/openapi.html" rel="noreferrer" target="_blank">證券櫃檯買賣中心 OpenAPI</a></li>
        </ul>
      </section>
      <section>
        <h2>加權指數與 0050 雷達</h2>
        <p>加權指數日線用於判斷整體多方環境。0050 雷達會依標示日期的成分股清單，逐檔套用相同的趨勢、回檔、轉強與風險條件。成分股會定期調整，因此不同日期看到的清單可能不同；歷史回測也不能假設目前成分股永遠不變。</p>
      </section>
      <section>
        <h2>資料何時更新</h2>
        <p>網站使用盤後日線，通常在交易日收盤且來源資料完成公布後更新。週末、國定假日與休市日不會產生新日線。頁面會顯示實際資料日期，若來源延遲、維護或資料格式改變，日期可能暫時停留在前一個交易日。</p>
      </section>
      <section>
        <h2>資料可能失真的情況</h2>
        <p>除權息、減資、分割、合併、恢復交易、極低成交量或來源修正，都可能讓未還原價格及技術指標出現跳動。網站會盡量標示異常與資料不足，但不能保證資料即時、完整或完全無誤。做出交易決策前，應再向交易所、券商或公司公告查證。</p>
      </section>
      <section>
        <h2>快取與本機紀錄</h2>
        <p>為減少重複連線，部分市場結果會短期快取。最近分析、自選股與虛擬交易紀錄主要保存在使用者裝置，因此不會每天自動重算；使用者主動更新後才會重新取得最新可用資料。</p>
      </section>
    </ResourcePage>
  );
}
