-- ==========================================
-- FatSecret Barcode Resolution (Compliant Storage)
-- - Durable storage: food_id / serving_id mapping by barcode
-- - Ephemeral storage: nutrition payload cache capped at 24 hours
-- ==========================================

create table if not exists fatsecret_barcode_map (
  barcode text primary key,
  source text not null default 'fatsecret',
  food_id text not null,
  serving_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (barcode ~ '^[0-9]{13,14}$')
);

create index if not exists idx_fatsecret_barcode_map_food_id
  on fatsecret_barcode_map(food_id);

drop trigger if exists update_fatsecret_barcode_map_updated_at on fatsecret_barcode_map;
create trigger update_fatsecret_barcode_map_updated_at
  before update on fatsecret_barcode_map
  for each row execute function update_updated_at();

create table if not exists fatsecret_food_cache (
  food_id text primary key,
  serving_id text,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at >= fetched_at),
  check (expires_at <= fetched_at + interval '24 hours')
);

create index if not exists idx_fatsecret_food_cache_expires_at
  on fatsecret_food_cache(expires_at);

drop trigger if exists update_fatsecret_food_cache_updated_at on fatsecret_food_cache;
create trigger update_fatsecret_food_cache_updated_at
  before update on fatsecret_food_cache
  for each row execute function update_updated_at();

alter table fatsecret_barcode_map enable row level security;
alter table fatsecret_food_cache enable row level security;

drop policy if exists "Authenticated users read barcode map" on fatsecret_barcode_map;
create policy "Authenticated users read barcode map"
  on fatsecret_barcode_map for select
  to authenticated
  using (true);

drop policy if exists "Coach manages barcode map" on fatsecret_barcode_map;
create policy "Coach manages barcode map"
  on fatsecret_barcode_map for all
  to authenticated
  using (
    exists (
      select 1
      from coach_profiles cp
      where cp.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from coach_profiles cp
      where cp.id = auth.uid()
    )
  );

drop policy if exists "Service role manages food cache" on fatsecret_food_cache;
create policy "Service role manages food cache"
  on fatsecret_food_cache for all
  to service_role
  using (true)
  with check (true);

create or replace function purge_expired_fatsecret_food_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from fatsecret_food_cache
  where expires_at <= now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
