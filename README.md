# Dream Dictionary

Astro + Markdown dream-interpretation site, content generated with the free
Gemini API and reviewed before publishing.

## How it works

1. **`scripts/topics.json`** — your queue of dream symbols to write about.
   Add more over time (pull ideas from Google autocomplete / Google Trends
   for "dream about ___" — free, and you're only taking keyword ideas, not
   copyrighted text).
2. **`scripts/generate-dreams.mjs`** — reads the queue, calls the free
   Gemini API for each symbol that doesn't have a file yet, and writes a
   Markdown file to `src/content/dreams/` with `draft: true, edited: false`.
3. **`scripts/edit-dreams.mjs`** — the automated post-editing pass. For
   every article with `edited: false`, it:
   - sends the draft to Gemini for proofreading/polishing (fixes grammar
     and repetitive phrasing, doesn't add new claims),
   - asks the same call for 3-5 tags, so `/tags/` fills itself in instead
     of you typing tags by hand,
   - runs automated quality checks (word count range, heading structure,
     clichéd AI phrasing, keyword-stuffing risk) and records any hits in
     `qcIssues`.
   Articles with `qcIssues` are always left as `draft: true` no matter
   what — those need a human read. Run with `--auto-publish` and it will
   additionally flip clean articles (zero issues) straight to
   `draft: false` for you; anything flagged still waits for you.
4. **You do a final skim** — even auto-published articles are worth a
   quick read early on, until you trust the pipeline's output quality.
   `draft: false` is what actually makes a page live.
5. **Astro builds** only the `draft: false` entries into static pages.

This two-pass structure (generate → edit) exists because a single model
call rarely self-critiques its own text well — a separate editing pass
with fresh context catches more repetition and awkward phrasing than
asking the same call to "write and check itself" in one go.

## Local setup

```bash
npm install
cp .env.example .env
# put your free API key (from https://aistudio.google.com/apikey) into .env

npm run dev          # preview at http://localhost:4321
```

## Generating and editing new articles

Both scripts now **group multiple topics into a single API request** —
this is the key lever for a tight daily request quota, since the request
count (RPD), not the output length, is usually what free tiers restrict
most. A response comfortably fits several 500-700 word articles.

```bash
# Step 1: generate new drafts (GROUP_SIZE=3 topics/request, REQUESTS_PER_RUN=3
# requests -> up to 9 articles for only 3 requests)
node --env-file=.env scripts/generate-dreams.mjs

# Step 2: edit + tag + QC drafts (same grouping logic)
node --env-file=.env scripts/edit-dreams.mjs

# Optional: auto-publish anything that comes back clean
node --env-file=.env scripts/edit-dreams.mjs --auto-publish

# Optional: Generate Roundups
node scripts/generate-roundups.mjs
```

Both `GROUP_SIZE` and `REQUESTS_PER_RUN` are constants at the top of each
script — adjust them to fit your actual daily quota. Rough math: your
daily request budget is shared between **both** scripts (same API key),
so with a 20 requests/day limit, running generate 3x + edit 3x uses 6 of
your 20 requests and produces ~9-18 articles depending on how much of the
pipeline you run. Leave headroom rather than spending the full 20 in one
sitting — 429 errors mid-run just waste the topics already grouped into
that request.

`generate-dreams.mjs` groups topics **by category** (so a request might
be 3 "animals" topics together, matching how you'd naturally batch them).
`edit-dreams.mjs` groups whatever's pending in file order. Both scripts
are idempotent — safe to re-run repeatedly, they skip anything already
processed.

Free-tier limits change over time and vary by account — check your live
numbers at Google AI Studio → Rate Limits before assuming a specific
number, and adjust `DELAY_MS` / `GROUP_SIZE` / `REQUESTS_PER_RUN` if you
hit 429 (rate limit) errors or responses get cut off (raise `DELAY_MS` for
429s on requests/minute; lower `GROUP_SIZE` if output looks truncated).

## Adding more topics

Edit `scripts/topics.json` and add entries like:

```json
{ "symbol": "losing a wallet", "category": "objects" }
```

Valid `category` values are defined in `src/content/config.ts`:
`animals, people, places, objects, emotions, body, nature, events, other`.

## Deploying (free)

1. Push this project to a new GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, "Import
   Project", select the repo. Vercel auto-detects Astro — no config needed.
3. Every push to `main` auto-deploys. Your workflow becomes:
   generate locally → review drafts → flip `draft: false` → commit & push
   → Vercel deploys automatically.

## Fixing empty tags

If any articles ended up with `tags: []` — either because they haven't
been through `edit-dreams.mjs` yet, or because Gemini didn't return tags
that one time and it went unnoticed — run:

```bash
node --env-file=.env scripts/fill-tags.mjs
```

It only touches the `tags:` line, groups more items per request than the
other scripts (tag suggestions are a small, cheap ask), and skips
anything that already has tags — safe to re-run.

Going forward, `edit-dreams.mjs` now flags missing tags as a `qcIssue`
(instead of silently writing an empty array), so a run that skips tags
will keep that article as `draft: true` for review rather than let it
publish untagged.

## Sidebar, categories, and search

- **`src/components/Sidebar.astro`** fetches category counts at build time
  and renders them as links to `/categories/<category>/` (paginated, same
  pattern as `/tags/<tag>/`). It's included once, in `BaseLayout.astro`, so
  every page gets it automatically — you never add it per-page.
- **Search** uses [Pagefind](https://pagefind.app), a free static search
  library made for exactly this kind of site (no backend, no paid API).
  `npm run build` now runs `astro build && pagefind --site dist`, which
  scans the built HTML and writes a search index into `dist/pagefind/`.
  The sidebar loads `/pagefind/pagefind-ui.js` and mounts the search box
  into `#search`.
  - **This only works after a real build.** In `astro dev` the sidebar's
    search box will be empty and you'll see 404s for `/pagefind/*` in the
    console — that's expected, not a bug. To test search locally:
    ```bash
    npm run build
    npm run preview
    ```
  - `data-pagefind-body` on `<main>` in `BaseLayout.astro` tells Pagefind
    to index only article content, not the header/sidebar/footer.
    `data-pagefind-ignore` on `<aside>` reinforces that for the sidebar
    specifically.
  - On Vercel, `npm run build` is the default build command, so Pagefind's
    index gets generated and deployed automatically — no extra config.

## Next steps once this is working

- Add a sitemap (`@astrojs/sitemap` integration) once you have `site` set
  correctly in `astro.config.mjs` — helps Google discover new pages fast.
- Add category pages (`/dreams/category/animals/` etc.) once you have
  enough entries per category.
- Add a Ukrainian version by duplicating the content collection (e.g.
  `src/content/dreams-ua/`) and reusing the same generation script with a
  Ukrainian-language prompt.
- Run a quick uniqueness check (e.g. Originality.ai's limited free
  checker) on drafts before publishing, especially once you're generating
  in bulk.
