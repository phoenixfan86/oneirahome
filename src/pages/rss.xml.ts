import rss from '@astrojs/rss';
import { getCollection, type CollectionEntry } from 'astro:content';

export async function GET(context: { site: URL }) {
  const dreams = await getCollection(
    'dreams',
    ({ data }: CollectionEntry<'dreams'>) => !data.draft
  );

  const sorted = dreams.sort(
    (a: CollectionEntry<'dreams'>, b: CollectionEntry<'dreams'>) =>
      b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: 'Oneirahome - Dream Dictionary',
    description: 'Latest dream meanings and interpretations.',
    site: context.site,
    items: sorted.map((entry: CollectionEntry<'dreams'>) => {
      // Falls back to the default OG image if this article has none yet.
      const imageUrl = new URL(entry.data.img ?? '/img/og-default.jpg', context.site).href;

      return {
        title: entry.data.title,
        description: entry.data.description,
        pubDate: entry.data.pubDate,
        link: `/dream/${entry.slug}/`,
        // Pinterest's "bulk create Pins from RSS" feature reads this
        // <enclosure> tag to know which image to use for the auto-created
        // Pin - it's the standard RSS 2.0 way to attach media to an item.
        customData: `<enclosure url="${imageUrl}" type="image/jpeg" length="0" />`,
      };
    }),
  });
}
