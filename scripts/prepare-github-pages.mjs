import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const outputDirectory = resolve("dist/client");
const indexPath = resolve(outputDirectory, "index.html");
const notFoundPath = resolve(outputDirectory, "404.html");

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return findHtmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  }));
  return paths.flat();
}

let rewrittenReferences = 0;
for (const htmlPath of await findHtmlFiles(outputDirectory)) {
  const source = await readFile(htmlPath, "utf8");
  const directory = dirname(relative(outputDirectory, htmlPath));
  const depth = directory === "." ? 0 : directory.split(/[\\/]/).length;
  const assetPrefix = depth === 0 ? "./assets/" : `${"../".repeat(depth)}assets/`;
  const matches = source.match(/\/assets\//g)?.length ?? 0;
  if (matches === 0) continue;

  rewrittenReferences += matches;
  await writeFile(htmlPath, source.replaceAll("/assets/", assetPrefix));
}

if (rewrittenReferences === 0) {
  throw new Error("GitHub Pages preparation did not find any static asset references.");
}

await writeFile(notFoundPath, await readFile(indexPath, "utf8"));
console.log(`Prepared dist/client for GitHub Pages subpath hosting (${rewrittenReferences} asset references).`);
