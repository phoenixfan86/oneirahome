
export function pickRandom<T extends { slug: string }>(
  all: T[],
  count: number,
  excludeSlug?: string
): T[] {
  const pool = excludeSlug ? all.filter((item) => item.slug !== excludeSlug) : [...all];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, Math.min(count, pool.length));
}
