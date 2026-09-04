-- SB Fall Protection — Supabase schema
--
-- Run this once in the Supabase SQL editor after the project is created.
-- It mirrors the shape of src/data/catalog.json, so src/lib/catalog.ts can
-- switch from the JSON snapshot to these tables without page templates changing.
--
-- Read access is public (the site is pre-rendered at build time and the data is
-- a public product catalogue). Writes are restricted to authenticated staff.

-- ─────────────────────────────── catalogue ───────────────────────────────

create table if not exists categories (
  slug        text primary key,
  name        text not null,
  intro       text default '',
  blurb       text default '',
  icon        text default 'harness',
  sort_order  int  default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists families (
  slug        text primary key,
  name        text not null,
  category    text not null references categories(slug) on delete cascade,
  intro       text default '',
  bullets     jsonb default '[]'::jsonb,   -- shared spec notes shown above the SKU grid
  layout      text default 'spec' check (layout in ('spec', 'variant')),
  source_url  text,
  sort_order  int  default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null,
  category    text not null references categories(slug) on delete cascade,
  family      text references families(slug) on delete set null,
  -- spec fields vary per category, so they live in JSONB rather than columns
  specs       jsonb default '{}'::jsonb,
  attachment  text,                        -- connector config, for variant ranges
  image       text,                        -- primary image URL
  published   boolean default true,
  sort_order  int  default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (sku, family)
);

create index if not exists products_category_idx on products (category);
create index if not exists products_family_idx   on products (family);
create index if not exists products_sku_idx      on products (lower(sku));

create table if not exists product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  url         text not null,
  alt         text default '',
  sort_order  int  default 0
);

-- ─────────────────────────── enquiries (form inbox) ───────────────────────

create table if not exists inquiries (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  company     text,
  email       text,
  phone       text,
  country     text,
  category    text,
  message     text,
  sku         text,                        -- set when sent from a product page
  source_page text,
  status      text default 'new' check (status in ('new', 'in_progress', 'quoted', 'closed')),
  created_at  timestamptz default now()
);

create index if not exists inquiries_status_idx on inquiries (status, created_at desc);

-- ───────────────────────── editable page copy ─────────────────────────────

create table if not exists pages (
  slug        text primary key,            -- 'about', 'contact', 'home'
  content     jsonb default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- ─────────────────── instagram cache (feed / reels strip) ─────────────────

create table if not exists instagram_posts (
  id           text primary key,           -- Instagram media id
  media_type   text,                       -- IMAGE | VIDEO | CAROUSEL_ALBUM
  media_url    text,
  thumbnail_url text,
  permalink    text,
  caption      text,
  posted_at    timestamptz,
  fetched_at   timestamptz default now()
);

-- ───────────────────────────── row level security ─────────────────────────

alter table categories      enable row level security;
alter table families        enable row level security;
alter table products        enable row level security;
alter table product_images  enable row level security;
alter table pages           enable row level security;
alter table instagram_posts enable row level security;
alter table inquiries       enable row level security;

-- public catalogue: anyone may read
do $$
declare t text;
begin
  foreach t in array array['categories','families','products','product_images','pages','instagram_posts']
  loop
    execute format(
      'create policy %I on %I for select using (true);',
      t || '_public_read', t);
  end loop;
end $$;

-- staff may change the catalogue
do $$
declare t text;
begin
  foreach t in array array['categories','families','products','product_images','pages','instagram_posts']
  loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_staff_write', t);
  end loop;
end $$;

-- enquiries: anyone may submit, only staff may read
create policy inquiries_public_insert on inquiries
  for insert with check (true);
create policy inquiries_staff_read on inquiries
  for select to authenticated using (true);
create policy inquiries_staff_update on inquiries
  for update to authenticated using (true) with check (true);

-- ───────────────────────────── updated_at triggers ────────────────────────

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories','families','products','pages']
  loop
    execute format(
      'create trigger %I before update on %I for each row execute function touch_updated_at();',
      t || '_touch', t);
  end loop;
end $$;

-- ─────────────────────────── blog posts ───────────────────────────────────
-- Mirrors src/content/blog/*.md so posts can move into the CMS later.

create table if not exists posts (
  slug        text primary key,
  title       text not null,
  excerpt     text default '',
  body        text default '',        -- markdown
  image       text,                   -- asset slug: hero-<image>/blog-<image>
  image_alt   text default '',
  topic       text,
  author      text default 'SB Fall Protection',
  read_mins   int  default 5,
  featured    boolean default false,
  published   boolean default true,
  published_at timestamptz default now(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists posts_published_idx on posts (published, published_at desc);

alter table posts enable row level security;
create policy posts_public_read on posts
  for select using (published = true);
create policy posts_staff_write on posts
  for all to authenticated using (true) with check (true);
create trigger posts_touch before update on posts
  for each row execute function touch_updated_at();
