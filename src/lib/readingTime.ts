
export function getReadingTime(text: string, wordsPerMinute = 205): string {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / wordsPerMinute));
  return `${minutes} min read`;
}