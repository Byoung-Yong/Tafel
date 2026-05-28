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
   - Output directory: `out`
6. Click **Deploy**.

## Updating the app

After the first deployment, push to GitHub:

```bash
git add .
git commit -m "Update Tafel detector"
git push
```

Vercel will create a new deployment automatically from the GitHub push.

## Why static export?

This project performs all analysis in the browser. Static export avoids Python serverless dependencies and makes the deployment robust on Vercel.
