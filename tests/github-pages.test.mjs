import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const output = resolve("dist/client");

test("GitHub Pages export uses portable asset paths", async () => {
  const html = await readFile(resolve(output, "index.html"), "utf8");
  assert.doesNotMatch(html, /(?:href|src)=["']\/assets\//);
  assert.doesNotMatch(html, /import\(["']\/assets\//);

  const references = [...html.matchAll(/\.\/assets\/[^"'\\)]+/g)].map((match) => match[0]);
  assert.ok(references.length >= 5, "expected static asset references");
  await Promise.all(references.map((reference) => access(resolve(output, reference.slice(2)))));
});

test("privacy policy is exported with portable asset paths", async () => {
  const html = await readFile(resolve(output, "privacy/index.html"), "utf8");
  assert.match(html, /隱私權政策/);
  assert.doesNotMatch(html, /(?:href|src)=["']\/assets\//);
  assert.doesNotMatch(html, /import\(["']\/assets\//);

  const references = [...html.matchAll(/\.\.\/assets\/[^"'\\)]+/g)].map((match) => match[0]);
  assert.ok(references.length >= 5, "expected privacy page asset references");
  await Promise.all(references.map((reference) => access(resolve(output, "privacy", reference))));
});

test("original research pages are exported and internally linked", async () => {
  const pages = [
    ["about", /關於台股進場判斷器/],
    ["methodology", /策略與指標原理/],
    ["backtest-guide", /0050 對比究竟在比什麼/],
    ["risk-management", /風險與資金管理指南/],
    ["data-sources", /資料來源與更新方式/],
    ["faq", /常見問題/],
  ];

  for (const [directory, expected] of pages) {
    const html = await readFile(resolve(output, directory, "index.html"), "utf8");
    assert.match(html, expected);
    assert.match(html, /canonical/);
    assert.doesNotMatch(html, /pagead2\.googlesyndication\.com/);
  }

  const homepage = await readFile(resolve(output, "index.html"), "utf8");
  for (const [directory] of pages) assert.match(homepage, new RegExp(`\\./${directory}/`));
});

test("PWA shell is included in the static export", async () => {
  const manifest = JSON.parse(await readFile(resolve(output, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  await access(resolve(output, "sw.js"));
  await access(resolve(output, "icon.svg"));
  await access(resolve(output, "icon-192.png"));
  await access(resolve(output, "icon-512.png"));
  await access(resolve(output, "privacy/index.html"));
  await access(resolve(output, "about/index.html"));
  await access(resolve(output, "methodology/index.html"));
  await access(resolve(output, "backtest-guide/index.html"));
  await access(resolve(output, "risk-management/index.html"));
  await access(resolve(output, "data-sources/index.html"));
  await access(resolve(output, "faq/index.html"));
  await access(resolve(output, "robots.txt"));
  await access(resolve(output, "sitemap.xml"));
  await access(resolve(output, ".nojekyll"));
});

test("AdSense review mode keeps ownership proof but sends no ad requests", async () => {
  const html = await readFile(resolve(output, "index.html"), "utf8");
  const ads = await readFile(resolve(output, "ads.txt"), "utf8");
  const assetFiles = [...html.matchAll(/\.\/assets\/[^"'\\)]+\.js/g)].map((match) =>
    resolve(output, match[0].slice(2)),
  );
  const scripts = await Promise.all(assetFiles.map((file) => readFile(file, "utf8")));
  const bundle = scripts.join("\n");

  assert.match(html, /google-adsense-account/);
  assert.match(html, /ca-pub-6042352419761579/);
  assert.match(ads, /pub-6042352419761579/);
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  assert.doesNotMatch(html, /廣告/);
  for (const slot of ["9369999183", "5040756419", "3727674747", "6743835843"]) {
    assert.doesNotMatch(bundle, new RegExp(slot), `AdSense slot ${slot} must stay disabled during review`);
  }
  assert.doesNotMatch(bundle, /data-ad-status/);
});

test("public build calls the private analysis API without shipping market-data or strategy code", async () => {
  const html = await readFile(resolve(output, "index.html"), "utf8");
  const assetFiles = [...html.matchAll(/\.\/assets\/[^"'\\)]+\.js/g)].map((match) =>
    resolve(output, match[0].slice(2)),
  );
  const scripts = await Promise.all(assetFiles.map((file) => readFile(file, "utf8")));
  const bundle = scripts.join("\n");

  assert.match(bundle, /\/api\/analyze/);
  assert.match(bundle, /\/api\/screener\/0050/);
  assert.match(bundle, /更新全部/);
  assert.match(bundle, /可能需更新/);
  assert.match(bundle, /tw-signal-font-size/);
  assert.match(bundle, /字體大小/);
  assert.match(bundle, /\/api\/simulator\/backtest/);
  assert.match(bundle, /策略歷史回測/);
  assert.match(bundle, /費波那契預測驗證/);
  assert.match(bundle, /78\.6% 失效觸及/);
  assert.match(bundle, /這個0050對比怎麼看/);
  assert.match(bundle, /不是同風險績效比較/);
  assert.match(bundle, /近120個交易日（約半年）/);
  assert.match(bundle, /虛擬交易市場/);
  assert.match(bundle, /用盤後收盤價模擬成交/);
  assert.match(bundle, /tw-signal-paper-account/);
  assert.match(bundle, /tw-signal-paper-challenges/);
  assert.match(bundle, /模擬下單/);
  assert.match(bundle, /模擬交易/);
  assert.match(bundle, /虛擬買進/);
  assert.match(bundle, /虛擬賣出/);
  assert.match(bundle, /保存本輪並重設/);
  assert.match(bundle, /不保存直接重設/);
  assert.match(bundle, /繼續清除/);
  assert.match(bundle, /確定永久清除/);
  assert.match(bundle, /removeItem\([`"']tw-signal-paper-challenges/);
  assert.match(bundle, /分鐘前/);
  assert.doesNotMatch(bundle, /盤中即時股價/);
  assert.match(bundle, /跑贏0050/);
  assert.match(bundle, /TWSE＋TPEx 日線/);
  assert.match(bundle, /3374/);
  assert.match(bundle, /tw-stock-signal-api\.market-signal-tools\.workers\.dev/);
  assert.doesNotMatch(bundle, /www\.twse\.com\.tw\/(?:exchangeReport|rwd)\//);
  assert.doesNotMatch(bundle, /api\.finmindtrade\.com/);
  assert.doesNotMatch(bundle, /STOCK_DAY|MI_5MINS_HIST|analyzeMarketRegime|analyzeFibonacci/);
});
