# 🚂 Railway Setup - Step by Step with Screenshots Guide

## Finding the Root Directory Setting

### Step 1: After Importing Your Repo

When you first import your repository, Railway will create a **service** (a box/tile) with your repository name.

### Step 2: Click on Your Service

Click on the service box/tile that was created. This will open the service details.

### Step 3: Navigate to Settings

You should see tabs at the top or left sidebar:
- **Deployments** (default view)
- **Settings** ⚙️
- **Variables**
- **Metrics**
- **Logs**

Click on **"Settings"** tab.

### Step 4: Find Root Directory

In the Settings page, scroll down. You'll see sections like:
- **General**
- **Source** ← **Look here!**
- **Build & Deploy**
- **Domains**

Under **"Source"** section, you'll find:
- **Repository**: (your GitHub repo)
- **Branch**: `main` or `master`
- **Root Directory**: ← **This is what you need!**

### Step 5: Set Root Directory

1. Click on the **"Root Directory"** field (it might say `.` or be empty)
2. Type: `server`
3. Click **"Save"** or **"Update"** button
4. Railway will automatically redeploy

---

## Alternative: If You Still Can't Find It

### Method 1: Use Railway CLI

If the UI doesn't show it, you can use Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link your project
railway link

# Set root directory
railway variables set RAILWAY_SOURCE_DIR=server
```

### Method 2: Create a railway.json Config File

Create `railway.json` in your repo root (we already have this in `server/railway.json`):

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

But since our server files are in the `server/` folder, we need Railway to know this.

### Method 3: Create a Separate Service Configuration

Actually, the easiest way might be to:
1. Let Railway deploy (it will fail initially)
2. Check the error logs
3. The error will tell you what's wrong
4. Then you can fix the Root Directory setting

---

## Visual Guide (What to Look For)

```
Railway Dashboard
├── Projects
    └── Your Project
        └── Services
            └── [Your Service Name] ← CLICK HERE
                ├── Deployments (tab)
                ├── Settings (tab) ← CLICK HERE
                │   ├── General
                │   ├── Source ← SCROLL HERE
                │   │   ├── Repository: github.com/your-repo
                │   │   ├── Branch: main
                │   │   └── Root Directory: . ← CHANGE THIS TO "server"
                │   ├── Build & Deploy
                │   └── Domains
                ├── Variables (tab)
                └── Metrics (tab)
```

---

## Quick Fix: If Root Directory Setting Doesn't Appear

Sometimes Railway's UI changes. Try:

1. **Check the Deployments tab** - Look at the latest deployment logs
2. **If it fails**, the error will tell you what's wrong
3. **Try redeploying** - Sometimes Railway needs a restart
4. **Contact Railway support** - They're very helpful

---

## After Setting Root Directory

Once you set Root Directory to `server`:
1. Railway will automatically redeploy
2. Check the **Deployments** tab - it should show "Building" then "Active"
3. Once active, go to **Settings** → **Domains** to get your URL

---

## Still Having Issues?

If you've tried everything and still can't find it:
1. Take a screenshot of your Railway dashboard
2. Check Railway's documentation: https://docs.railway.app
3. Or use an alternative: **Render.com** (instructions in `DEPLOY.md`)

