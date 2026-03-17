# AGENTS.md

## Source Of Truth (Web)

- This repository is the deployment source of truth for the coach web app.
- Vercel production deploys must come from `main` in this repo.
- When a user requests coach app **web** changes, apply them here first.

## Sync Rule

- `Coaching App/web` is a mirror copy only. Do not implement web features there first.
- Never assume changes in another folder are deployed unless they are present in this repo and pushed to `origin/main`.
- After every web commit in this repo, and only after build verification, run:
  - `./scripts/sync-to-coaching-app-web.sh`
- The sync is complete only when the script reports:
  - `SYNC_OK: Coaching App/web is in parity with Omega_Web`

## Pre-Deploy Checklist

1. Confirm changed files exist in this repo (`git status`).
2. Run `npm run build`.
3. Push to `origin/main`.
4. Redeploy latest `main` commit in Vercel.

## Incident Debug Protocol (Non-Negotiable)

When a live feature is reported broken, do not patch by assumption.

1. Reproduce and capture evidence first:
   - Verify live Supabase rows (source table + date range + IDs).
   - Verify app query path and filter logic against those IDs.
   - Verify whether deployed commit contains the expected code.
2. State root cause explicitly before editing code.
3. Apply the smallest fix that addresses that root cause only.
4. Verify with:
   - direct data check (rows now returned for the affected path),
   - `npm run build`,
   - deployment commit confirmation.
5. Never run destructive data actions during incident response unless the user explicitly asks.

This workflow is mandatory for metrics, messages, programs, meal plans, forms, and roadmap data paths.

## Quantitative/Integration Rule (Non-Negotiable)

For external API, schema, migration, limits, billing, quotas, or any quantitative behavior:

1. Do not use guessed terms, inferred limits, or heuristic-only mappings when official docs/endpoints can provide exact values.
2. Derive terms/parameters directly from authoritative sources first:
   - official API docs,
   - official discovery/list endpoints,
   - live response payloads.
3. In execution notes, state exactly which source defined each critical parameter.
4. If exact values are unavailable in docs, call this out explicitly and run a deterministic discovery step before any write/import run.
5. Prefer two-step workflows:
   - discovery/export of exact terms,
   - reviewed execution using only discovered terms.
