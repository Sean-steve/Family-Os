# Family OS

Family OS is a privacy-first family coordination and intelligence workspace within the Human Kernel ecosystem.

This repository contains the **frontend-only** prototype. No backend, authentication service, or live cross-OS integrations are configured.

## Phase 1

Foundation, design system and dashboard reconstruction. Interactive demo data is stored locally in the browser. Later phases build the remaining family workflows.

## Development

```bash
npm install
npm run dev
npm run build
```

The Vite base path is set for GitHub Pages at `/Family-Os/`.

## GitHub Pages activation

GitHub Actions successfully builds this frontend, but **GitHub Pages has not been enabled for this repository**. The connected GitHub App and the workflow `GITHUB_TOKEN` cannot create the Pages site (`Resource not accessible by integration`). The repository owner must complete the one-time UI step:

1. Open **Settings → Pages** in the `Sean-steve/Family-Os` repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions → Build and deploy Family OS to GitHub Pages → Run workflow** (branch `main`).
4. Once the workflow succeeds, visit `https://sean-steve.github.io/Family-Os/`.

No backend is installed. Family preview data is fictional and saved in browser localStorage only.
