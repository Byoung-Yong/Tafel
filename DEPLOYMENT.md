# GitHub + Vercel deployment guide

## One-time setup

```bash
git init
git add .
git commit -m "Initial Tafel web app"
git branch -M main
git remote add origin https://github.com/<YOUR_USER>/<YOUR_REPO>.git
git push -u origin main
```

## Vercel dashboard

1. Sign in to Vercel.
2. Click **Add New Project**.
3. Select the GitHub repository.
4. Keep the detected framework as **Next.js**.
5. Use:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: leave this field empty / use the Vercel default
6. Click **Deploy**.

## Updating the app

After the first deployment, push to GitHub:

```bash
git add .
git commit -m "Update Tafel detector"
git push
```

Vercel will create a new deployment automatically from the GitHub push.

## Why no custom output directory?

This project performs all analysis in the browser, but it is still a normal Next.js app. Let Vercel use its default Next.js build output. Do not set the output directory to `out`; doing so can make Vercel look for `out/routes-manifest.json` and fail the deployment.

## Fix for `out/routes-manifest.json` error

If Vercel shows an error like:

```text
The file "/vercel/path0/out/routes-manifest.json" couldn't be found
```

open **Project Settings → Build & Development Settings** and clear the custom **Output Directory** value. Do not use `out` for this project. Redeploy after saving the setting.
