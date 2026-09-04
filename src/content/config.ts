import { defineCollection, z } from 'astro:content';

const dreams = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    symbol: z.string(),
    description: z.string(),
    img: z.string().optional(),
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
    draft: z.boolean().default(true),
    source: z.string().default('gemini-3.6-flash'),
    edited: z.boolean().default(false),
    qcIssues: z.array(z.string()).default([]),
    faq: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      )
      .default([]),
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
