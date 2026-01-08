# Setup Guide for Daily Puzzle Auto-Generation

## 1. Vercel KV Setup (Required for Production)

### Option A: Automated Setup (Recommended)

Use the setup script to automate environment variable configuration:

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (from client directory)
cd client
vercel link

# Run the setup script
npm run setup:kv
```

The script will:
- ✅ Check if Vercel CLI is installed
- ✅ Verify authentication
- ✅ Check project linking
- ✅ Prompt for KV credentials
- ✅ Set environment variables automatically
- ✅ Optionally set CRON_SECRET

**Note:** You still need to manually create the KV database in Vercel Dashboard first (see Option B, Step 1).

### Option B: Manual Setup

#### Step 1: Create Vercel KV Database

**Note:** Vercel KV is now available through the Marketplace. You'll use **Upstash** which provides Redis/KV.

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Storage** tab
4. Click **Create Database** (or **Add Storage**)
5. In the Marketplace Database Providers section, expand **Upstash** and select **"Upstash for Redis"**
   - ⚠️ **Important:** Choose "Upstash for Redis" (NOT "Upstash Vector" - that's for AI/ML)
   - Description: "Serverless DB (Redis, Vector, Queue, Search)"
6. Follow the Upstash setup wizard:
   - Sign in to Upstash (or create account if needed)
   - Choose a name for your database (e.g., "sudaco-kv")
   - Select a region (choose closest to your users)
   - Click **Create** or **Continue**

#### Step 2: Get Environment Variables

After creating the Upstash database:

**Option A: From Vercel Dashboard**
1. Go back to your Vercel project → **Storage** tab
2. Click on your Upstash database
3. Look for **Environment Variables** or **Connection Details**
4. You should see:
   - **UPSTASH_REDIS_REST_URL** → This becomes your `KV_REST_API_URL`
   - **UPSTASH_REDIS_REST_TOKEN** → This becomes your `KV_REST_API_TOKEN`

**Option B: From Upstash Dashboard**
1. Go to [Upstash Console](https://console.upstash.com/)
2. Select your database
3. Go to **REST API** or **Details** tab
4. Copy:
   - **UPSTASH_REDIS_REST_URL** → Use as `KV_REST_API_URL`
   - **UPSTASH_REDIS_REST_TOKEN** → Use as `KV_REST_API_TOKEN`

**Note:** Upstash uses `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, but our code expects `KV_REST_API_URL` and `KV_REST_API_TOKEN`. You can either:
- Use the Upstash variable names directly (requires code change), OR
- Map them in Vercel environment variables (recommended - see Step 3)

#### Step 3: Add Environment Variables to Vercel

**Option A: Automated (Recommended - if you have Vercel CLI)**

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Login and link your project:
   ```bash
   vercel login
   cd client
   vercel link
   ```

3. Run the setup script:
   ```powershell
   # Windows PowerShell
   .\scripts\set-env-vars.ps1
   
   # Or Linux/Mac
   bash scripts/set-env-vars.sh
   ```

   This will automatically set:
   - `KV_REST_API_URL = https://charmed-javelin-7636.upstash.io`
   - `KV_REST_API_TOKEN = AR3UAAImcDIxNGU3NDQwMDQwMjc0N2RkYjZlM2IxOWIzZDQzZThhZnAyNzYzNg`

**Option B: Manual (Vercel Dashboard)**

1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**

2. Add the following variables:
   ```
   KV_REST_API_URL = https://charmed-javelin-7636.upstash.io
   KV_REST_API_TOKEN = AR3UAAImcDIxNGU3NDQwMDQwMjc0N2RkYjZlM2IxOWIzZDQzZThhZnAyNzYzNg
   ```

3. Make sure to add them for:
   - ✅ Production
   - ✅ Preview (optional)
   - ✅ Development (optional)

4. Click **Save**

#### Step 4: Redeploy

After adding environment variables, you need to redeploy:
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment
- Or push a new commit to trigger automatic deployment

---

## 2. WASM Files (Already Set Up)

✅ **WASM files are already in place:**
- Location: `client/api/cron/wasm/`
- Files:
  - `sudoku_solver.js`
  - `sudoku_solver.wasm`

These files are automatically included when you deploy to Vercel. No additional action needed.

---

## 2. WASM Files (Already Set Up)

✅ **WASM files are already in place:**
- Location: `client/api/cron/wasm/`
- Files:
  - `sudoku_solver.js`
  - `sudoku_solver.wasm`

These files are automatically included when you deploy to Vercel. No additional action needed.

---

## 3. Optional: CRON_SECRET (Recommended for Security)

### Why?
Protects your cron endpoint from unauthorized access.

### How to Set:

1. Generate a random secret:
   ```bash
   # On Linux/Mac
   openssl rand -hex 32
   
   # On Windows PowerShell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
   ```

2. Add to Vercel Environment Variables:
   ```
   CRON_SECRET = <your-generated-secret>
   ```

3. Update the cron endpoint if you want stricter authentication (currently optional)

---

## 4. Verify Setup

### Test the Cron Endpoint:

```bash
# Without CRON_SECRET
curl https://your-domain.vercel.app/api/cron/generate-daily

# With CRON_SECRET
curl https://your-domain.vercel.app/api/cron/generate-daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check Vercel Logs:

1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on a deployment
3. Go to **Functions** tab
4. Click on `/api/cron/generate-daily`
5. Check the **Logs** to see if it's working

---

## Troubleshooting

### Issue: "KV not available"
- ✅ Check that `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set in Vercel
- ✅ Make sure you redeployed after adding environment variables

### Issue: "Could not find WASM module"
- ✅ Verify `client/api/cron/wasm/` contains both `.js` and `.wasm` files
- ✅ Check Vercel build logs to ensure files are included

### Issue: Cron job not running
- ✅ Check `vercel.json` has the cron configuration
- ✅ Verify the schedule is correct: `0 0 * * *` (midnight UTC)
- ✅ Check Vercel Cron Jobs dashboard for execution history

---

## Quick Checklist

- [ ] Created Vercel KV database
- [ ] Added `KV_REST_API_URL` to environment variables
- [ ] Added `KV_REST_API_TOKEN` to environment variables
- [ ] Redeployed after adding environment variables
- [ ] (Optional) Added `CRON_SECRET` for security
- [ ] Verified WASM files are in `client/api/cron/wasm/`
- [ ] Tested the cron endpoint manually

---

## Cost Considerations

**Vercel KV Pricing:**
- Free tier: 256 MB storage, 30M reads/month, 30M writes/month
- Pro: $0.20/GB storage, $0.20 per 1M reads, $0.20 per 1M writes

For daily puzzle generation:
- 1 puzzle per day = ~365 puzzles/year
- Each puzzle ~1-5 KB
- Very minimal usage, well within free tier
