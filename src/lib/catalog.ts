/**
 * Catalogue data access layer.
 *
 * Today this reads the committed JSON snapshot scraped from the live site.
 * When the Supabase project exists, only the four loaders at the bottom change
 * (JSON reads -> `supabase.from(...)` queries); every page template keeps
 * working untouched because it only ever talks to these functions.
 */
import raw from '../data/catalog.json';
import { fetchCatalog } from './supabase';

export interface Category {
  slug: string;
  name: string;
  intro: string;
  families: string[];
  blurb?: string;
  icon?: string;
}

export interface Family {
  slug: string;
  name: string;
  category: string;
  intro: string;
  bullets: string[];
  layout: 'spec' | 'variant';
  source_url: string;
}

export interface Product {
  sku: string;
  category: string;
  family: string;
  family_name: string;
  image: string | null;
  specs: Record<string, string>;
  attachment: string | null;
}

type Snapshot = {
  categories: Category[];
  families: Family[];
  products: Product[];
};

const snapshot = raw as unknown as Snapshot;

/**
 * Resolved once per build. Supabase is the source of truth when configured;
 * the committed JSON snapshot is the fallback so builds never break on a
 * missing key or a network blip.
 */
const data: Snapshot = await (async (): Promise<Snapshot> => {
  const live = await fetchCatalog();
  if (!live) return snapshot;

  const famName = new Map(live.families.map((f) => [f.slug, f.name]));
  return {
    categories: live.categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      intro: c.intro ?? '',
      families: live.families.filter((f) => f.category === c.slug).map((f) => f.slug),
      blurb: c.blurb ?? undefined,
      icon: c.icon ?? undefined,
    })) as Category[],
    families: live.families.map((f) => ({
      slug: f.slug,
      name: f.name,
      category: f.category,
      intro: f.intro ?? '',
      bullets: f.bullets ?? [],
      layout: f.layout,
      source_url: '',
    })),
    products: live.products.map((p) => ({
      sku: p.sku,
      category: p.category,
      family: p.family ?? '',
      family_name: famName.get(p.family ?? '') ?? '',
      image: p.image,
      specs: p.specs ?? {},
      attachment: p.attachment,
    })),
  };
})();

/** Short marketing blurbs + icon keys per category (editorial, not scraped). */
const CATEGORY_META: Record<string, { blurb: string; icon: string }> = {
  harnesses: {
    blurb: 'Full body, sit and rescue harnesses in EN, ANSI and Indian standard builds.',
    icon: 'harness',
  },
  lanyards: {
    blurb: 'Webbing and rope lanyards with energy absorbers that cap arrest forces.',
    icon: 'lanyard',
  },
  'work-positioning': {
    blurb: 'Belts and positioning systems that hold a worker steady at the work face.',
    icon: 'positioning',
  },
  'hooks-connectors': {
    blurb: 'Forged snap hooks, scaffold hooks and karabiners — load-rated and gate-tested.',
    icon: 'hook',
  },
  anchorages: {
    blurb: 'Fixed and temporary anchor points that give every system a certified hold.',
    icon: 'anchor',
  },
  'horizontal-lifeline': {
    blurb: 'Temporary horizontal lifelines for spans where workers move laterally.',
    icon: 'lifeline',
  },
  'retractable-blocks': {
    blurb: 'Self-retracting lifelines that pay out, retract and lock on a fall.',
    icon: 'srl',
  },
  'material-handling': {
    blurb: 'Tool bags, buckets and hoisting gear for moving kit safely at height.',
    icon: 'material',
  },
  'rope-access-rescue': {
    blurb: 'Descenders, rescue kits and confined-space equipment for controlled recovery.',
    icon: 'rescue',
  },
  'safety-garments': {
    blurb: 'Hi-vis workwear plus head, eye, ear, face and hand protection.',
    icon: 'garment',
  },
};

export function getCategories(): (Category & { blurb: string; icon: string; count: number })[] {
  return data.categories.map((c) => ({
    ...c,
    blurb: (c as any).blurb || CATEGORY_META[c.slug]?.blurb || c.intro,
    icon: (c as any).icon || CATEGORY_META[c.slug]?.icon || 'harness',
    count: data.products.filter((p) => p.category === c.slug).length,
  }));
}

export function getCategory(slug: string) {
  const cat = data.categories.find((c) => c.slug === slug);
  if (!cat) return null;
  return {
    ...cat,
    blurb: (cat as any).blurb || CATEGORY_META[slug]?.blurb || cat.intro,
    icon: (cat as any).icon || CATEGORY_META[slug]?.icon || 'harness',
  };
}

export function getFamilies(categorySlug: string): Family[] {
  return data.families.filter((f) => f.category === categorySlug);
}

export function getProducts(categorySlug?: string, familySlug?: string): Product[] {
  return data.products.filter(
    (p) =>
      (!categorySlug || p.category === categorySlug) &&
      (!familySlug || p.family === familySlug),
  );
}

export function getProduct(categorySlug: string, sku: string): Product | null {
  const want = sku.toLowerCase();
  return (
    data.products.find(
      (p) => p.category === categorySlug && p.sku.toLowerCase() === want,
    ) ?? null
  );
}

export function getFamily(slug: string): Family | null {
  return data.families.find((f) => f.slug === slug) ?? null;
}

/** Every product, for building static routes. */
export function allProducts(): Product[] {
  return data.products;
}

/** SKU -> URL. Kept in one place so the route shape can change safely. */
export function productUrl(p: Product): string {
  return `/products/${p.category}/${p.sku.toLowerCase()}`;
}

export function categoryUrl(slug: string): string {
  return `/products/${slug}`;
}

/**
 * Remote product photos still live on the client's WordPress host. Rewriting
 * them here means the migration to Cloudinary/Supabase Storage is a one-line
 * change rather than a data edit.
 */
export function imageUrl(src: string | null): string {
  if (!src) return '/assets/prod-harness.jpg';
  return src;
}
