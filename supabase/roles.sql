-- SB Fall Protection — staff roles
--
-- Run once in the Supabase SQL editor. Two jobs:
--
--   1. A `staff` roster with a role per person, so the admin panel can list
--      who has access without needing the service_role key in the browser.
--   2. Tighten every catalogue write policy so it requires membership of that
--      roster. Until now any authenticated user could write, which meant a
--      single unwanted sign-up would have had full edit rights.
--
-- Roles:
--   super_admin  full access, and may add or remove staff accounts
--   admin        full content access, may not manage accounts

-- ─────────────────────────────── roster ───────────────────────────────

create table if not exists staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'admin' check (role in ('super_admin', 'admin')),
  created_at  timestamptz default now()
);

alter table staff enable row level security;

-- Any signed-in staff member may read the roster: the panel shows it, and
-- knowing your colleagues' roles is not sensitive.
drop policy if exists staff_read on staff;
create policy staff_read on staff
  for select to authenticated using (true);

-- Deliberately no insert/update/delete policy. RLS denies by default, so the
-- roster can only be changed by the service_role key — that is, only through
-- the panel's /api/users endpoint, which checks for super_admin first.

-- ──────────────────────── seed the first super admin ────────────────────────
-- Everyone who can already sign in becomes staff, and the account below is
-- promoted to super_admin so there is someone able to manage the rest.

insert into staff (user_id, email, role)
select id, email, 'admin' from auth.users
on conflict (user_id) do nothing;

update staff set role = 'super_admin'
where email = 'sbfallprotection@gmail.com';

-- ─────────────────────── who counts as staff, for RLS ───────────────────────
-- security definer so the check can read `staff` regardless of the caller's
-- own policies; stable so Postgres may cache it within a statement.

create or replace function is_staff() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from staff where user_id = auth.uid())
$$;

-- ─────────────────── replace the blanket write policies ───────────────────
-- Same tables as schema.sql, but membership of `staff` is now required
-- instead of merely holding any authenticated session.

do $$
declare t text;
begin
  foreach t in array array['categories','families','products','product_images',
                           'pages','instagram_posts','posts','settings']
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('drop policy if exists %I on %I;', t || '_staff_write', t);
      execute format(
        'create policy %I on %I for all to authenticated using (is_staff()) with check (is_staff());',
        t || '_staff_write', t);
    end if;
  end loop;
end $$;

-- enquiries keep their own pair: anyone may submit, staff may read and update
drop policy if exists inquiries_staff_read on inquiries;
create policy inquiries_staff_read on inquiries
  for select to authenticated using (is_staff());

drop policy if exists inquiries_staff_update on inquiries;
create policy inquiries_staff_update on inquiries
  for update to authenticated using (is_staff()) with check (is_staff());

-- ─────────────────────────────── check ───────────────────────────────
-- select email, role from staff order by role, email;
