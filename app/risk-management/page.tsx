import type { Metadata } from "next";
import { ResourcePage } from "../resource-page";

export const metadata: Metadata = {
  title: "風險與資金管理指南｜台股進場判斷器",
  description: "說明單筆風險、停損、ATR、部位上限、1比3目標與跳空風險。",
  alternates: { canonical: "/risk-management/" },
};

export default function RiskManagementPage() {
  return (
    <ResourcePage eyebrow="RISK MANAGEMENT" title="風險與資金管理指南" lead="策略可以判斷錯誤，真正需要控制的是錯一次會損失多少，以及連續錯誤時能否繼續執行。">
      <section>
        <h2>先決定願意損失多少，再算股數</h2>
        <p>假設可用資金為 100 萬元，單筆風險設定 1%，代表一次交易預計承擔的損失上限約為 1 萬元。若進場價到停損價每股相差 5 元，未計費用前的風險股數約為 2,000 股。工具還會再檢查單檔資金上限與大盤部位係數，取較保守的結果。</p>
      </section>
      <section>
        <h2>停損價不是保證成交價</h2>
        <p>停損用來標示原本判斷可能已經失效的位置。若隔日跳空、股票跌停、成交量不足或委託未成交，實際離場價可能低於設定值，損失也會超過試算。個股事件風險較高時，降低部位通常比把停損設得非常靠近更實際。</p>
      </section>
      <section>
        <h2>ATR 為什麼會影響停損</h2>
        <p>ATR 14 描述最近 14 個交易日的典型波動幅度。波動較大的股票若使用相同百分比停損，容易被日常震盪掃出；停損放寬後，每股可能損失增加，因此股數必須相應減少。ATR 只反映歷史波動，無法預測突發事件。</p>
      </section>
      <section>
        <h2>1：3 是規劃，不是保證</h2>
        <p>如果進場價到停損價的距離是 5 元，1：3 代表初步目標抓取約 15 元的潛在報酬。這個比例用來篩除風險報酬過差的交易，不表示價格一定會到達目標，也不要求每筆都持有到目標。趨勢提前轉弱時仍可能先行退出。</p>
      </section>
      <section>
        <h2>避免把全部風險集中在一起</h2>
        <p>同產業或高度連動的股票，看似是多筆交易，實際上可能承擔同一項市場風險。除了限制單檔部位，也應留意整體持股數量、產業集中度、現金比例與事件日期。借款、生活緊急預備金及短期必要支出不適合作為高波動交易資金。</p>
      </section>
    </ResourcePage>
  );
}
