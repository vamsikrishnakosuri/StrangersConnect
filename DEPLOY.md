# 🚀 Deploy Strangers Connect to the Cloud

This guide will help you deploy your app so friends can access it with just a web link!

## Quick Overview

You need to deploy **2 parts**:
1. **Server** (Socket.io) → Railway, Render, or Fly.io
2. **Frontend** (Next.js) → Vercel (recommended) or Netlify

---

## Option 1: Railway (Server) + Vercel (Frontend) - RECOMMENDED ✨

### Step 1: Deploy Server to Railway

1. **Sign up**: Go to [railway.app](https://railway.app) and sign up with GitHub
2. **Create New Project**: Click "New Project"
3. **Deploy from GitHub**: Select your `StrangersConnect` repository
4. **Configure Server**:
   - **Root Directory**: Set to `server`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV` = `production`
     - `FRONTEND_URL` = (we'll set this after frontend is deployed)
5. **Get Server URL**: Railway will give you a URL like `https://your-app.railway.app`
   - Copy this URL! You'll need it for the frontend

### Step 2: Deploy Frontend to Vercel

1. **Sign up**: Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. **Import Project**: Click "Add New" → "Project"
3. **Select Repository**: Choose your `StrangersConnect` repository
4. **Configure**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: Leave as `.` (root)
   - **Environment Variables**:
     - `NEXT_PUBLIC_SOCKET_URL` = `https://your-app.railway.app` (your Railway server URL)
5. **Deploy**: Click "Deploy"
6. **Get Frontend URL**: Vercel will give you a URL like `https://strangers-connect.vercel.app`

### Step 3: Update Server with Frontend URL

1. Go back to Railway dashboard
2. Open your server project
3. Go to **Variables** tab
4. Add/Update: `FRONTEND_URL` = `https://strangers-connect.vercel.app` (your Vercel URL)
5. Railway will automatically restart the server

### Step 4: Share the Link! 🎉

Your friends can now access: `https://strangers-connect.vercel.app`

---

## Option 2: Render (Server) + Vercel (Frontend)

### Step 1: Deploy Server to Render

1. **Sign up**: Go to [render.com](https://render.com) and sign up with GitHub
2. **New Web Service**: Click "New" → "Web Service"
3. **Connect Repository**: Select your `StrangersConnect` repository
4. **Configure**:
   - **Name**: `strangers-connect-server`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV` = `production`
     - `FRONTEND_URL` = (set after frontend deployment)
5. **Deploy**: Click "Create Web Service"
6. **Get URL**: Render gives you a URL like `https://strangers-connect-server.onrender.com`

### Step 2: Deploy Frontend to Vercel

Same as Option 1, Step 2, but use your Render server URL for `NEXT_PUBLIC_SOCKET_URL`

### Step 3: Update Server

Same as Option 1, Step 3, but update `FRONTEND_URL` in Render dashboard

---

## Option 3: All-in-One on Render

Deploy both server and frontend on Render:

### Server Deployment
- Follow Option 2, Step 1

### Frontend Deployment
1. **New Static Site**: Click "New" → "Static Site"
2. **Connect Repository**: Select your `StrangersConnect` repository
3. **Configure**:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `.next`
   - **Environment Variables**:
     - `NEXT_PUBLIC_SOCKET_URL` = `https://your-server.onrender.com`
4. **Deploy**

---

## Environment Variables Summary

### Server (Railway/Render)
```
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.vercel.app
PORT=3001 (auto-set by platform)
```

### Frontend (Vercel)
```
NEXT_PUBLIC_SOCKET_URL=https://your-server.railway.app
```

---

## Testing After Deployment

1. Open your deployed frontend URL
2. Open it in a second browser/incognito window
3. Both click "Find Stranger"
4. They should match and chat! ✅

---

## Troubleshooting

### Server won't start
- Check Railway/Render logs
- Make sure `npm start` works locally
- Verify all environment variables are set

### Frontend can't connect to server
- Check `NEXT_PUBLIC_SOCKET_URL` is correct
- Verify server is running (check server URL in browser)
- Check browser console for CORS errors
- Make sure `FRONTEND_URL` on server matches your frontend URL

### CORS errors
- Verify `FRONTEND_URL` on server exactly matches your frontend URL
- Check server allows your frontend origin

---

## Free Tier Limits

- **Railway**: $5 free credit/month (enough for small projects)
- **Render**: Free tier available (spins down after inactivity)
- **Vercel**: Free tier with generous limits (perfect for Next.js)

---

## Need Help?

1. Check deployment logs in Railway/Render/Vercel dashboards
2. Test locally first to make sure everything works
3. Check browser console (F12) for errors
4. Verify all environment variables are set correctly

---

## Next Steps

Once deployed:
1. Share the link with friends!
2. Monitor usage in your dashboard
3. Consider adding custom domain
4. Add features like rooms, topics, etc.

Happy deploying! 🚀

