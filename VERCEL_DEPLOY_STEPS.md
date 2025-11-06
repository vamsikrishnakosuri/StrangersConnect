# 🚀 Deploy Frontend to Vercel - Step by Step

## You need the FRONTEND (Vercel) to get the webpage!

Your Railway URL (`strangersconnect-production.up.railway.app`) is just the **backend server**. 
The **frontend** (the actual webpage) needs to be deployed separately.

---

## Quick Steps:

### 1. Go to Vercel
- Visit: **[vercel.com](https://vercel.com)**
- Sign up/Login with **GitHub** (same account you used for Railway)

### 2. Import Your Project
- Click **"Add New"** → **"Project"**
- Find your **StrangersConnect** repository
- Click **"Import"**

### 3. Configure Environment Variables

**IMPORTANT:** Before clicking "Deploy", you MUST add the environment variable:

1. In the **"Environment Variables"** section (before deploying)
2. Click **"+ Add"** or **"Add Environment Variable"**
3. Add:
   - **Key:** `NEXT_PUBLIC_SOCKET_URL`
   - **Value:** `https://strangersconnect-production.up.railway.app`
   - Make sure it's available for **Production**, **Preview**, and **Development**
4. Click **"Add"**

### 4. Deploy

1. **Framework Preset:** Should auto-detect "Next.js" ✅
2. **Root Directory:** Leave as `.` (root) ✅
3. **Build Command:** `npm run build` (auto-filled)
4. **Output Directory:** `.next` (auto-filled)
5. Click **"Deploy"**

### 5. Wait for Deployment

- Vercel will build and deploy (2-3 minutes)
- Watch the build logs in real-time
- Once done, you'll see "Ready" ✅

### 6. Get Your Frontend URL

After deployment, Vercel will show you a URL like:
```
https://strangers-connect.vercel.app
```

**THIS is the URL you share with friends!** 🎉

---

## Step 7: Connect Server to Frontend

After you get your Vercel URL:

1. Go back to **Railway** dashboard
2. Click your **StrangersConnect** service
3. Go to **"Variables"** tab
4. Add/Update: `FRONTEND_URL` = `https://your-vercel-url.vercel.app`
5. Railway will automatically restart the server

---

## Test It!

1. Open your Vercel URL (e.g., `https://strangers-connect.vercel.app`)
2. You should see the Strangers Connect interface!
3. Open it in a second browser/incognito window
4. Both click "Find Stranger"
5. Start chatting! 🎊

---

## Troubleshooting

**If Vercel deployment fails:**
- Check build logs in Vercel dashboard
- Make sure `package.json` has all dependencies
- Verify `next.config.js` exists

**If frontend can't connect to server:**
- Verify `NEXT_PUBLIC_SOCKET_URL` is exactly: `https://strangersconnect-production.up.railway.app`
- Check Railway server is "Active"
- Check browser console (F12) for errors

