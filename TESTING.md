# Testing Guide for Strangers Connect

## Quick Start Testing

### Option 1: Test Locally (Multiple Browser Windows)

1. **Start the Socket.io Server** (Terminal 1):
   ```powershell
   cd server
   npm run dev
   ```
   You should see: `🚀 Socket.io server running on port 3001`

2. **Start the Next.js Frontend** (Terminal 2):
   ```powershell
   npm run dev
   ```
   You should see: `Ready on http://localhost:3000`

3. **Open Multiple Browser Windows**:
   - Open `http://localhost:3000` in Chrome
   - Open `http://localhost:3000` in Firefox (or another Chrome window in incognito mode)
   - Or open the same URL in multiple tabs

4. **Test the Connection**:
   - In Window 1: Click "Find Stranger"
   - In Window 2: Click "Find Stranger"
   - They should match and be able to chat!

### Option 2: Test with Friends on Same Network (LAN)

1. **Find Your Computer's IP Address**:
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., `192.168.1.100`)

2. **Start Both Servers** (same as above)

3. **Update the Frontend Connection** (if needed):
   - The app currently connects to `localhost:3001`
   - For friends to connect, they need your IP address
   - We'll create a way to configure this

4. **Friends Connect**:
   - Friend opens: `http://YOUR_IP_ADDRESS:3000` (e.g., `http://192.168.1.100:3000`)
   - You open: `http://localhost:3000`
   - Both click "Find Stranger" to connect

### Option 3: Test with Friends Over Internet (Advanced)

For testing over the internet, you'll need to:
1. Deploy the server to a cloud service (Heroku, Railway, Render, etc.)
2. Update the frontend to connect to the deployed server URL
3. Deploy the frontend (Vercel, Netlify, etc.)

## Testing Checklist

- [ ] Server starts without errors
- [ ] Frontend loads at http://localhost:3000
- [ ] Connection status shows "Connected" (green dot)
- [ ] Can click "Find Stranger" button
- [ ] Shows "Searching for stranger..." message
- [ ] Two windows match successfully
- [ ] Can send messages between matched users
- [ ] Messages appear in real-time
- [ ] Can disconnect and find new stranger
- [ ] Works with multiple users simultaneously

## Troubleshooting

### Server won't start
- Make sure port 3001 is not already in use
- Check if Node.js is installed: `node --version`
- Reinstall dependencies: `cd server && npm install`

### Frontend won't connect
- Make sure the server is running on port 3001
- Check browser console for errors (F12)
- Verify the Socket.io server is accessible

### Can't match with friends
- Make sure both are connected (green dot visible)
- Make sure firewall allows connections on port 3000 and 3001
- Try restarting both servers

### Messages not appearing
- Check browser console for WebSocket errors
- Verify both users are "matched" (should show "Chat Active")
- Try refreshing the page

## Next Steps for Production

1. Add environment variable configuration
2. Deploy to a hosting service
3. Add user authentication (optional)
4. Add message moderation
5. Add reporting/blocking features

