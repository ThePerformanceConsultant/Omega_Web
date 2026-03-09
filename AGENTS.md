# AGENTS.md

## Source Of Truth (Web)

- This repository is the deployment source of truth for the coach web app.
- Vercel production deploys must come from `main` in this repo.
- When a user requests coach app **web** changes, apply them here first.

## Sync Rule

- If the same feature also exists in another local copy (for example `Coaching App/web`), treat that copy as secondary.
- Never assume changes in another folder are deployed unless they are present in this repo and pushed to `origin/main`.

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
