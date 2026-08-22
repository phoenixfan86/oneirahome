// Backfills the `tags` field for any article that has it empty — whether
// that's because it never went through the editing pass, or because the
// editing pass ran but Gemini didn't return tags that time (which used to
// fail silently; edit-dreams.mjs now flags that as a qcIssue instead).
//
// This script only touches the `tags:` line in each file's frontmatter —
// everything else (draft, edited, qcIssues, body) is left exactly as is.
// Safe to re-run: it skips any file that already has non-empty tags.
//
// Usage:
//   node --env-file=.env scripts/fill-tags.mjs
//
// Tag generation is a small, cheap request (no full article text needed
// beyond a short description), so this groups more items per call than
// generate/edit do.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'gemini-3.6-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const DREAMS_DIR = path.resolve('src/content/dreams');

const DELAY_MS = 10000;
const GROUP_SIZE = 8; // cheap request — safe to batch more than full-article calls
const REQUESTS_PER_RUN = 3;

if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY. Set it in a .env file or your shell environment.');
  process.exit(1);
}

function extractField(raw, key) {
  const m = raw.match(new RegExp(`^${key}:\\s*"?(.*?)"?$`, 'm'));
  return m ? m[1] : '';
}

function hasEmptyTags(raw) {
  const m = raw.match(/^tags:\s*\[(.*)\]\s*$/m);
  if (!m) return true; // no tags line at all — treat as empty
  return m[1].trim() === '';
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

function buildTagsPrompt(items) {
  const list = items
    .map((item, i) => `${i + 1}. symbol: "${item.symbol}" — description: "${item.description}"`)
    .join('\n');

  return `For each dream-dictionary article below, suggest 3-5 short lowercase tags (single words or short phrases, e.g. "fear", "transformation", "relationships") that describe its themes.

Articles:
${list}

Respond with ONLY a valid JSON array, no markdown code fences, no commentary, in exactly this shape:
[
  { "symbol": "<symbol exactly as given>", "tags": ["tag1", "tag2", "tag3"] }
]`;
}

async function main() {
  const files = (await readdir(DREAMS_DIR)).filter((f) => f.endsWith('.md'));

  const candidates = [];
  for (const file of files) {
    const raw = await readFile(path.join(DREAMS_DIR, file), 'utf-8');
    if (hasEmptyTags(raw)) {
      candidates.push({
        file,
        raw,
        symbol: extractField(raw, 'symbol'),
        description: extractField(raw, 'description'),
      });
    }
  }

  const groups = [];
  for (let i = 0; i < candidates.length; i += GROUP_SIZE) {
    groups.push(candidates.slice(i, i + GROUP_SIZE));
  }
  const groupsThisRun = groups.slice(0, REQUESTS_PER_RUN);
  const itemsThisRun = groupsThisRun.reduce((sum, g) => sum + g.length, 0);

  console.log(`${candidates.length} article(s) with empty tags, in ${groups.length} group(s).`);
  console.log(`This run: ${groupsThisRun.length} request(s) covering ${itemsThisRun} article(s).`);
  if (candidates.length === 0) {
    console.log('Nothing to do — every article already has tags.');
    return;
  }

  for (const group of groupsThisRun) {
    const symbolList = group.map((g) => g.symbol).join(', ');
    console.log(`Tagging: ${symbolList}...`);

    try {
      const results = await callGeminiJson(buildTagsPrompt(group));

      for (const item of group) {
        const match = results.find(
          (r) => r.symbol?.toLowerCase().trim() === item.symbol.toLowerCase().trim()
        );

        if (!match || !Array.isArray(match.tags) || match.tags.length === 0) {
          console.error(`  No tags returned for "${item.symbol}" — will retry next run.`);
          continue;
        }

        const tags = match.tags.map((t) => String(t).toLowerCase());
        const tagsYaml = `[${tags.map((t) => `"${t}"`).join(', ')}]`;

        const updatedRaw = item.raw.replace(/^tags:\s*\[.*\]\s*$/m, `tags: ${tagsYaml}`);

        await writeFile(path.join(DREAMS_DIR, item.file), updatedRaw, 'utf-8');
        console.log(`  ${item.symbol}: [${tags.join(', ')}]`);
      }
    } catch (err) {
      console.error(`  Failed on group [${symbolList}]: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log('\nDone. Re-run the script if there are still articles left with empty tags.');
}

main();
