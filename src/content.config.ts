import { defineCollection, z } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';

/*
 * Articles are edited in the admin panel, which writes them to the Supabase
 * `posts` table, so that is what the build reads: published articles only, so
 * a draft stays off the site until someone presses Save and publish.
 *
 * The markdown files in src/content/blog are the fallback, used only when the
 * build cannot reach Supabase, so a network blip never empties the blog. They
 * are a snapshot, not the source of truth: an edit made there alone is
 * overwritten by the database on the next build.
 */
const markdown = glob({ pattern: '**/*.md', base: './src/content/blog' });

const URL = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const KEY = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

type PostRow = {
  slug: string; title: string; excerpt: string | null; body: string | null;
  image: string | null; image_alt: string | null; topic: string | null;
  author: string | null; read_mins: number | null; featured: boolean | null;
  published_at: string | null; updated_at: string | null;
};

const posts: Loader = {
  name: 'supabase-posts',
  async load(ctx) {
    let rows: PostRow[] | null = null;
    if (URL && KEY) {
      try {
        const res = await fetch(
          `${URL}/rest/v1/posts?select=*&published=eq.true&order=published_at.desc`,
          { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
        if (res.ok) rows = (await res.json()) as PostRow[];
        else ctx.logger.warn(`Supabase answered ${res.status}; using the markdown files`);
      } catch (err) {
        ctx.logger.warn(`could not reach Supabase (${err}); using the markdown files`);
      }
    }
    if (!Array.isArray(rows)) return markdown.load(ctx);

    ctx.store.clear();
    for (const r of rows) {
      const data = await ctx.parseData({
        id: r.slug,
        data: {
          title: r.title,
          excerpt: r.excerpt ?? '',
          image: r.image || 'post-standards',
          imageAlt: r.image_alt || r.title,
          topic: r.topic || 'General',
          author: r.author || 'SB Fall Protection',
          date: r.published_at || r.updated_at || new Date().toISOString(),
          readMins: r.read_mins || 5,
          featured: Boolean(r.featured),
        },
      });
      const body = r.body ?? '';
      ctx.store.set({
        id: r.slug,
        data,
        body,
        rendered: await ctx.renderMarkdown(body),
        digest: ctx.generateDigest({ ...r }),
      });
    }
    ctx.logger.info(`${rows.length} published articles from Supabase`);
  },
};

const blog = defineCollection({
  loader: posts,
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
