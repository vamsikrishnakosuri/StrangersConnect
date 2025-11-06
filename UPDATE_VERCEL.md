# 🔄 Update Your Vercel Deployment

Your code is already pushed to GitHub! Now you need to update your Vercel deployment.

---

## Option 1: Auto-Deploy (If Connected to GitHub) ✅

If you connected Vercel to your GitHub repository, it should **automatically deploy** when you push to GitHub.

**But if it didn't auto-deploy:**

1. Go to **[vercel.com](https://vercel.com)** dashboard
2. Click on your **StrangersConnect** project
3. Go to **"Deployments"** tab
4. Look for the latest deployment
5. If it shows an old commit, click **"Redeploy"** button
6. Or click **"..."** (three dots) → **"Redeploy"**

---

## Option 2: Manual Redeploy

1. Go to **[vercel.com](https://vercel.com)** dashboard
2. Click on your **StrangersConnect** project
3. Click **"Deployments"** tab
4. Find the latest deployment
5. Click **"Redeploy"** button (or **"..."** → **"Redeploy"**)
6. Wait 2-3 minutes for deployment to complete

---

## Option 3: Check GitHub Connection

If auto-deploy isn't working:

1. Go to your Vercel project → **"Settings"**
2. Click **"Git"** in the sidebar
3. Make sure it's connected to: `vamsikrishnakosuri/StrangersConnect`
4. If not connected, click **"Connect Git Repository"**
5. Select your repository
6. Vercel will automatically deploy

---

## Option 4: Trigger New Deployment

1. Go to your project on Vercel
2. Click **"Deployments"** tab
3. Click **"Create Deployment"** button (top right)
4. Select branch: **"main"**
5. Click **"Deploy"**

---

## Verify Your Deployment

After redeploying:

1. Go to **"Deployments"** tab
2. Wait for status to show **"Ready"** ✅
3. Click on the deployment URL
4. You should see your updated app with video chat!

---

## Check Environment Variables

Make sure your environment variables are still set:

1. Go to **"Settings"** → **"Environment Variables"**
2. Verify `NEXT_PUBLIC_SOCKET_URL` is set to: `https://strangersconnect-production.up.railway.app`
3. If missing, add it again

---

## Still Not Working?

1. **Check Build Logs:**
   - Go to **"Deployments"** → Click on latest deployment
   - Click **"Build Logs"** to see if there are errors

2. **Clear Cache:**
   - Click **"..."** on deployment → **"Redeploy"**
   - Check **"Use existing Build Cache"** = OFF (unchecked)

3. **Check GitHub:**
   - Verify your code is on GitHub: `https://github.com/vamsikrishnakosuri/StrangersConnect`
   - Make sure the latest commit is there

---

## Quick Check

Your latest commit should be: **"Add video chat feature with WebRTC"**

If Vercel shows an older commit, it needs to be redeployed!

