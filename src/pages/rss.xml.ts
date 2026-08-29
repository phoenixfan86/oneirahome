import rss from '@astrojs/rss';
import { getCollection, type CollectionEntry } from 'astro:content';

// Допоміжна функція для визначення MIME-типу
function getMimeType(url: string): string {
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.webp')) return 'image/webp';
  if (url.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

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
  
    xmlns: {
      media: 'http://search.yahoo.com/mrss/',
    },
    items: sorted.map((entry: CollectionEntry<'dreams'>) => {
      const rawImg = entry.data.img ?? '/img/og-default.jpg';
      const imageUrl = new URL(rawImg, context.site).href;
      const mimeType = getMimeType(imageUrl);

      return {
        title: entry.data.title,
        description: entry.data.description,
        pubDate: entry.data.pubDate,
        link: `/dream/${entry.slug}/`,
        
        customData: `
          <enclosure url="${imageUrl}" type="${mimeType}" length="102400" />
          <media:content url="${imageUrl}" medium="image" type="${mimeType}" />
        `.trim(),
      };
    }),
  });
}