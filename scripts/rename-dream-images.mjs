// scripts/rename-dream-images.mjs
// Запуск: node scripts/rename-dream-images.mjs --dry-run   (лише показує план)
//         node scripts/rename-dream-images.mjs             (застосовує зміни)
import { readFile, writeFile, readdir, rename, access } from 'node:fs/promises';
import path from 'node:path';

const IMG_DIR = path.resolve('public/img');
const CONTENT_DIRS = ['src/content/dreams']; // лише словникові статті, guides не чіпаємо
const PREFIX = 'dreams-about-';
const SKIP = ['og-default', 'moon', 'half-moon', 'favicon'];
const DRY_RUN = process.argv.includes('--dry-run');

const exists = (p) => access(p).then(() => true, () => false);

// 1. Збираємо статті зі словника і план перейменування картинок
const articles = []; // { path, raw, oldUrl, newUrl }
const imagePlan = new Map(); // oldUrl -> newUrl

for (const dir of CONTENT_DIRS) {
  const abs = path.resolve(dir);
  let files = [];
  try {
    files = (await readdir(abs)).filter((f) => f.endsWith('.md'));
  } catch {
    continue;
  }

  for (const f of files) {
    const p = path.join(abs, f);
    const raw = await readFile(p, 'utf-8');
    const m = raw.match(/^img:\s*"?(\/img\/[^"\s]+)"?\s*$/m);
    if (!m) continue;

    const oldUrl = m[1];
    const base = path.basename(oldUrl).replace(/\.(webp|jpg|png)$/, '');
    if (base.startsWith(PREFIX) || SKIP.some((s) => base.includes(s))) continue;

    if (!imagePlan.has(oldUrl)) imagePlan.set(oldUrl, `/img/${PREFIX}${base}.webp`);
    articles.push({ path: p, raw, oldUrl, newUrl: imagePlan.get(oldUrl) });
  }
}

// 2. Для кожної картинки додаємо її мініатюру (завжди .webp)
const pairs = [];
for (const [oldUrl, newUrl] of imagePlan) {
  pairs.push({ kind: 'image', oldUrl, newUrl });
  const base = path.basename(oldUrl).replace(/\.(webp|jpg|png)$/, '');
  pairs.push({
    kind: 'thumb',
    oldUrl: `/img/${base}-thumb.webp`,
    newUrl: `/img/${PREFIX}${base}-thumb.webp`,
  });
}

// 3. Перейменовуємо файли
const redirects = [];
for (const { kind, oldUrl, newUrl } of pairs) {
  const oldPath = path.join(IMG_DIR, path.basename(oldUrl));
  const newPath = path.join(IMG_DIR, path.basename(newUrl));

  if (!(await exists(oldPath))) {
    console.log(`[${kind}] файлу немає, пропускаю: ${oldUrl}`);
    continue;
  }
  if (await exists(newPath)) {
    console.log(`[${kind}] цільовий файл уже є, пропускаю: ${newUrl}`);
    continue;
  }

  if (!DRY_RUN) await rename(oldPath, newPath);
  redirects.push({ source: oldUrl, destination: newUrl, permanent: true });
  console.log(`[${kind}] ${oldUrl} -> ${newUrl}`);
}

// 4. Оновлюємо фронтматер після успішного перейменування
if (!DRY_RUN) {
  for (const a of articles) {
    const updated = a.raw.replace(
      /^img:(\s*)"?\/img\/[^"\s]+"?(\s*)$/m,
      `img:$1"${a.newUrl}"$2`
    );
    await writeFile(a.path, updated, 'utf-8');
  }
}

// 5. Редіректи у vercel.json, наявні не чіпаємо
const vercelPath = path.resolve('vercel.json');
const vercel = JSON.parse(await readFile(vercelPath, 'utf-8'));
const existing = vercel.redirects ?? [];
const fresh = redirects.filter((r) => !existing.some((e) => e.source === r.source));
vercel.redirects = [...existing, ...fresh];

if (!DRY_RUN) await writeFile(vercelPath, JSON.stringify(vercel, null, 2) + '\n', 'utf-8');

console.log(
  `\nСтатей: ${articles.length}. Нових редіректів: ${fresh.length}.` +
    (DRY_RUN ? ' (dry-run, нічого не змінено)' : '')
);