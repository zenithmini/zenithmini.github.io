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
