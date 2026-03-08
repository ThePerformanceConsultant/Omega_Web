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
