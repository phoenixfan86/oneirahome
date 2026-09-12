// Generates dream-interpretation articles using the free Gemini API tier
// and writes them as Markdown files into src/content/dreams/.
//
// KEY IDEA: the free tier's tightest constraint is usually requests/day
// (RPD), not output tokens per response. So instead of 1 API call per
// article, this script groups several topics from the SAME category into
// a single call, asks Gemini to return a JSON array of full articles, and
// splits the result back into separate files. 3 topics/request instead of
// 1 means ~3x more articles for the same daily request budget.
//
// Usage:
//   1. Get a free API key at https://aistudio.google.com/apikey
//   2. Create a .env file in the project root with:
//        GEMINI_API_KEY=your_key_here
//   3. Run:  node --env-file=.env scripts/generate-dreams.mjs
//      (Node 20.6+ supports --env-file natively — no extra package needed)
//
// The script is idempotent: it skips any symbol that already has a file,
// so you can re-run it daily (or multiple times a day) to keep working
// within the free-tier request limit without regenerating what you have.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'gemini-3.6-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const DREAMS_DIR = path.resolve('src/content/dreams');
const TOPICS_FILE = path.resolve('scripts/topics.json');

// Delay between requests, in ms. Free tier is rate-limited per minute
// (RPM) as well as per day (RPD). Check your live numbers in Google AI
// Studio -> Rate Limits, since these change over time and vary by account.
const DELAY_MS = 10000;

// How many topics get combined into ONE API request. They're grouped by
// category (matching how you described it — e.g. 3 "animals" topics
// together), since that also makes the prompt more focused. Raise this
// cautiously: more topics per request = more output tokens per response,
// and free-tier responses are usually capped around 8k output tokens —
// 3-4 articles of 500-700 words each stays comfortably under that.
const GROUP_SIZE = 3;

// How many API requests this run makes. Total topics processed per run =
// REQUESTS_PER_RUN * GROUP_SIZE. With the defaults (3 x 3) that's 9
// articles for only 3 requests — leaves plenty of your daily quota free
// for the editing pass (scripts/edit-dreams.mjs) too, since it draws from
// the same daily limit.
const REQUESTS_PER_RUN = 3;

if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY. Set it in a .env file or your shell environment.');
  process.exit(1);
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function capitalize(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Groups pending topics by category, then chunks each category's list
// into GROUP_SIZE-sized batches. Returns an array of { category, topics }.
function buildGroups(pendingTopics, groupSize) {
  const byCategory = {};
  for (const t of pendingTopics) {
    (byCategory[t.category] ??= []).push(t);
  }

  const groups = [];
  for (const category of Object.keys(byCategory)) {
    const items = byCategory[category];
    for (let i = 0; i < items.length; i += groupSize) {
      groups.push({ category, topics: items.slice(i, i + groupSize) });
    }
  }
  return groups;
}

function buildGroupPrompt(topics) {
  const list = topics.map((t, i) => `${i + 1}. "${t.symbol}"`).join('\n');

  return `You are writing articles for an English-language dream interpretation website.

Write ${topics.length} separate, ORIGINAL articles (500-700 words each) about the meaning of dreaming about each of these symbols:
${list}

For EACH article:
- Use Markdown with "##" subheadings (no H1 — the site adds the title separately).
- Each "##" subheading must open with a direct 1-2 sentence answer to what that section covers, before adding detail — this is important for how the content gets used, not just for readers.
- Cover: general meaning, 3-5 common scenarios/variations, a psychological perspective, and a short closing reflection prompt.
- Calm, informative tone — not clickbait. Use phrasing like "may suggest" rather than absolute claims.
- Do not repeat the phrase "dreaming about <symbol>" more than twice.
- Each article must be fully independent — do not mention, compare, or reference the other symbols in this list.
- Also write 3 short FAQ question-and-answer pairs for each article (e.g. "What does it mean to dream about a snake?"), with direct 1-2 sentence answers — these appear as a separate FAQ block, so don't just repeat the article's opening sentence verbatim.

Respond with ONLY a JSON array, no markdown code fences, no commentary, in exactly this shape:
[
  {
    "symbol": "<the symbol exactly as given above>",
    "title": "<Symbol, capitalized>: Dream Meaning: What Does It Mean?",
    "description": "<one-sentence meta description, under 160 characters>",
    "body": "<the full markdown article for this symbol>",
    "faq": [
      { "question": "<question>", "answer": "<1-2 sentence answer>" }
    ]
  }
]`;
}

async function callGeminiJson(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // Forces Gemini to return raw JSON (no ```json fences to strip),
      // which makes parsing a multi-article response reliable.
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No text returned from Gemini — response shape may have changed.');
  }
  return JSON.parse(text);
}

