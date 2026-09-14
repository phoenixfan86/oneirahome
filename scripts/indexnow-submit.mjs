// Submits new (and optionally specific) URLs to IndexNow — a protocol
// supported by Bing, Yandex, Naver, Seznam, and Yep (NOT Google, which
// doesn't participate as of 2026). Bing's index also feeds ChatGPT
// Search, Microsoft Copilot, and partly Perplexity, so this is worth
// doing even though it does nothing for Google directly.
//
// One-time setup (see instructions below the script) creates a key file
// that proves domain ownership. After that, this script just needs to
// run whenever you publish or update content.
//
// Usage:
//   node scripts/indexnow-submit.mjs
//     -> finds all published dreams/guides/roundups not yet submitted,
//        submits them, and remembers them so they're not resubmitted.
//
//   node scripts/indexnow-submit.mjs --url https://oneirahome.com/dream/snake/
//     -> force-submits one specific URL (e.g. after editing an old
//        article) regardless of whether it was submitted before.
//
// No paid API, no daily limit that matters at this scale (IndexNow
// accepts up to 10,000 URLs per request).

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://oneirahome.com';
const INDEXNOW_KEY = '769400d8b9d9988b728cff5a83170f6c'; // see setup instructions
const STATE_FILE = path.resolve('scripts/.indexnow-submitted.json');

const DREAMS_DIR = path.resolve('src/content/dreams');
const GUIDES_DIR = path.resolve('src/content/guides');
const ROUNDUPS_DIR = path.resolve('src/content/roundups');

function isDraftMd(raw) {
  return /^draft:\s*true/m.test(raw);
}

async function loadState() {
  try {
    const raw = await readFile(STATE_FILE, 'utf-8');
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

async function saveState(set) {
  await writeFile(STATE_FILE, JSON.stringify([...set], null, 2) + '\n', 'utf-8');
}

async function collectPublishedUrls() {
  const urls = [];

  // Dreams
  const dreamFiles = (await readdir(DREAMS_DIR).catch(() => [])).filter((f) => f.endsWith('.md'));
  for (const file of dreamFiles) {
    const raw = await readFile(path.join(DREAMS_DIR, file), 'utf-8');
    if (isDraftMd(raw)) continue;
    urls.push(`${SITE}/dream/${file.replace(/\.md$/, '')}/`);
  }

  // Guides
  const guideFiles = (await readdir(GUIDES_DIR).catch(() => [])).filter((f) => f.endsWith('.md'));
  for (const file of guideFiles) {
    const raw = await readFile(path.join(GUIDES_DIR, file), 'utf-8');
    if (isDraftMd(raw)) continue;
    urls.push(`${SITE}/guides/${file.replace(/\.md$/, '')}/`);
  }

  // Roundups (data collection — always published, no draft field)
  const roundupFiles = (await readdir(ROUNDUPS_DIR).catch(() => [])).filter((f) => f.endsWith('.json'));
  for (const file of roundupFiles) {
    urls.push(`${SITE}/articles/${file.replace(/\.json$/, '')}/`);
  }

  return urls;
}

async function submitToIndexNow(urls) {
  const host = new URL(SITE).host;
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });

  // IndexNow returns 200 or 202 on success — no JSON body to parse.
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`IndexNow error (${res.status}): ${text}`);
  }
  return res.status;
}

async function main() {
  if (INDEXNOW_KEY === 'PASTE_YOUR_KEY_HERE') {
    console.error('Set INDEXNOW_KEY in this script first — see the setup instructions.');
    process.exit(1);
  }

  const urlArgIndex = process.argv.indexOf('--url');

  if (urlArgIndex !== -1) {
    // Force-submit a single specific URL (e.g. an edited older article).
    const url = process.argv[urlArgIndex + 1];
    if (!url) {
      console.error('Usage: node scripts/indexnow-submit.mjs --url https://oneirahome.com/dream/snake/');
      process.exit(1);
    }
    const status = await submitToIndexNow([url]);
    console.log(`Submitted 1 URL. IndexNow responded ${status}.`);
    return;
  }

  const allUrls = await collectPublishedUrls();
  const submitted = await loadState();
  const pending = allUrls.filter((u) => !submitted.has(u));

  console.log(`${allUrls.length} published URL(s) total, ${pending.length} not yet submitted.`);

  if (pending.length === 0) {
    console.log('Nothing new to submit.');
    return;
  }

  const status = await submitToIndexNow(pending);
  console.log(`Submitted ${pending.length} URL(s). IndexNow responded ${status}.`);

  pending.forEach((u) => submitted.add(u));
  await saveState(submitted);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
