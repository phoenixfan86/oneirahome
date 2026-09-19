// Backfills the `faq` field for already-published dream articles that
// don't have one yet (either never generated, or written before the faq
// field existed in the schema). Same batching/rate-limit approach as
// fill-tags.mjs and edit-dreams.mjs.
//
// Unlike fill-tags.mjs, this sends the article's FULL BODY to Gemini (not
// just symbol + description) — the FAQ answers need to stay consistent
// with what the article actually says, not just guess generically.
//
// Usage:
//   node --env-file=.env scripts/fill-faq.mjs

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'gemini-3.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const DREAMS_DIR = path.resolve('src/content/dreams');

const DELAY_MS = 10000;
const GROUP_SIZE = 3; // smaller than fill-tags.mjs — full article bodies are heavier per request
const REQUESTS_PER_RUN = 3;

if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY. Set it in a .env file or your shell environment.');
  process.exit(1);
}

function extractField(raw, key) {
  const m = raw.match(new RegExp(`^${key}:\\s*"?(.*?)"?$`, 'm'));
  return m ? m[1] : '';
}

function extractBody(raw) {
  const m = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return m ? m[1].trim() : '';
}

function hasEmptyFaq(raw) {
  if (/^faq:\s*\[\]\s*$/m.test(raw)) return true; // explicit empty array
  if (!/^faq:/m.test(raw)) return true; // field missing entirely (older files)
  return false; // already has real FAQ content
}

function buildFaqYamlBlock(faq) {
  return `faq:\n${faq
    .map(
      (f) =>
        `  - question: "${f.question.replace(/"/g, '\\"')}"\n    answer: "${f.answer.replace(/"/g, '\\"')}"`
    )
    .join('\n')}`;
}

function insertOrReplaceFaq(raw, faqBlock) {
  if (/^faq:\s*\[\]\s*$/m.test(raw)) {
    // Replace the existing empty array line
    return raw.replace(/^faq:\s*\[\]\s*$/m, faqBlock);
  }
  if (/^faq:/m.test(raw)) {
    // Has some faq: block already but wasn't caught as "empty" — leave as is
    return raw;
  }
  // No faq field at all — insert it right before pubDate for consistent
  // field ordering with newly-generated articles.
  if (/^pubDate:/m.test(raw)) {
    return raw.replace(/^pubDate:/m, `${faqBlock}\npubDate:`);
  }
  // Fallback: append right after the opening frontmatter fence's first line
  return raw.replace(/^---\n/, `---\n${faqBlock}\n`);
}

async function callGeminiJson(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text returned from Gemini.');
  return JSON.parse(text);
}

function buildFaqPrompt(items) {
  const list = items
    .map((item, i) => `Article ${i + 1} — symbol: "${item.symbol}"\n"""\n${item.body}\n"""`)
    .join('\n\n');

  return `For each dream-dictionary article below, write exactly 3 short FAQ question-and-answer pairs based on what the article actually says.

Requirements:
- Questions should be natural things a reader might type into a search engine (e.g. "What does it mean to dream about a snake?").
- Answers must be direct, 1-2 sentences, and consistent with the article's actual content — do not introduce new claims the article doesn't support.
- Treat each article independently.

Articles:
${list}

Respond with ONLY a valid JSON array, no markdown code fences, no commentary, in exactly this shape:
[
  {
    "symbol": "<symbol exactly as given>",
    "faq": [
      { "question": "<question>", "answer": "<answer>" }
    ]
  }
]`;
}

async function main() {
  const files = (await readdir(DREAMS_DIR)).filter((f) => f.endsWith('.md'));

  const candidates = [];
  for (const file of files) {
    const raw = await readFile(path.join(DREAMS_DIR, file), 'utf-8');
    if (/^draft:\s*true/m.test(raw)) continue; // only backfill published articles
    if (hasEmptyFaq(raw)) {
      candidates.push({
        file,
        raw,
        symbol: extractField(raw, 'symbol'),
        body: extractBody(raw),
      });
    }
  }

  const groups = [];
  for (let i = 0; i < candidates.length; i += GROUP_SIZE) {
    groups.push(candidates.slice(i, i + GROUP_SIZE));
  }
  const groupsThisRun = groups.slice(0, REQUESTS_PER_RUN);
  const itemsThisRun = groupsThisRun.reduce((sum, g) => sum + g.length, 0);

  console.log(`${candidates.length} published article(s) missing FAQ, in ${groups.length} group(s).`);
  console.log(`This run: ${groupsThisRun.length} request(s) covering ${itemsThisRun} article(s).`);
  if (candidates.length === 0) {
    console.log('Nothing to do — every published article already has FAQ.');
    return;
  }

  for (const group of groupsThisRun) {
    const symbolList = group.map((g) => g.symbol).join(', ');
    console.log(`Generating FAQ: ${symbolList}...`);

    try {
      const results = await callGeminiJson(buildFaqPrompt(group));

      for (const item of group) {
        const match = results.find(
          (r) => r.symbol?.toLowerCase().trim() === item.symbol.toLowerCase().trim()
        );

        if (!match || !Array.isArray(match.faq) || match.faq.length === 0) {
          console.error(`  No FAQ returned for "${item.symbol}" — will retry next run.`);
          continue;
        }

        const faqBlock = buildFaqYamlBlock(match.faq);
        const updatedRaw = insertOrReplaceFaq(item.raw, faqBlock);

        await writeFile(path.join(DREAMS_DIR, item.file), updatedRaw, 'utf-8');
        console.log(`  ${item.symbol}: ${match.faq.length} FAQ pair(s) added`);
      }
    } catch (err) {
      console.error(`  Failed on group [${symbolList}]: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log('\nDone. Re-run the script if there are still published articles missing FAQ.');
}

main();
