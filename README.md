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
