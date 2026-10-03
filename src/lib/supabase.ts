/**
 * Build-time Supabase reader.
 *
 * The site is statically generated, so this runs during `astro build`, never in
 * the browser — it uses the anon key against public-read RLS policies.
 *
 * If the env vars are absent (or Supabase is unreachable) the catalogue falls
 * back to the committed JSON snapshot, so a build can never fail because of a
 * network blip or a missing key.
 */
const URL = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const KEY = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = Boolean(URL && KEY);

/*
 * Every setting the site shows (contact details, About, FAQs, menu, logo,
 * social links) comes back in one request per build. The database is in
 * Sydney and the build machine usually is not, so six separate round trips
 * were a few seconds of every publish.
 */
const PUBLIC_SETTINGS = ['social_links', 'contact', 'about', 'faqs', 'menu', 'brand'];
let settingsCache: Promise<Map<string, unknown>> | null = null;

export async function setting<T>(key: string): Promise<T | null> {
  settingsCache ??= (async () => {
    const rows = await rest<{ key: string; value: string }>(
      `settings?select=key,value&key=in.(${PUBLIC_SETTINGS.join(',')})`);
    const out = new Map<string, unknown>();
    for (const r of rows ?? []) {
      try { out.set(r.key, JSON.parse(r.value)); } catch { /* a bad value falls back to the default */ }
    }
    return out;
  })();
  return ((await settingsCache).get(key) as T | undefined) ?? null;
}

async function rest<T>(path: string): Promise<T[] | null> {
  if (!supabaseConfigured) return null;
  try {
    const res = await fetch(`${URL}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) {
      console.warn(`[supabase] ${path} -> ${res.status}; using JSON snapshot`);
      return null;
    }
    return (await res.json()) as T[];
  } catch (err) {
    console.warn(`[supabase] ${path} failed (${err}); using JSON snapshot`);
    return null;
  }
}

export interface DbCategory {
  slug: string; name: string; intro: string | null;
  blurb: string | null; icon: string | null; image: string | null; sort_order: number;
}
export interface DbFamily {
  slug: string; name: string; category: string; intro: string | null;
  bullets: string[] | null; layout: 'spec' | 'variant' | 'table'; sort_order: number;
}
export interface DbProduct {
  sku: string; category: string; family: string | null;
  specs: Record<string, string> | null; attachment: string | null;
  image: string | null; published: boolean; sort_order: number;
}

/** Pulls the whole catalogue in three requests, or null if unavailable. */
export async function fetchCatalog() {
  if (!supabaseConfigured) return null;

  setting('contact'); // warm the settings in parallel with the catalogue
  const [categories, families, products] = await Promise.all([
    rest<DbCategory>('categories?select=*&order=sort_order'),
    rest<DbFamily>('families?select=*&order=sort_order'),
    rest<DbProduct>('products?select=*&published=eq.true&order=sort_order&limit=2000'),
  ]);

  if (!categories || !families || !products) return null;
  if (categories.length === 0 || products.length === 0) {
    console.warn('[supabase] catalogue tables are empty; using JSON snapshot');
    return null;
  }

  console.log(
    `[supabase] loaded ${categories.length} categories, ` +
    `${families.length} families, ${products.length} products`,
  );
  return { categories, families, products };
}

export interface SocialLink { platform: string; url: string }

/** The links shown in the footer. Staff edit them under Social links in the panel. */
export const DEFAULT_SOCIAL: SocialLink[] = [
  { platform: 'facebook', url: 'https://www.facebook.com/sbfallprotection' },
  { platform: 'instagram', url: 'https://www.instagram.com/sbfallprotection/' },
  { platform: 'linkedin', url: 'https://www.linkedin.com/company/sb-leathers-pvt-ltd/' },
  { platform: 'youtube', url: 'https://www.youtube.com/channel/UCUAbt8J6R7xN4kCow3r2L_g' },
];

let socialCache: Promise<SocialLink[]> | null = null;
/** Read once per build, since every page's footer asks for them. */
export function fetchSocialLinks(): Promise<SocialLink[]> {
  socialCache ??= (async () => {
    const list = await setting<SocialLink[]>('social_links');
    try {
      if (Array.isArray(list)) {
        return list.filter((l) => l && typeof l.url === 'string' && /^https?:\/\//.test(l.url));
      }
    } catch { /* fall through */ }
    return DEFAULT_SOCIAL;
  })();
  return socialCache;
}

export interface DbReel {
  id: string;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  caption: string | null;
  posted_at: string | null;
}

/**
 * Reels shown on the home page. Managed from the admin panel; when the table is
 * empty the caller falls back to the clips committed in /assets, so the section
 * is never blank.
 */
export async function fetchReels(): Promise<DbReel[]> {
  const rows = await rest<DbReel>('instagram_posts?select=*&order=posted_at.desc&limit=12');
  return rows ?? [];
}

/**
 * The path browsers use to reach Supabase: the site's own domain, proxied to
 * the project by a rewrite on the host (vercel.json, netlify.toml).
 *
 * Several Indian ISPs block supabase.co outright. ACT Fibernet, for one,
 * answers DNS for it with its own block server, even for lookups sent to
 * 1.1.1.1, so a browser there cannot reach the project at all and the admin
 * sign-in reports "Failed to fetch". Going through our own domain means the
 * browser never touches supabase.co. Build-time reads and the /api functions
 * run on the host's servers, which are not blocked, and keep the real URL.
 */
export const SB_BROWSER_PATH = '/sb';
