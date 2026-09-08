// Known named entities worth marking up as schema.org `mentions` when they
// appear in an article's text — links them to their specific Wikipedia
// page (via `sameAs`), which helps both traditional entity-based SEO and
// how AI search engines resolve/cite your content.
export const KNOWN_ENTITIES = [
  {
    name: 'Carl Jung',
    pattern: /\bCarl Jung\b/i,
    sameAs: 'https://en.wikipedia.org/wiki/Carl_Jung',
    type: 'Person',
  },
  {
    name: 'Sigmund Freud',
    pattern: /\bSigmund Freud\b/i,
    sameAs: 'https://en.wikipedia.org/wiki/Sigmund_Freud',
    type: 'Person',
  },
  // Add more as they show up in your content — e.g. REM sleep, other
  // psychologists your articles reference.
];

export function detectMentions(bodyText: string) {
  return KNOWN_ENTITIES.filter((e) => e.pattern.test(bodyText)).map((e) => ({
    '@type': e.type,
    name: e.name,
    sameAs: e.sameAs,
  }));
}