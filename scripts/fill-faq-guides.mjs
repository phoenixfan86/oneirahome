// Backfills the `faq` field for published guide articles that don't have
// one yet. Same approach as fill-faq.mjs for dreams, adapted for guides:
// matches by title (guides have no `symbol` field) and sends the full
// article body so FAQ answers stay grounded in what's actually written.
//
// Usage:
//   node --env-file=.env scripts/fill-faq-guides.mjs

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'gemini-3.6-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const GUIDES_DIR = path.resolve('src/content/guides');

const DELAY_MS = 10000;
const GROUP_SIZE = 3;
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
  if (/^faq:\s*\[\]\s*$/m.test(raw)) return true;
  if (!/^faq:/m.test(raw)) return true;
  return false;
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
    return raw.replace(/^faq:\s*\[\]\s*$/m, faqBlock);
  }
  if (/^faq:/m.test(raw)) return raw;
  if (/^pubDate:/m.test(raw)) {
    return raw.replace(/^pubDate:/m, `${faqBlock}\npubDate:`);
  }
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
    .map((item, i) => `Article ${i + 1} — title: "${item.title}"\n"""\n${item.body}\n"""`)
    .join('\n\n');

  return `For each guide article below, write exactly 3 short FAQ question-and-answer pairs based on what the article actually says.

Requirements:
- Questions should be natural things a reader might type into a search engine.
- Answers must be direct, 1-2 sentences, and consistent with the article's actual content — do not introduce new claims the article doesn't support.
- If the article already has its own "Frequently Asked Questions" section, base these on that section specifically rather than duplicating other parts of the article.
- Treat each article independently.

Articles:
${list}

Respond with ONLY a valid JSON array, no markdown code fences, no commentary, in exactly this shape:
[
  {
    "title": "<title exactly as given>",
    "faq": [
      { "question": "<question>", "answer": "<answer>" }
    ]
  }
]`;
}

async function main() {
  const files = (await readdir(GUIDES_DIR)).filter((f) => f.endsWith('.md'));

  const candidates = [];
  for (const file of files) {
    const raw = await readFile(path.join(GUIDES_DIR, file), 'utf-8');
    if (/^draft:\s*true/m.test(raw)) continue;
    if (hasEmptyFaq(raw)) {
      candidates.push({
        file,
        raw,
        title: extractField(raw, 'title'),
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

  console.log(`${candidates.length} published guide(s) missing FAQ, in ${groups.length} group(s).`);
  console.log(`This run: ${groupsThisRun.length} request(s) covering ${itemsThisRun} guide(s).`);
  if (candidates.length === 0) {
    console.log('Nothing to do — every published guide already has FAQ.');
    return;
  }

  for (const group of groupsThisRun) {
    const titleList = group.map((g) => g.title).join(' | ');
    console.log(`Generating FAQ: ${titleList}...`);

    try {
      const results = await callGeminiJson(buildFaqPrompt(group));

      for (const item of group) {
        const match = results.find(
          (r) => r.title?.toLowerCase().trim() === item.title.toLowerCase().trim()
        );

        if (!match || !Array.isArray(match.faq) || match.faq.length === 0) {
          console.error(`  No FAQ returned for "${item.title}" — will retry next run.`);
          continue;
        }

        const faqBlock = buildFaqYamlBlock(match.faq);
        const updatedRaw = insertOrReplaceFaq(item.raw, faqBlock);

        await writeFile(path.join(GUIDES_DIR, item.file), updatedRaw, 'utf-8');
        console.log(`  ${item.title}: ${match.faq.length} FAQ pair(s) added`);
      }
    } catch (err) {
      console.error(`  Failed on group [${titleList}]: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log('\nDone. Re-run the script if there are still published guides missing FAQ.');
}

main();
