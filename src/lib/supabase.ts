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
  blurb: string | null; icon: string | null; sort_order: number;
}
export interface DbFamily {
  slug: string; name: string; category: string; intro: string | null;
  bullets: string[] | null; layout: 'spec' | 'variant'; sort_order: number;
}
export interface DbProduct {
  sku: string; category: string; family: string | null;
  specs: Record<string, string> | null; attachment: string | null;
  image: string | null; published: boolean; sort_order: number;
}

/** Pulls the whole catalogue in three requests, or null if unavailable. */
export async function fetchCatalog() {
  if (!supabaseConfigured) return null;

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
