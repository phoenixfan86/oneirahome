import type { CollectionEntry } from 'astro:content';

type SchemaEntry = { slug: string; data: { title: string } };

// Builds a CollectionPage + ItemList schema for any paginated listing -
// dream articles, guides, or anything else with a slug + title. Google
// uses this to understand the page is a list of items, not a single piece
// of content - helps with sitelinks and how the page gets categorized.
export function buildListSchema({
  name,
  description,
  url,
  site,
  entries,
  basePath = '/dream/',
}: {
  name: string;
  description: string;
  url: string;
  site: URL | undefined;
  entries: SchemaEntry[];
  // e.g. '/dream/' for dreams, '/guides/' for guides - matches the
  // collection's actual detail-page URL structure.
  basePath?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: entries.map((entry, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: new URL(`${basePath}${entry.slug}/`, site).href,
        name: entry.data.title,
      })),
    },
  };
}
