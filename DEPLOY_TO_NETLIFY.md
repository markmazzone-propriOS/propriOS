# Deploy to Netlify

## Option 1: Drag & Drop (Fastest - 2 minutes)

1. **Build your project locally**:
   ```bash
   npm run build
   ```

2. **Go to Netlify**: [app.netlify.com/drop](https://app.netlify.com/drop)

3. **Drag the `dist` folder** onto the page

4. **Add environment variables**:
   - Click "Site settings" → "Environment variables"
   - Add these from your `.env` file:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

5. **Redeploy** after adding env vars

Done! Your site is live.

---

## Option 2: Git Integration (Recommended for updates)

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Go to Netlify**: [app.netlify.com](https://app.netlify.com)

3. **Click "Add new site" → "Import an existing project"**

4. **Connect your Git provider** and select your repository

5. **Netlify auto-detects settings**, but verify:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - (The `netlify.toml` file handles this automatically)

6. **Add environment variables**:
   - Under "Site configuration" → "Environment variables"
   - Add:
     - `VITE_SUPABASE_URL` = (your Supabase URL)
     - `VITE_SUPABASE_ANON_KEY` = (your Supabase anon key)

7. **Click "Deploy"**

Your site will auto-deploy on every Git push!

---

## Get Your Environment Variables

From your `.env` file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Troubleshooting

**404 on page refresh?**
- The `netlify.toml` file fixes this with redirect rules

**Build fails?**
- Check that Node version is 18+ in Netlify settings
- Make sure all dependencies are in `package.json`

**Environment variables not working?**
- They must start with `VITE_` to be exposed to the frontend
- Redeploy after adding them

---

## Custom Domain (Optional)

1. Go to "Domain settings" in Netlify
2. Click "Add custom domain"
3. Follow DNS instructions

Your app is production-ready!
