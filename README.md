# Omega Web (Coach App)

Standalone repository for the Omega coach-facing web app (Next.js + TypeScript + Supabase).

## Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project with the expected schema

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file from the template:

```bash
cp .env.example .env.local
```

3. Fill `.env.local` with valid values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

4. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Quality Checks

```bash
npm run lint
npm run build
```

## FatSecret UK Import (Branded + Supermarket Foods)

1. Apply the source-check SQL (once) in Supabase SQL Editor:

```sql
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ingredient_catalog'
  ) then
    alter table ingredient_catalog
      drop constraint if exists ingredient_catalog_source_check;

    alter table ingredient_catalog
      add constraint ingredient_catalog_source_check
      check (source in ('usda_survey', 'mccance_widdowson', 'open_food_facts', 'fatsecret_uk'));
  end if;
end $$;
```

2. Set env vars (local shell or `.env.local`):

```bash
FATSECRET_CLIENT_ID=...
FATSECRET_CLIENT_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

3. Dry-run first:

```bash
npm run fatsecret:sync-uk -- --dry-run --max-foods=1500 --max-pages-per-query=5 --region=GB --language=en
```

4. Live upsert:

```bash
npm run fatsecret:sync-uk -- --max-foods=1500 --max-pages-per-query=5 --region=GB --language=en
```

Useful options:
- `--supermarket-only` to keep only supermarket-branded rows.
- `--supermarket-targets="asda,tesco,sainsbury's,morrisons,marks & spencer"` to restrict supermarket imports to specific chains.
  - When targets are set, the importer auto-adds common private-label query expansions per chain.
- `--allow-all-supermarkets` to disable target restriction and include all detected supermarket chains.
- `--include-a-to-z` for broader discovery (larger import).
- `--region=GB` (default) or another FatSecret region code.
- `--language=en` for explicit language localization.
- `--oauth-scope="premier localization basic"` to force scope preference order.
- `--no-brand-discovery` to disable `food_brands.get.v2` seed discovery.
- `--brand-seeds-only` to use exact `food_brands.get.v2` names as the only search terms (no manual query seeds).
- `--out-brand-seeds=/tmp/fatsecret_brands.txt` to export the exact brand-name query seeds used.
- `--out-json=/tmp/fatsecret_uk_preview.json` to review rows before writing.

Troubleshooting:
- `FatSecret API error (21): Invalid IP address detected`
  - Add your caller IP/CIDR in FatSecret Platform -> API Keys -> IP Restrictions.
  - For quick test, allow `0.0.0.0/0` and `::/0`, then tighten after validation.
  - FatSecret notes allowlist changes can take up to 24 hours to propagate.
- `FatSecret API error (14)` on UK/GB calls
  - Means localization scope/access is missing for that key.
  - Request localization enablement on your FatSecret app and retry with `--oauth-scope="premier localization basic"`.

## Deployment (Vercel)

1. Import this repo into Vercel.
2. Set framework preset to Next.js.
3. Add all environment variables from `.env.example` in Vercel Project Settings.
4. Deploy from the main branch.

## Source-Of-Truth Workflow

- This repo (`Omega_Web`) is the source of truth for coach web deployments.
- If a web feature is implemented elsewhere first, it must be ported here before redeploying.
- Always verify with:

```bash
git status
npm run build
```

- Deploy only the latest pushed commit on `main`.

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-side only; never expose it to clients.
- Keep `.env.local` out of git (already ignored).
