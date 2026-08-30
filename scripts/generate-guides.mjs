// Generates longer-form guide articles (lucid dreaming, sleep paralysis,
// etc.) for the `guides` content collection. Same batching/rate-limit
// approach as generate-dreams.mjs — groups multiple topics into one API
// request to save daily quota — just adapted for the guides schema
// (no symbol/category, longer word count).
//
// Usage:
//   node --env-file=.env scripts/generate-guides.mjs

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const MODEL = 'gemini-3.6-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const GUIDES_DIR = path.resolve('src/content/guides');
const TOPICS_FILE = path.resolve('scripts/guide-topics.json');

const DELAY_MS = 10000;
const GROUP_SIZE = 3;       // topics combined into one API request
const REQUESTS_PER_RUN = 3; // API calls this run makes

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

function buildGroupPrompt(topics) {
  const list = topics.map((t, i) => `${i + 1}. "${t.topic}"`).join('\n');

  return `You are writing in-depth guide articles for an English-language website about dreams and sleep.

Write ${topics.length} separate, ORIGINAL guide articles (800-1200 words each) on these topics:
${list}

For EACH article:
- Use Markdown with "##" subheadings (no H1 — the site adds the title separately).
- Write as an evidence-informed explainer: cite general sleep-science understanding where relevant, avoid absolute/overconfident claims, use phrasing like "research suggests" or "is generally understood to."
- Structure: an intro paragraph, then 3-5 subheadings covering the mechanism/explanation, practical technique or advice where relevant, and a brief closing thought.
- Calm, informative tone — not clickbait, not alarmist (especially for topics like sleep paralysis or night terrors).
- Each article must be fully independent — do not reference the other topics in this list.

Respond with ONLY a JSON array, no markdown code fences, no commentary, in exactly this shape:
[
  {
    "topic": "<the topic exactly as given above>",
    "title": "<a clear, natural title for the article, not clickbait>",
    "description": "<one-sentence meta description, under 160 characters>",
    "body": "<the full markdown article for this topic>"
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

function buildFrontmatter({ title, description }) {
  const today = new Date().toISOString().slice(0, 10);
  return `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
tags: []
pubDate: ${today}
draft: true
source: "${MODEL}"
edited: false
qcIssues: []
---
`;
}

async function main() {
  await mkdir(GUIDES_DIR, { recursive: true });

  const topics = JSON.parse(await readFile(TOPICS_FILE, 'utf-8'));
  const existing = new Set((await readdir(GUIDES_DIR)).map((f) => f.replace(/\.md$/, '')));

  const allPending = topics.filter((t) => !existing.has(slugify(t.topic)));

  const groups = [];
  for (let i = 0; i < allPending.length; i += GROUP_SIZE) {
    groups.push(allPending.slice(i, i + GROUP_SIZE));
  }
  const groupsThisRun = groups.slice(0, REQUESTS_PER_RUN);
  const topicsThisRun = groupsThisRun.reduce((sum, g) => sum + g.length, 0);

  console.log(`${allPending.length} guide topic(s) remaining, in ${groups.length} group(s).`);
  console.log(`This run: ${groupsThisRun.length} request(s) covering ${topicsThisRun} topic(s).`);
  if (groups.length > groupsThisRun.length) {
    console.log('Run the script again to continue with the rest.');
  }

  for (const group of groupsThisRun) {
    const topicList = group.map((t) => t.topic).join(' | ');
    console.log(`Generating: ${topicList}...`);

    try {
      const articles = await callGeminiJson(buildGroupPrompt(group));

      for (const topic of group) {
        const match = articles.find(
          (a) => a.topic?.toLowerCase().trim() === topic.topic.toLowerCase().trim()
        );

        if (!match) {
          console.error(`  Missing "${topic.topic}" in the response — skipping, retries next run.`);
          continue;
        }

        const slug = slugify(topic.topic);
        const filePath = path.join(GUIDES_DIR, `${slug}.md`);
        const frontmatter = buildFrontmatter({
          title: match.title || topic.topic,
          description: match.description || '',
        });

        await writeFile(filePath, frontmatter + '\n' + match.body.trim() + '\n', 'utf-8');
        console.log(`  Saved -> ${filePath}`);
      }
    } catch (err) {
      console.error(`  Failed on group [${topicList}]: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log('Done. Review drafts (edit-dreams.mjs currently only targets the dreams collection — review these manually before publishing, or ask to extend it to guides too).');
}

main();
