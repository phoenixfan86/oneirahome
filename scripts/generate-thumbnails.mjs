// Generates compressed thumbnail versions of article images for use in
// list views (homepage, categories, tags, related dreams) — the full-size
// original stays untouched and is only used on the article's own detail
// page as the hero image.
//
// Why this is needed: images come straight out of an AI image generator
// at full resolution (e.g. 1376x768), but list views only ever display
// them as small thumbnails (~300px wide). Without a resized variant, the
// browser downloads the full 150+ KiB file just to shrink it visually via
// CSS — wasted bandwidth, worse mobile PageSpeed scores.
//
// Usage:
//   node scripts/generate-thumbnails.mjs
//
// Requires the `sharp` package (npm install --save-dev sharp).

import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const IMG_DIR = path.resolve('public/img');
const THUMB_WIDTH = 640; // ~2x the largest rendered thumbnail size, for retina screens
const THUMB_QUALITY = 75;

function isThumbFile(filename) {
  return /-thumb\.\w+$/.test(filename);
}

function getThumbFilename(filename) {
  const ext = path.extname(filename);
  const base = filename.slice(0, -ext.length);
  return `${base}-thumb${ext}`;
}

async function main() {
  const files = (await readdir(IMG_DIR)).filter(
    (f) => /\.(webp|jpg|jpeg|png)$/i.test(f) && !isThumbFile(f)
  );

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const thumbFilename = getThumbFilename(file);
    const thumbPath = path.join(IMG_DIR, thumbFilename);

    // Skip if a thumbnail already exists for this image.
    const existing = await readdir(IMG_DIR);
    if (existing.includes(thumbFilename)) {
      skipped++;
      continue;
    }

    const sourcePath = path.join(IMG_DIR, file);
    await sharp(sourcePath)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toFile(thumbPath.replace(/\.\w+$/, '.webp')); // always output .webp regardless of source format

    console.log(`Created: ${thumbFilename}`);
    created++;
  }

  console.log(`\n${created} thumbnail(s) created, ${skipped} already existed.`);
}

main();
