# ⚡ Quick Deploy Guide - Share with Friends!

## 🎯 Goal: Get a web link you can share with friends

---

## 🚀 Easiest Way: Railway + Vercel (15 minutes)

### Part 1: Deploy Server (Railway)

1. Go to **[railway.app](https://railway.app)** and sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your **StrangersConnect** repository
4. Click **"Settings"** → **"Root Directory"** → Set to: `server`
5. Click **"Variables"** → Add:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = (leave empty for now, we'll set it later)
6. Railway will auto-deploy! Wait for it to finish
7. Copy your server URL (looks like: `https://strangers-connect-production.up.railway.app`)

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

**Server won't start?**
- Check Railway logs (click "View Logs")
- Make sure Root Directory is set to `server`

**Frontend can't connect?**
- Verify `NEXT_PUBLIC_SOCKET_URL` matches your Railway URL exactly
- Check browser console (F12) for errors

**Need help?** Check the full guide in `DEPLOY.md`

---

## 📱 Share Your Link

Once deployed, you'll get a link like:
```
https://strangers-connect.vercel.app
```

Just share this link with friends - no setup needed on their end! 🎊

