import { defineCollection, z } from 'astro:content';

const dreams = defineCollection({
  type: 'content',
  schema: z.object({
    // Human-readable title, e.g. "Dream About Snakes: Meaning & Interpretation"
    title: z.string(),
    // The core symbol, e.g. "snake" — used for related-dreams linking
    symbol: z.string(),
    // Short meta description for SEO (150-160 chars ideal)
    description: z.string(),
    // Broad grouping so you can build category pages later
    category: z.enum([
      'animals',
      'people',
      'places',
      'objects',
      'emotions',
      'body',
      'nature',
      'events',
      'other',
    ]),
    tags: z.array(z.string()).default([]),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    // AI-generated drafts land with draft: true. Nothing with draft: true
    // gets listed or built into a public page until a human flips it to
    // false after a quick read-through. This is your "light post-editing"
    // gate.
    draft: z.boolean().default(true),
    // Which model/pass generated this, useful when you're mixing sources later
    source: z.string().default('gemini-3.6-flash'),
    // Has this article been through the automated editing pass yet?
    edited: z.boolean().default(false),
    // Automated QC findings from the edit pass (empty array = clean).
    // Non-empty means: read this one before publishing, something looked off.
    qcIssues: z.array(z.string()).default([]),
  }),
});

export const collections = { dreams };
