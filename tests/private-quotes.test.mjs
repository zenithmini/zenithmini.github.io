import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const output = resolve("dist/client");

test("private quote shell has no default public entry, no ads, and noindex", async () => {
  const home = await readFile(resolve(output, "index.html"), "utf8");
  const quotePage = await readFile(resolve(output, "realtime/index.html"), "utf8");
  assert.doesNotMatch(home, /href=["']\.\/realtime\//);
  assert.match(quotePage, /即時報價測試/);
  assert.match(quotePage, /私人通行碼/);
  assert.match(quotePage, /name="robots"[^>]*noindex/);
  assert.doesNotMatch(quotePage, /adsbygoogle|pagead2\.googlesyndication\.com/);
  assert.doesNotMatch(await readFile(resolve(output, "sitemap.xml"), "utf8"), /realtime/);
  const references = [...quotePage.matchAll(/(?:src|href)="(\.\.\/assets\/[^"']+)"/g)].map(match => match[1]);
  assert.ok(references.length > 0);
  for (const reference of references) await readFile(resolve(output, "realtime", reference));
});
