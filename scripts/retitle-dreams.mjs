// Rewrites the `title` field of every dream article to a new pattern:
//   "{Symbol} Dream Meaning: What Does It Mean?"
// instead of the old:
//   "Dream About {Symbol}: Meaning & Interpretation"
//
// Pure text templating — no AI call, no API key, zero cost. Only touches
// the `title:` line in frontmatter; body, tags, faq, etc. are untouched.
//
// Usage:
//   node scripts/retitle-dreams.mjs --dry-run   # preview only
//   node scripts/retitle-dreams.mjs             # apply the changes

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DREAMS_DIR = path.resolve('src/content/dreams');
const DRY_RUN = process.argv.includes('--dry-run');

function capitalizeWords(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractField(raw, key) {
  const m = raw.match(new RegExp(`^${key}:\\s*"?(.*?)"?$`, 'm'));
  return m ? m[1] : '';
}

async function main() {
  const files = (await readdir(DREAMS_DIR)).filter((f) => f.endsWith('.md'));
  let changed = 0;

  for (const file of files) {
    const filePath = path.join(DREAMS_DIR, file);
    const raw = await readFile(filePath, 'utf-8');

    const symbol = extractField(raw, 'symbol');
    if (!symbol) {
      console.log(`Skipping ${file}: no symbol field found.`);
      continue;
    }

    const newTitle = `${capitalizeWords(symbol)} Dream Meaning: What Does It Mean?`;
    const currentTitle = extractField(raw, 'title');

    if (currentTitle === newTitle) continue; // already matches, nothing to do

    const updatedRaw = raw.replace(
      /^title:\s*"?.*?"?$/m,
      `title: "${newTitle.replace(/"/g, '\\"')}"`
    );

    console.log(`${file}`);
    console.log(`  old: ${currentTitle}`);
    console.log(`  new: ${newTitle}`);

    if (!DRY_RUN) {
      await writeFile(filePath, updatedRaw, 'utf-8');
    }
    changed++;
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Would update' : 'Updated'} ${changed} article title(s).`);
  if (DRY_RUN) console.log('Run without --dry-run to actually apply these changes.');
}

main();
