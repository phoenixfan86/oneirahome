// Builds an internal link graph across the site and reports:
//   1. Orphan pages — content that nothing links to (zero inbound links)
//   2. Broken internal links — links pointing to a slug that doesn't exist
//   3. Link hubs — pages with the most outbound internal links
//
// It scans markdown in src/content/* (dreams, guides, dreams_ua, roundups)
// and .astro files in src/pages + src/components + src/layouts. Sitewide
// links in layouts/components (sidebar, footer) are counted, but reported
// separately so they don't hide the real editorial picture.
//
// Usage:
//   node scripts/link-audit.mjs
//   -> prints the report and writes scripts/link-audit-report.md
//
// No API key, no network, no cost. Safe to run any time.

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('.');
const CONTENT_DIRS = {
  dreams: 'src/content/dreams',
  guides: 'src/content/guides',
  dreams_ua: 'src/content/dreams_ua',
};
const ROUNDUPS_DIR = 'src/content/roundups';
const CODE_DIRS = ['src/pages', 'src/components', 'src/layouts'];
const REPORT_PATH = path.resolve('scripts/link-audit-report.md');

// Route prefix for each content collection, so an article's own URL and
// its incoming links can be matched.
const ROUTE_PREFIX = {
  dreams: '/dream/',
  guides: '/guides/',
  dreams_ua: '/ua/dream/',
};

