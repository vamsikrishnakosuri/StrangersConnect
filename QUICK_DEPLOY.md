# ⚡ Quick Deploy Guide - Share with Friends!

## 🎯 Goal: Get a web link you can share with friends

---

## 🚀 Easiest Way: Railway + Vercel (15 minutes)

### Part 1: Deploy Server (Railway)

1. Go to **[railway.app](https://railway.app)** and sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your **StrangersConnect** repository
4. **IMPORTANT - Set Root Directory:**
   - After the service is created, click on your **service** (it will have your repo name)
   - Look for **"Settings"** tab (on the left sidebar or top menu)
   - Scroll down to **"Source"** section
   - Find **"Root Directory"** field
   - Set it to: `server`
   - Click **"Save"** or **"Update"**
   
   **OR Alternative Method:**
   - If you don't see "Root Directory" in Settings, try:
   - Click on your service → Look for **"Configure"** or **"⚙️ Settings"** icon
   - Or check **"Variables"** tab first, then look for deployment settings
   
5. Add Environment Variables:
   - Click **"Variables"** tab (on the left sidebar)
   - Click **"+ New Variable"**
   - Add: `NODE_ENV` = `production`
   - Add: `FRONTEND_URL` = (leave empty for now, we'll set it after deploying frontend)
   - Click **"Add"** for each variable

6. Railway will auto-deploy! Wait for it to finish (check the "Deployments" tab)
7. Once deployed, click **"Settings"** → Scroll to **"Domains"** section
8. Copy your server URL (looks like: `https://your-app-name.up.railway.app` or click **"Generate Domain"**)

### Part 2: Deploy Frontend (Vercel)

1. Go to **[vercel.com](https://vercel.com)** and sign up with GitHub
2. Click **"Add New"** → **"Project"**
3. Import your **StrangersConnect** repository
4. Click **"Environment Variables"** → Add:
   - `NEXT_PUBLIC_SOCKET_URL` = `https://your-server-url.railway.app` (paste your Railway URL)
5. Click **"Deploy"**
6. Wait for deployment (2-3 minutes)
7. Copy your frontend URL (looks like: `https://strangers-connect.vercel.app`)

### Part 3: Connect Server to Frontend

1. Go back to **Railway** dashboard
2. Open your server project → **"Variables"**
3. Update `FRONTEND_URL` = `https://your-frontend-url.vercel.app` (paste your Vercel URL)
4. Server will auto-restart

### ✅ Done! Share Your Link!

Your friends can now visit: **`https://your-frontend-url.vercel.app`**

---

## 🎮 Test It

1. Open your link in **Chrome**
2. Open the same link in **Firefox** (or incognito)
3. Both click **"Find Stranger"**
4. Start chatting! 🎉

---

## 💡 Pro Tips

- **Free tiers** are available on both platforms
- **Custom domain**: You can add your own domain later
- **Auto-deploy**: Every time you push to GitHub, it auto-updates!

---

## 🆘 Having Issues?

**Can't find "Root Directory" in Railway?**
- Try clicking on your **service name** (the box that appeared after importing)
- Look for tabs: **"Settings"**, **"Variables"**, **"Deployments"**, **"Metrics"**
- In **Settings**, scroll down - "Root Directory" is usually under **"Source"** section
- If still not found, try clicking the **"..." (three dots)** menu on your service
- **Alternative**: Railway might auto-detect it. Check the **"Deployments"** tab - if it's failing, the logs will tell you why

**Server won't start?**
- Check Railway logs: Click your service → **"Deployments"** tab → Click on latest deployment → See logs
- Common issue: If Root Directory isn't set, it will try to run from root and fail
- Make sure `server/package.json` exists and has a `start` script

**Server deployed but can't find the URL?**
- Click your service → **"Settings"** tab
- Scroll to **"Domains"** section
- If no domain, click **"Generate Domain"** or **"Custom Domain"**
- Copy the HTTPS URL (starts with `https://`)

**Frontend can't connect?**
- Verify `NEXT_PUBLIC_SOCKET_URL` matches your Railway URL exactly (including `https://`)
- Check browser console (F12) for errors
- Make sure Railway server shows "Active" status

**Need help?** Check the full guide in `DEPLOY.md`

---

## 📱 Share Your Link

Once deployed, you'll get a link like:
```
https://strangers-connect.vercel.app
```

Just share this link with friends - no setup needed on their end! 🎊

