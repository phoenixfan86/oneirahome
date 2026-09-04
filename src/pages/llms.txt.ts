import { getCollection, type CollectionEntry } from 'astro:content';

export async function GET(context: { site: URL }) {
  const dreams = await getCollection(
    'dreams',
    ({ data }: CollectionEntry<'dreams'>) => !data.draft
  );
  const guides = await getCollection(
    'guides',
    ({ data }: CollectionEntry<'guides'>) => !data.draft
  );
  const roundups = await getCollection('roundups');

  const site = context.site.href.replace(/\/$/, '');

  const body = `# Oneira Home - Dream Dictionary

> A free, growing dictionary of dream meanings and interpretations. Each entry covers the general meaning, common scenarios, a psychological perspective, and a reflection prompt for a specific dream symbol.

## Key sections

- [Homepage](${site}/) - latest dream meanings, paginated archive
- [All dream meanings](${site}/dreams/) - ${dreams.length} entries covering animals, people, places, objects, emotions, body, nature, and events
- [Guides](${site}/guides/) - in-depth explainers on lucid dreaming, sleep paralysis, and sleep science (${guides.length} guide${guides.length === 1 ? '' : 's'})
- [Top 5 Roundups](${site}/articles/) - curated picks by category (${roundups.length} roundup${roundups.length === 1 ? '' : 's'})
- [Browse by category](${site}/categories/)
- [Browse by theme/tag](${site}/tags/)
- [Dream Journal](${site}/journal/) - free private dream-logging tool (client-side only, no account needed)

## About

Oneira Home ("oneira" is Greek for "dream") is an independent, editorially-reviewed dream dictionary. Content is drafted with AI assistance and reviewed before publishing; interpretations reflect common psychological and symbolic perspectives, not fixed fact or medical/psychological advice.

## Other resources

- [Sitemap](${site}/sitemap-index.xml) - full list of all pages
- [RSS feed](${site}/rss.xml) - latest dream meanings
- [About](${site}/about/)
- [Support resources](${site}/resources/) - sleep and mental health resources (external, verified organizations)
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}