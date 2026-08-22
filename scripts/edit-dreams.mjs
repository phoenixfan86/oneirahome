// Automated post-editing pass for generated dream articles.
//
// For every article with `edited: false` in its frontmatter, this script:
//   1. Sends the body to Gemini for a proofreading/polish pass (fixes
//      awkward phrasing, repetition, grammar — does not change meaning).
//   2. Asks the same call to suggest 3-5 tags for the article, so the
//      /tags/ system fills in automatically instead of you typing tags
//      by hand for every entry.
//   3. Runs automated quality checks on the result (word count, heading
//      structure, clichéd AI phrasing, keyword-stuffing risk).
//   4. Writes the polished text back, sets `edited: true`, and records any
//      problems found in `qcIssues`.
//
// Safety: `draft` stays untouched (still true) unless you pass
// --auto-publish AND the article has zero qcIssues — then it's flipped to
// draft: false automatically. Anything with qcIssues always stays draft:
// true so you look at it before it goes live, no matter what flag you pass.
//
// Usage:
//   node --env-file=.env scripts/edit-dreams.mjs
//   node --env-file=.env scripts/edit-dreams.mjs --auto-publish
//
// Same rate-limit approach as generate-dreams.mjs: batched + delayed.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'gemini-3.6-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const DREAMS_DIR = path.resolve('src/content/dreams');

const DELAY_MS = 10000;
// Same idea as generate-dreams.mjs: combine several articles into ONE
// editing request instead of one request per article, to save daily quota.
const GROUP_SIZE = 3;
const REQUESTS_PER_RUN = 3;
const AUTO_PUBLISH = process.argv.includes('--auto-publish');

const WORD_MIN = 350;
const WORD_MAX = 900;

// Phrases that are dead giveaways of unreviewed AI output — flag, don't
// silently strip, since removing them can leave awkward gaps.
const CLICHE_PHRASES = [
  "in today's fast-paced world",
  'in the realm of',
  'delve into',
  'unlock the secrets',
  "it's important to note",
  'in conclusion',
  "let's dive in",
  'tapestry of',
  'in the ever-evolving',
];

if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY. Set it in a .env file or your shell environment.');
  process.exit(1);
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('File is missing a valid frontmatter block.');
  const [, fm, body] = match;

  const field = (key) => {
    const m = fm.match(new RegExp(`^${key}:\\s*"?(.*?)"?$`, 'm'));
    return m ? m[1] : '';
  };

  return {
    title: field('title'),
    symbol: field('symbol'),
    description: field('description'),
    category: field('category'),
    pubDate: field('pubDate'),
    source: field('source'),
    draft: field('draft') === 'true',
    body: body.trim(),
  };
}

function buildFrontmatter(data) {
  const tagsYaml = data.tags.length
    ? `[${data.tags.map((t) => `"${t}"`).join(', ')}]`
    : '[]';
  const issuesYaml = data.qcIssues.length
    ? `\n${data.qcIssues.map((i) => `  - "${i.replace(/"/g, '\\"')}"`).join('\n')}`
    : ' []';

  return `---
title: "${data.title.replace(/"/g, '\\"')}"
symbol: "${data.symbol}"
description: "${data.description.replace(/"/g, '\\"')}"
category: "${data.category}"
tags: ${tagsYaml}
pubDate: ${data.pubDate}
draft: ${data.draft}
source: "${data.source}"
edited: true
qcIssues:${issuesYaml}
---
`;
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

function buildGroupEditPrompt(items) {
  const list = items
    .map((item, i) => `Article ${i + 1} — symbol: "${item.symbol}"\n"""\n${item.body}\n"""`)
    .join('\n\n');

  return `You are a copy editor for an English-language dream interpretation website. Below are ${items.length} draft articles.

For EACH article:
1. Proofread and lightly polish the text: fix grammar, awkward phrasing, repetitive sentences. Do not change the meaning or add new claims.
2. Suggest 3-5 short lowercase tags (single words or short phrases, e.g. "fear", "transformation").

Treat each article independently — do not blend or cross-reference them.

Respond with ONLY a valid JSON array, no markdown code fences, no commentary, in exactly this shape:
[
  { "symbol": "<symbol exactly as given>", "tags": ["tag1", "tag2", "tag3"], "body": "<the polished markdown article>" }
]

Drafts:
${list}`;
}

