// Scans dream article bodies for mentions of OTHER articles' symbols
// (e.g. "storm" appearing in the "rain" article) and writes a REPORT of
// where a link could be added — it does NOT modify your articles. You
// apply the suggested links by hand, at your own pace.
//
// Usage:
//   node scripts/auto-interlink.mjs
//   -> writes scripts/interlink-report.md
//
// No API key needed — pure text processing, zero cost. Safe to re-run
// any time (it never touches your .md files).

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DREAMS_DIR = path.resolve('src/content/dreams');
const REPORT_PATH = path.resolve('scripts/interlink-report.md');
const MAX_SUGGESTIONS_PER_ARTICLE = 10;

function normalizeLineEndings(text) {
  // Windows-saved files often use \r\n — normalize to \n so every regex
  // below behaves the same regardless of what OS/editor wrote the file.
  return text.replace(/\r\n/g, '\n');
}

function extractField(raw, key) {
  const m = raw.match(new RegExp(`^${key}:\\s*"?(.*?)"?$`, 'm'));
  return m ? m[1] : '';
}

function isDraft(raw) {
  return /^draft:\s*true/m.test(raw);
}

function splitFrontmatterBody(raw) {
  const m = raw.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  if (!m) return null; // caller decides how to handle a malformed file
  return { frontmatter: m[1], body: m[2] };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getExistingLinkRanges(line) {
  return [...line.matchAll(/\[[^\]]*\]\([^)]*\)/g)].map((m) => [m.index, m.index + m[0].length]);
}

function overlapsAny(start, end, ranges) {
  return ranges.some(([s, e]) => start < e && end > s);
}

async function main() {
  const files = (await readdir(DREAMS_DIR)).filter((f) => f.endsWith('.md'));

  const articles = [];
  const skipped = [];

  for (const file of files) {
    try {
      const rawOriginal = await readFile(path.join(DREAMS_DIR, file), 'utf-8');
      const raw = normalizeLineEndings(rawOriginal);
      if (isDraft(raw)) continue;

      const split = splitFrontmatterBody(raw);
      if (!split) {
        skipped.push(`${file}: couldn't find a valid "---" frontmatter block`);
        continue;
      }

      const symbol = extractField(raw, 'symbol');
      if (!symbol) {
        skipped.push(`${file}: no "symbol" field found in frontmatter`);
        continue;
      }

      articles.push({
        file,
        slug: file.replace(/\.md$/, ''),
        symbol,
        body: split.body,
      });
    } catch (err) {
      skipped.push(`${file}: ${err.message}`);
    }
  }

  console.log(`Loaded ${articles.length} published article(s).`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} file(s) — see report for details.`);
  }

  const targets = articles
    .map((a) => ({ symbol: a.symbol, slug: a.slug }))
    .sort((a, b) => b.symbol.length - a.symbol.length);

  const reportSections = [];
  let totalSuggestions = 0;

  for (const source of articles) {
    const alreadyLinkedSlugs = new Set(
      [...source.body.matchAll(/\]\(\/dream\/([a-z0-9-]+)\/?\)/g)].map((m) => m[1])
    );

    const lines = source.body.split('\n');
    const suggestions = [];

    for (let li = 0; li < lines.length; li++) {
      if (suggestions.length >= MAX_SUGGESTIONS_PER_ARTICLE) break;

      const line = lines[li];
      if (/^\s*#/.test(line) || line.trim() === '') continue;

      const existingRanges = getExistingLinkRanges(line);

      for (const target of targets) {
        if (suggestions.length >= MAX_SUGGESTIONS_PER_ARTICLE) break;
        if (target.slug === source.slug) continue;
        if (alreadyLinkedSlugs.has(target.slug)) continue;

        const pattern = new RegExp(`\\b(${escapeRegex(target.symbol)})\\b`, 'i');
        const match = line.match(pattern);
        if (!match) continue;

        const matchStart = match.index;
        const matchEnd = matchStart + match[1].length;
        if (overlapsAny(matchStart, matchEnd, existingRanges)) continue;

        suggestions.push({
          lineNumber: li + 1,
          lineText: line.trim(),
          matchedText: match[1],
          targetSlug: target.slug,
        });
        alreadyLinkedSlugs.add(target.slug); // don't suggest the same target twice for this article
      }
    }

    if (suggestions.length > 0) {
      totalSuggestions += suggestions.length;
      const lines = suggestions.map(
        (s) =>
          `- Line ${s.lineNumber}: link **"${s.matchedText}"** -> \`/dream/${s.targetSlug}/\`\n  > ${s.lineText}`
      );
      reportSections.push(`## ${source.symbol}  (\`${source.file}\`)\n\n${lines.join('\n\n')}`);
    }
  }

  const reportParts = [
    `# Internal Linking Suggestions`,
    `Generated: ${new Date().toISOString()}`,
    `\n${totalSuggestions} suggestion(s) across ${reportSections.length} article(s). Nothing has been changed — apply these manually.`,
  ];

  if (skipped.length > 0) {
    reportParts.push(`\n## Skipped files\n\n${skipped.map((s) => `- ${s}`).join('\n')}`);
  }

  reportParts.push('\n---\n');
  reportParts.push(reportSections.length > 0 ? reportSections.join('\n\n---\n\n') : 'No suggestions found.');

  await writeFile(REPORT_PATH, reportParts.join('\n') + '\n', 'utf-8');

  console.log(`\n${totalSuggestions} suggestion(s) written to ${REPORT_PATH}`);
}

main();
