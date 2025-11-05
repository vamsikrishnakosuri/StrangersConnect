# 🧪 How to Test Strangers Connect

## Quick Test (You + Multiple Browser Windows)

### Step 1: Start the Servers

**Option A: Use the PowerShell Script (Easiest)**
```powershell
.\start-dev.ps1
```

**Option B: Manual Start (Two Terminals)**

**Terminal 1 - Socket.io Server:**
```powershell
cd server
npm run dev
```
Wait until you see: `🚀 Socket.io server running on port 3001`

**Terminal 2 - Next.js Frontend:**
```powershell
npm run dev
```
Wait until you see: `Ready on http://localhost:3000`

### Step 2: Open Multiple Browser Windows

1. **Open Chrome** → Go to `http://localhost:3000`
2. **Open Firefox** (or Chrome Incognito) → Go to `http://localhost:3000`

### Step 3: Test the Connection

1. In **Window 1**: Click "Find Stranger" button
2. In **Window 2**: Click "Find Stranger" button
3. **They should match!** ✅
4. Try sending messages between the two windows
5. Test disconnecting and finding a new match

---

## Test with Friends on Same WiFi Network

### Step 1: Find Your Computer's IP Address

**Windows PowerShell:**
```powershell
ipconfig
```
Look for "IPv4 Address" - something like `192.168.1.100`

### Step 2: Start the Servers

Same as above - start both servers on your computer.

### Step 3: Configure for Network Access

Create a file `.env.local` in the root directory:
```env
NEXT_PUBLIC_SOCKET_URL=http://YOUR_IP_ADDRESS:3001
```

Replace `YOUR_IP_ADDRESS` with your actual IP (e.g., `192.168.1.100`)

### Step 4: Restart Frontend

Stop the frontend (Ctrl+C) and restart:
```powershell
npm run dev
```

### Step 5: Friends Connect

- **You**: Open `http://localhost:3000`
- **Friend**: Open `http://YOUR_IP_ADDRESS:3000` (e.g., `http://192.168.1.100:3000`)
- Both click "Find Stranger" to connect!

### Step 6: Configure Windows Firewall (if needed)

If friends can't connect:
1. Open Windows Defender Firewall
2. Allow Node.js through firewall
3. Or temporarily disable firewall for testing

---

## Test with Friends Over Internet

For testing over the internet, you need to deploy:

1. **Deploy Server** to:
   - Railway.app (free tier available)
   - Render.com (free tier)
   - Heroku (paid now)
   - DigitalOcean (low cost)

2. **Deploy Frontend** to:
   - Vercel (recommended for Next.js - free)
   - Netlify (free)
   - GitHub Pages

3. **Update Environment Variables**:
   - Set `NEXT_PUBLIC_SOCKET_URL` to your deployed server URL

---

## What to Test

✅ **Connection Status**
- Green dot = Connected
- Red dot = Disconnected

✅ **Finding Strangers**
- Click "Find Stranger"
- Should show "Searching..."
- Should match with another user

✅ **Chatting**
- Type a message
- Press Enter or click Send
- Message appears in both windows

✅ **Disconnecting**
- Click "Disconnect"
- Should be able to find a new stranger

✅ **Multiple Users**
- Test with 3-4 browser windows
- Each pair should match independently

---

## Troubleshooting

**❌ "Disconnected" (Red dot)**
- Make sure server is running on port 3001
- Check server terminal for errors
- Restart the server

**❌ Can't find stranger**
- Make sure at least 2 windows are open
- Both should click "Find Stranger"
- Check browser console (F12) for errors

**❌ Messages not appearing**
- Check browser console for WebSocket errors
- Make sure both users are matched
- Try refreshing both windows

**❌ Friend can't connect**
- Check firewall settings
- Verify IP address is correct
- Make sure both are on same network
- Check server is running

---

## Need Help?

If you encounter issues:
1. Check browser console (F12 → Console tab)
2. Check server terminal for errors
3. Verify both servers are running
4. Try restarting everything

Happy testing! 🎉

