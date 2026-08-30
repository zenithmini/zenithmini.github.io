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

test("PWA shell is included in the static export", async () => {
  const manifest = JSON.parse(await readFile(resolve(output, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  await access(resolve(output, "sw.js"));
  await access(resolve(output, "icon.svg"));
  await access(resolve(output, "icon-192.png"));
  await access(resolve(output, "icon-512.png"));
  await access(resolve(output, "privacy/index.html"));
  await access(resolve(output, ".nojekyll"));
});

test("AdSense publisher metadata and auto ads loader are included", async () => {
  const html = await readFile(resolve(output, "index.html"), "utf8");
  const ads = await readFile(resolve(output, "ads.txt"), "utf8");
  const assetFiles = [...html.matchAll(/\.\/assets\/[^"'\\)]+\.js/g)].map((match) =>
    resolve(output, match[0].slice(2)),
  );
  const scripts = await Promise.all(assetFiles.map((file) => readFile(file, "utf8")));
  const bundle = scripts.join("\n");

  assert.match(html, /google-adsense-account/);
  assert.match(html, /ca-pub-6042352419761579/);
  assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  assert.match(ads, /pub-6042352419761579/);
  assert.match(html, /5040756419/);
  for (const slot of ["9369999183", "5040756419", "3727674747", "6743835843"]) {
    assert.match(bundle, new RegExp(slot), `expected AdSense slot ${slot} in client bundle`);
  }
  assert.match(bundle, /data-ad-status/);
  assert.doesNotMatch(html, /廣告預留區/);
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