function runQualityChecks(symbol, body, tags) {
  const issues = [];

  if (!tags || tags.length === 0) {
    issues.push('No tags returned by the editor pass — needs manual tagging or a fill-tags.mjs run');
  }

  const wordCount = body.trim().split(/\s+/).length;
  if (wordCount < WORD_MIN) issues.push(`Too short (${wordCount} words, min ${WORD_MIN})`);
  if (wordCount > WORD_MAX) issues.push(`Too long (${wordCount} words, max ${WORD_MAX})`);

  const headingCount = (body.match(/^##\s/gm) || []).length;
  if (headingCount < 2) issues.push(`Only ${headingCount} subheadings — structure may be thin`);

  const lowerBody = body.toLowerCase();
  for (const phrase of CLICHE_PHRASES) {
    if (lowerBody.includes(phrase)) issues.push(`Contains AI cliché phrase: "${phrase}"`);
  }

  const symbolMentions = lowerBody.split(symbol.toLowerCase()).length - 1;
  if (symbolMentions > 6) issues.push(`Symbol repeated ${symbolMentions} times — possible keyword stuffing`);

  return issues;
}

async function main() {
  const files = (await readdir(DREAMS_DIR)).filter((f) => f.endsWith('.md'));

  const candidates = [];
  for (const file of files) {
    const raw = await readFile(path.join(DREAMS_DIR, file), 'utf-8');
    if (/^edited:\s*false/m.test(raw)) {
      candidates.push({ file, ...parseFrontmatter(raw) });
    }
  }

  const groups = [];
  for (let i = 0; i < candidates.length; i += GROUP_SIZE) {
    groups.push(candidates.slice(i, i + GROUP_SIZE));
  }
  const groupsThisRun = groups.slice(0, REQUESTS_PER_RUN);
  const itemsThisRun = groupsThisRun.reduce((sum, g) => sum + g.length, 0);

  console.log(`${candidates.length} article(s) awaiting the editing pass, in ${groups.length} group(s).`);
  console.log(`This run: ${groupsThisRun.length} request(s) covering ${itemsThisRun} article(s).`);
  if (AUTO_PUBLISH) console.log('--auto-publish is ON: clean articles (0 qcIssues) will be set draft: false automatically.');

  const report = [];

  for (const group of groupsThisRun) {
    const symbolList = group.map((g) => g.symbol).join(', ');
    console.log(`Editing: ${symbolList}...`);

    try {
      const results = await callGeminiJson(buildGroupEditPrompt(group));

      for (const item of group) {
        const match = results.find(
          (r) => r.symbol?.toLowerCase().trim() === item.symbol.toLowerCase().trim()
        );

        if (!match || !match.body) {
          console.error(`  Missing "${item.symbol}" in the response — skipping, it'll retry next run.`);
          continue;
        }

        const polishedBody = match.body.trim();
        const tags = Array.isArray(match.tags) ? match.tags.map((t) => String(t).toLowerCase()) : [];
        const qcIssues = runQualityChecks(item.symbol, polishedBody, tags);
        const shouldPublish = AUTO_PUBLISH && qcIssues.length === 0 ? false : item.draft;

        const newFrontmatter = buildFrontmatter({
          ...item,
          tags,
          qcIssues,
          draft: shouldPublish,
        });

        await writeFile(path.join(DREAMS_DIR, item.file), newFrontmatter + '\n' + polishedBody + '\n', 'utf-8');

        report.push({ symbol: item.symbol, issues: qcIssues.length, published: !shouldPublish });
        console.log(`  ${item.symbol}: ${qcIssues.length === 0 ? 'clean' : `${qcIssues.length} issue(s) flagged`}`);
      }
    } catch (err) {
      console.error(`  Failed on group [${symbolList}]: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log('\n--- Summary ---');
  for (const r of report) {
    const status = r.published ? 'AUTO-PUBLISHED' : r.issues > 0 ? `NEEDS REVIEW (${r.issues} issue(s))` : 'clean, still draft';
    console.log(`  ${r.symbol}: ${status}`);
  }
  console.log('\nArticles with qcIssues need a manual read before you flip draft to false.');
}

main();
