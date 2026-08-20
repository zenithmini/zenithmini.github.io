import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策｜台股進場判斷器",
  description: "台股進場判斷器的資料使用、瀏覽器儲存、第三方服務與廣告 Cookie 說明。",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <a className="privacy-back" href="../">← 返回台股進場判斷器</a>

      <header className="privacy-hero">
        <span>PRIVACY</span>
        <h1>隱私權政策</h1>
        <p>我們重視使用者的隱私。本頁說明台股進場判斷器如何使用瀏覽器資料、公開市場資料服務，以及 Google AdSense 的 Cookie 處理方式。</p>
        <small className="privacy-date">最後更新：2026 年 8 月 20 日</small>
      </header>

      <div className="privacy-content">
        <section className="card">
          <h2>一、工具性質</h2>
          <p>本網站提供規則化的市場研究、技術分析與風險管理輔助。所有結果均不構成投資建議、招攬、保證獲利或自動下單服務。使用者應自行判斷並承擔交易風險。</p>
        </section>

        <section className="card">
          <h2>二、網站不主動蒐集的資料</h2>
          <p>本網站目前沒有會員系統，不要求輸入姓名、電話、電子郵件、身分證字號、銀行帳戶、券商帳戶或信用卡資料。分析服務只接收使用者輸入的股票代碼，不接收本金、風險比例或自選股清單。</p>
        </section>

        <section className="card">
          <h2>三、儲存在使用者裝置上的資料</h2>
          <p>為了保留自選股、資金與風險設定、最近分析紀錄及短期市場快取，本網站會使用瀏覽器的 localStorage 與 Service Worker 快取。這些資料主要保存在使用者自己的裝置，可透過清除網站資料或瀏覽器快取移除。</p>
        </section>

        <section className="card">
          <h2>四、公開市場資料服務</h2>
          <p>使用者執行分析時，瀏覽器會將股票代碼送到本網站的私人分析服務；分析服務再向臺灣證券交易所公開端點請求盤後市場資料並完成運算。資料依政府資料開放授權條款第 1 版利用並於網站標示來源。網站代管、分析服務與證券交易所可能依各自政策記錄必要的連線資訊，例如 IP 位址、瀏覽器資訊、請求時間與使用量。</p>
        </section>

        <section className="card">
          <h2>五、Google AdSense 與廣告 Cookie</h2>
          <ul>
            <li>本網站已載入 Google AdSense 自動廣告程式；廣告是否顯示及版位由 Google、審核狀態與網站設定共同決定。</li>
            <li>Google 等第三方供應商可能使用 Cookie，依使用者先前造訪本網站或其他網站的情況提供及衡量廣告。</li>
            <li>Google 使用廣告 Cookie，使 Google 與合作夥伴能依使用者的瀏覽情況提供個人化或非個人化廣告。</li>
            <li>使用者可前往 <a href="https://adssettings.google.com/" rel="noreferrer" target="_blank">Google 廣告設定</a>管理個人化廣告，也可依瀏覽器設定限制或刪除 Cookie。</li>
          </ul>
        </section>

        <section className="card">
          <h2>六、同意管理</h2>
          <p>若廣告服務適用地區法規要求，本網站將透過 Google 或合規的同意管理平台提供 Cookie 與個人化廣告選項。使用者可依畫面提示同意、拒絕或管理偏好。</p>
        </section>

        <section className="card">
          <h2>七、政策更新</h2>
          <p>本政策可能因網站功能、第三方服務或法規要求而更新。新版內容公布於本頁後生效，並同步更新頁面上的日期。</p>
        </section>
      </div>
    </main>
  );
}
