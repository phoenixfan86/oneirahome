// Generates "Top 5" roundup articles per category — no AI call needed,
// this is pure aggregation of data that already exists in src/content/dreams/.
//
// How it decides what to create:
//   1. Reads every published dream article (slug, category, pubDate, title,
//      description) directly from the .md files.
//   2. Reads every EXISTING roundup (in src/content/roundups/) to see which
//      dream slugs have already been used in a past roundup, per category.
//   3. For each category, takes the dream articles NOT yet used, oldest
//      first (FIFO — fair, chronological), and batches them into groups of
//      5. Each complete group of 5 becomes a new roundup file.
//   4. If a category has fewer than 5 uncovered articles, nothing happens
//      for it yet — it'll get picked up next time you run this script,
//      once enough new articles accumulate.
//
// Usage:
//   node scripts/generate-roundups.mjs
//
// No .env / API key required — safe to run as often as you like, doesn't
// touch your Gemini daily quota at all.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const DREAMS_DIR = path.resolve('src/content/dreams');
const ROUNDUPS_DIR = path.resolve('src/content/roundups');
const BATCH_SIZE = 5;

function extractField(raw, key) {
  const m = raw.match(new RegExp(`^${key}:\\s*"?(.*?)"?$`, 'm'));
  return m ? m[1] : '';
}

function isDraft(raw) {
  return /^draft:\s*true/m.test(raw);
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function main() {
  await mkdir(ROUNDUPS_DIR, { recursive: true });

  // 1. Load all published dream articles
  const dreamFiles = (await readdir(DREAMS_DIR)).filter((f) => f.endsWith('.md'));
  const dreams = [];
  for (const file of dreamFiles) {
    const raw = await readFile(path.join(DREAMS_DIR, file), 'utf-8');
    if (isDraft(raw)) continue; // only published articles count
    dreams.push({
      slug: file.replace(/\.md$/, ''),
      category: extractField(raw, 'category'),
      pubDate: extractField(raw, 'pubDate'),
    });
  }

  // 2. Load existing roundups to know which slugs are already covered
  const roundupFiles = (await readdir(ROUNDUPS_DIR).catch(() => [])).filter((f) =>
    f.endsWith('.json')
  );

  const coveredByCategory = {}; // category -> Set of slugs already used
  const roundupCountByCategory = {}; // category -> how many roundups exist already

  for (const file of roundupFiles) {
    const raw = await readFile(path.join(ROUNDUPS_DIR, file), 'utf-8');
    const data = JSON.parse(raw);
    (coveredByCategory[data.category] ??= new Set());
    data.dreamSlugs.forEach((s) => coveredByCategory[data.category].add(s));
    roundupCountByCategory[data.category] = (roundupCountByCategory[data.category] || 0) + 1;
  }

  // 3. Group uncovered dreams by category, oldest first
  const byCategory = {};
  for (const d of dreams) {
    (byCategory[d.category] ??= []).push(d);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].sort((a, b) => a.pubDate.localeCompare(b.pubDate));
  }

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  let createdCount = 0;

  for (const [category, entries] of Object.entries(byCategory)) {
    const covered = coveredByCategory[category] || new Set();
    const pending = entries.filter((d) => !covered.has(d.slug));

    while (pending.length >= BATCH_SIZE) {
      const batch = pending.splice(0, BATCH_SIZE);
      const roundupNumber = (roundupCountByCategory[category] || 0) + 1;
      roundupCountByCategory[category] = roundupNumber;

      // Stable, unique filename per roundup (doesn't depend on the month,
      // so two roundups created in the same run/month never collide).
      const slug = `${slugify(category)}-top-${roundupNumber}`;
      const filePath = path.join(ROUNDUPS_DIR, `${slug}.json`);

      const data = {
        title: `Top 5 ${capitalize(category)} Dream Meanings — ${monthLabel}`,
        description: `Five ${category} dream meanings worth a closer look, picked from our latest additions to the dictionary.`,
        category,
        period: monthLabel,
        dreamSlugs: batch.map((d) => d.slug),
        pubDate: new Date().toISOString().slice(0, 10),
      };

      await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      console.log(`Created: ${filePath}  (${batch.map((d) => d.slug).join(', ')})`);
      createdCount++;
    }

    if (pending.length > 0) {
      console.log(`${category}: ${pending.length} article(s) still waiting for the next batch of 5.`);
    }
  }

  if (createdCount === 0) {
    console.log('\nNo category has 5+ uncovered articles yet — nothing to create this run.');
  } else {
    console.log(`\nCreated ${createdCount} new roundup(s).`);
  }
}

main();
