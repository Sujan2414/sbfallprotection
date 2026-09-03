/**
 * Seeds Supabase from the committed catalogue snapshot.
 *
 *   1. create the Supabase project
 *   2. run supabase/schema.sql in the SQL editor
 *   3. SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node supabase/seed.mjs
 *
 * Uses the service-role key, so run it locally only — never in the browser
 * and never commit the key.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(here, '..', 'src', 'data', 'catalog.json'), 'utf8'),
);

async function upsert(table, rows, onConflict) {
  if (rows.length === 0) return;
  const res = await fetch(
    `${url}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  console.log(`  ${table.padEnd(16)} ${rows.length} rows`);
}

const categories = catalog.categories.map((c, i) => ({
  slug: c.slug, name: c.name, intro: c.intro ?? '', sort_order: i,
}));

const families = catalog.families.map((f, i) => ({
  slug: f.slug, name: f.name, category: f.category, intro: f.intro ?? '',
  bullets: f.bullets ?? [], layout: f.layout ?? 'spec',
  source_url: f.source_url ?? null, sort_order: i,
}));

const products = catalog.products.map((p, i) => ({
  sku: p.sku, category: p.category, family: p.family,
  specs: p.specs ?? {}, attachment: p.attachment ?? null,
  image: p.image ?? null, sort_order: i,
}));

console.log('seeding…');
await upsert('categories', categories, 'slug');
await upsert('families', families, 'slug');
await upsert('products', products, 'sku,family');
console.log('done.');
