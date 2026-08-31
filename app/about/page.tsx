import type { Metadata } from "next";
import { ResourcePage } from "../resource-page";

export const metadata: Metadata = {
  title: "關於本站｜台股進場判斷器",
  description: "認識台股進場判斷器的用途、設計原則、功能範圍與限制。",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <ResourcePage eyebrow="ABOUT" title="關於台股進場判斷器" lead="把盤後公開資料整理成可以逐項核對的研究工具，讓使用者先理解風險，再決定是否採取行動。">
      <section>
        <h2>網站為什麼存在</h2>
        <p>面對一張股價圖，使用者很容易只看漲跌或憑感覺追價。本網站把判斷拆成市場環境、個股趨勢、價格位置、轉強訊號與資金風險五個部分，讓每一項條件都能被檢查。工具的目的不是替使用者預言明天，而是減少沒有計畫的交易。</p>
        <p>分析結果會列出沒有通過的條件，也會在大盤不利、資料不足、波動過大或流動性不佳時提醒暫緩。即使出現「可分批進場」，仍只代表目前符合既定規則，不代表未來一定上漲。</p>
      </section>
      <section>
        <h2>目前提供的功能</h2>
        <ul>
          <li>上市、上櫃股票及 ETF 的盤後日線分析。</li>
          <li>以加權指數作為多方交易的市場濾網。</li>
          <li>均線、RSI、MACD、KD、ATR、成交量及費波那契區間整理。</li>
          <li>依本金與可承擔風險試算停損、目標價及股數上限。</li>
          <li>0050 成分股機會雷達、策略歷史回測及虛擬交易練習。</li>
        </ul>
      </section>
      <section>
        <h2>我們刻意不做的事</h2>
        <p>網站不連接券商、不代替使用者下單、不承諾報酬，也不以條件符合度冒充勝率。盤中即時報價需要合法授權與不同的成本結構，目前功能以收盤後公開日線為主。虛擬交易使用模擬資金，只用於練習紀律，不涉及真實金流。</p>
      </section>
      <section>
        <h2>使用者資料與意見回報</h2>
        <p>網站沒有會員系統。自選股、資金設定、分析紀錄與虛擬帳戶主要保存在使用者自己的瀏覽器。若要回報資料異常或功能問題，可前往<a href="https://github.com/zenithmini/zenithmini.github.io/issues" rel="noreferrer" target="_blank">網站問題回報頁</a>，請勿附上券商帳號、身分證件、銀行資料或其他敏感資訊。</p>
      </section>
    </ResourcePage>
  );
}
