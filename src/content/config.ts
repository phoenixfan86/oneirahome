import { defineCollection, z } from 'astro:content';

const dreams = defineCollection({
  type: 'content',
  schema: z.object({
    // Human-readable title, e.g. "Dream About Snakes: Meaning & Interpretation"
    title: z.string(),
    // The core symbol, e.g. "snake" - used for related-dreams linking
    symbol: z.string(),
    // Short meta description for SEO (150-160 chars ideal)
    description: z.string(),
    // Dreams image
    img: z.string().optional(),
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

// Longer-form evergreen guides - lucid dreaming, sleep paralysis,
// recurring dreams, etc. Unlike `dreams`, these aren't tied to a single
// symbol, so there's no `symbol` field, and no per-entry `category` enum
// (the whole collection IS one topical cluster: sleep & the subconscious).
const guides = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    img: z.string().optional(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    draft: z.boolean().default(true),
    source: z.string().default('gemini-3.6-flash'),
    edited: z.boolean().default(false),
    qcIssues: z.array(z.string()).default([]),
  }),
});
const roundups = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    period: z.string(), // напр. "September 2026" — для показу людині
    dreamSlugs: z.array(z.string()), // 5 slug-ів статей, що входять у добірку
    pubDate: z.coerce.date(),
  }),
});

export const collections = { dreams, guides, roundups };