function buildFrontmatter({ symbol, category, title, description, faq }) {
  const today = new Date().toISOString().slice(0, 10);
  const faqYaml = faq && faq.length
    ? `\n${faq.map((f) => `  - question: "${f.question.replace(/"/g, '\\"')}"\n    answer: "${f.answer.replace(/"/g, '\\"')}"`).join('\n')}`
    : ' []';

  return `---
title: "${title.replace(/"/g, '\\"')}"
symbol: "${symbol}"
description: "${description.replace(/"/g, '\\"')}"
category: "${category}"
tags: []
faq:${faqYaml}
pubDate: ${today}
draft: true
source: "${MODEL}"
edited: false
qcIssues: []
---
`;
}

async function main() {
  await mkdir(DREAMS_DIR, { recursive: true });

  const topics = JSON.parse(await readFile(TOPICS_FILE, 'utf-8'));
  const existing = new Set((await readdir(DREAMS_DIR)).map((f) => f.replace(/\.md$/, '')));

  const allPending = topics.filter((t) => !existing.has(slugify(t.symbol)));
  const allGroups = buildGroups(allPending, GROUP_SIZE);
  const groupsThisRun = allGroups.slice(0, REQUESTS_PER_RUN);

  const topicsThisRun = groupsThisRun.reduce((sum, g) => sum + g.topics.length, 0);
  console.log(`${allPending.length} topic(s) remaining overall, in ${allGroups.length} group(s).`);
  console.log(`This run: ${groupsThisRun.length} request(s) covering ${topicsThisRun} topic(s).`);
  if (allGroups.length > groupsThisRun.length) {
    console.log('Run the script again (e.g. later today or tomorrow) to continue with the rest.');
  }

  for (const group of groupsThisRun) {
    const symbolList = group.topics.map((t) => t.symbol).join(', ');
    console.log(`Generating [${group.category}]: ${symbolList}...`);

    try {
      const articles = await callGeminiJson(buildGroupPrompt(group.topics));

      for (const topic of group.topics) {
        const match = articles.find(
          (a) => a.symbol?.toLowerCase().trim() === topic.symbol.toLowerCase().trim()
        );

        if (!match) {
          console.error(`  Missing "${topic.symbol}" in the response — skipping, it'll retry next run.`);
          continue;
        }

        const slug = slugify(topic.symbol);
        const filePath = path.join(DREAMS_DIR, `${slug}.md`);
        const frontmatter = buildFrontmatter({
          symbol: topic.symbol,
          category: topic.category,
          title: match.title || `${capitalize(topic.symbol)} Dream Meaning: What Does It Mean?`,
          description: match.description || `What does it mean to dream about ${topic.symbol}?`,
          faq: match.faq || [],
        });

        await writeFile(filePath, frontmatter + '\n' + match.body.trim() + '\n', 'utf-8');
        console.log(`  Saved -> ${filePath}`);
      }
    } catch (err) {
      console.error(`  Failed on group [${symbolList}]: ${err.message}`);
      // Continue to the next group rather than aborting the whole run.
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log('Done. Next: run scripts/edit-dreams.mjs, then review before publishing.');
}

main();