async function listFiles(dir, exts) {
  const abs = path.resolve(dir);
  try {
    await stat(abs);
  } catch {
    return [];
  }
  const out = [];
  for (const name of await readdir(abs)) {
    const full = path.join(abs, name);
    const s = await stat(full);
    if (s.isDirectory()) {
      out.push(...(await listFiles(full, exts)));
    } else if (exts.some((e) => name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function relFromRoot(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

// Pull every internal href target out of a file's text.
// Matches href="/x" and href={`/x`} and markdown ](/x).
function extractInternalLinks(text) {
  const links = new Set();
  const patterns = [
    /href="(\/[^"#?\s]*)"/g,
    /href=\{`(\/[^`#?\s$]*)`\}/g,
    /href='(\/[^'#?\s]*)'/g,
    /\]\((\/[^)#?\s]*)\)/g,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const normalized = normalize(m[1]);
      if (normalized) links.add(normalized);
    }
  }
  return [...links];
}

// Normalize: strip trailing slash (except root), so /dream/snake/ and
// /dream/snake match. Template placeholders ${...} are skipped.
function normalize(url) {
  if (url.includes('${')) return null;
  let u = url.replace(/\/+$/, '');
  if (u === '') u = '/';
  return u;
}

async function main() {
  // 1. Collect every content item's URL and its source text.
  const nodes = new Map(); // url -> { url, kind, file }
  const sourceTexts = []; // { file, kind, text }

  for (const [kind, dir] of Object.entries(CONTENT_DIRS)) {
    for (const file of await listFiles(dir, ['.md'])) {
      const raw = await readFile(file, 'utf-8');
      if (/^draft:\s*true/m.test(raw)) continue;
      const slug = path.basename(file, '.md');
      const url = `${ROUTE_PREFIX[kind]}${slug}`;
      nodes.set(url, { url, kind, file: relFromRoot(file) });
      sourceTexts.push({ file: relFromRoot(file), kind: 'content', text: raw });
    }
  }

  for (const file of await listFiles(ROUNDUPS_DIR, ['.json'])) {
    const slug = path.basename(file, '.json');
    const url = `/articles/${slug}`;
    nodes.set(url, { url, kind: 'roundups', file: relFromRoot(file) });
    sourceTexts.push({ file: relFromRoot(file), kind: 'content', text: await readFile(file, 'utf-8') });
  }

  // Static pages from src/pages are also valid link targets (/about, /tags, ...).
  const staticRoutes = new Set();
  for (const file of await listFiles('src/pages', ['.astro', '.ts'])) {
    const rel = relFromRoot(file).replace(/^src\/pages/, '');
    // Skip dynamic routes; they're covered by content collections above.
    if (rel.includes('[')) continue;
    let route = rel.replace(/\/index\.(astro|ts)$/, '').replace(/\.(astro|ts)$/, '');
    if (route === '') route = '/';
    staticRoutes.add(route);
  }

  // 2. Collect all code sources (sitewide chrome counted separately).
  for (const dir of CODE_DIRS) {
    for (const file of await listFiles(dir, ['.astro', '.ts'])) {
      const text = await readFile(file, 'utf-8');
      const isChrome = /src\/(layouts|components)\//.test(relFromRoot(file));
      sourceTexts.push({ file: relFromRoot(file), kind: isChrome ? 'chrome' : 'code', text });
    }
  }

  // 3. Build the graph: for each source file, the internal links it contains.
  const inbound = new Map(); // target -> Set of source files
  const outbound = new Map(); // source file -> Set of targets
  const chromeLinks = new Set(); // targets linked from sitewide chrome

  for (const src of sourceTexts) {
    const links = extractInternalLinks(src.text);
    outbound.set(src.file, new Set(links));
    for (const target of links) {
      if (!inbound.has(target)) inbound.set(target, new Set());
      inbound.get(target).add(src.file);
      if (src.kind === 'chrome') chromeLinks.add(target);
    }
  }

  // 4. Orphans: content pages with no inbound links from anywhere except
  // themselves. Sitewide chrome counts separately so we can flag pages
  // that are only reachable through the sidebar or footer.
  const orphans = [];
  const chromeOnly = [];
  for (const [url, node] of nodes) {
    const sources = [...(inbound.get(url) || [])].filter((f) => f !== node.file);
    const hasEditorialLink = sources.some((f) => {
      const src = sourceTexts.find((s) => s.file === f);
      return src && src.kind !== 'chrome';
    });
    if (sources.length === 0) {
      orphans.push({ url, file: node.file });
    } else if (!hasEditorialLink) {
      chromeOnly.push({ url, file: node.file });
    }
  }

  // 5. Broken internal links: targets that match neither a content URL nor
  // a known static route.
  const knownTargets = new Set([...nodes.keys(), ...staticRoutes]);
  const broken = [];
  for (const [target, sources] of inbound) {
    if (knownTargets.has(target)) continue;
    // Allow static asset-like paths (images, fonts, pagefind) to pass.
    if (/\.(webp|jpg|png|svg|css|js|xml|txt|json|ico)$/.test(target)) continue;
    if (target.startsWith('/pagefind') || target.startsWith('/_astro')) continue;
    broken.push({ target, sources: [...sources] });
  }

  // 6. Hubs: pages with the most outbound links to other content.
  const hubs = [...outbound.entries()]
    .filter(([file]) => {
      const src = sourceTexts.find((s) => s.file === file);
      return src && src.kind === 'content';
    })
    .map(([file, targets]) => ({ file, count: targets.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // 7. Report.
  const lines = [];
  lines.push('# Internal Link Audit');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Content items scanned: ${nodes.size}`);
  lines.push('');

  lines.push(`## Orphan pages (${orphans.length})`);
  lines.push('Nothing on the site links to these. Add at least one contextual link from a related article.');
  orphans.forEach((o) => lines.push(`- ${o.url}  (${o.file})`));
  lines.push('');

  lines.push(`## Reachable only via sidebar/footer (${chromeOnly.length})`);
  lines.push('Linked sitewide but never from article body text. Weak signal: add editorial links from related articles.');
  chromeOnly.forEach((o) => lines.push(`- ${o.url}  (${o.file})`));
  lines.push('');

  lines.push(`## Broken internal links (${broken.length})`);
  lines.push('Targets that do not match any content item or static route.');
  broken.forEach((b) => {
    lines.push(`- ${b.target}`);
    b.sources.forEach((s) => lines.push(`    - linked from ${s}`));
  });
  lines.push('');

  lines.push('## Link hubs (top 15 by outbound internal links)');
  hubs.forEach((h) => lines.push(`- ${h.count}  ${h.file}`));
  lines.push('');

  const report = lines.join('\n');
  await writeFile(REPORT_PATH, report, 'utf-8');

  console.log(`Orphans: ${orphans.length}`);
  console.log(`Reachable only via chrome: ${chromeOnly.length}`);
  console.log(`Broken internal links: ${broken.length}`);
  console.log(`\nFull report written to ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
