# Tafel Auto Detector Web

A browser-based Tafel-region screening app deployable on GitHub + Vercel.

The app runs entirely in the browser:

- CSV upload stays local to the user's browser.
- It supports `eta,logi` and common `potential,current` column aliases.
- It computes consensus-expanded Tafel picks: core, expanded, more expanded.
- It displays bootstrap 95% confidence intervals and diagnostic local-slope plots.

This web version intentionally focuses on the repaired local-window algorithm. Full-curve/Bayesian fitting from the Python research package is not exposed in this static app until the model-acceptance criteria are stricter.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Build

```bash
npm run build
```

The app is configured with `output: 'export'` in `next.config.js`, so Vercel can deploy it as a static site.

## Input format

Recommended input:

```csv
eta,logi
0.04,-2.29
0.05,-2.20
```

Raw current input is also accepted:

```csv
E_V,j_A_cm2
0.04,5.1e-3
0.05,6.3e-3
```

## Deploy with GitHub + Vercel

1. Create a new GitHub repository.
2. Push this folder to GitHub.
3. In Vercel, choose **Add New Project** and import the GitHub repository.
4. Framework preset should be **Next.js**.
5. Build command: `npm run build`.
6. Output directory: `out`.
7. Deploy.

## Scientific caution

This app is a screening tool. Final Tafel-region decisions still require domain judgment about iR correction, background subtraction, capacitive current, and mass-transfer effects.
