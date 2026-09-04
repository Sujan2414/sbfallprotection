import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    /** asset slug: /assets/hero-<image>.jpg and /assets/blog-<image>.jpg */
    image: z.string(),
    imageAlt: z.string(),
    topic: z.string(),
    author: z.string().default('SB Fall Protection'),
    date: z.coerce.date(),
    readMins: z.number(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { blog };
