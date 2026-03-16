-- Allow FatSecret UK rows in ingredient_catalog source check.
-- Safe to run repeatedly.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ingredient_catalog'
      and column_name = 'source'
  ) then
    alter table ingredient_catalog
      drop constraint if exists ingredient_catalog_source_check;

    alter table ingredient_catalog
      add constraint ingredient_catalog_source_check
      check (source in ('usda_survey', 'mccance_widdowson', 'open_food_facts', 'fatsecret_uk'));
  end if;
end $$;

