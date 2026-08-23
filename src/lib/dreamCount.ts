import { getCollection, type CollectionEntry } from 'astro:content';

export async function getDreamCount(): Promise<number>{
  const allDreams = await getCollection(
  'dreams',
  ({ data }: CollectionEntry<'dreams'>) => !data.draft
);
return allDreams.length;
}