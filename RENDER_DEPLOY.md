# 🚀 Deploy to Render.com (Better WebSocket Support)

## Why Render.com Instead of Railway?
- ✅ **Better WebSocket support**
- ✅ **Free tier** with 750 hours/month
- ✅ **Easier configuration**
- ✅ **More reliable** for real-time apps

## Step 1: Deploy Backend to Render.com

1. **Go to** [https://render.com](https://render.com)
2. **Sign up** with GitHub
3. Click **"New +"** → **"Web Service"**
4. **Connect your GitHub repo**: `StrangersConnect`
5. **Configure**:
   - **Name**: `strangersconnect-server`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
6. **Click "Create Web Service"**
7. **Wait 2-3 minutes** for deployment
8. **Copy your server URL**: `https://strangersconnect-server.onrender.com`

## Step 2: Deploy Frontend to Vercel

1. **Go to** [https://vercel.com](https://vercel.com)
2. **Import your GitHub repo**: `StrangersConnect`
3. **Add Environment Variable**:
   - **Key**: `NEXT_PUBLIC_SOCKET_URL`
   - **Value**: `https://strangersconnect-server.onrender.com` (your Render URL)
4. **Deploy!**

## Step 3: Test!

1. Open your Vercel URL on **two devices/browsers**
2. Click **"Find Stranger"** on both
3. **Cameras auto-start!** 🎥
4. **Both videos appear!** ✅

## That's It! 🎉

Your app is now live with:
- ✅ Auto-start video like Omegle
- ✅ Reliable WebSocket connection
- ✅ Free hosting
- ✅ Open source

**Note**: First load on Render might take 30 seconds (free tier cold start). After that, it's fast!

