# Browser Testing Checklist

## ✅ What to Check in Browser Console

After opening your app on Vercel, open DevTools (F12) and check:

### 1. **Video Element Never Unmounts**
```javascript
// In Console, run:
document.querySelector('video[key="remote-video"]')
// Should return: <video> element (not null)
```

### 2. **Check Container Display**
```javascript
// In Console, run:
const container = document.querySelector('.mb-4.bg-black.rounded-lg')
console.log('Container display:', window.getComputedStyle(container).display)
// Should be: "block" (never "none")
```

### 3. **Check Video Element Styles**
```javascript
// In Console, run:
const video = document.querySelector('video[key="remote-video"]')
const styles = window.getComputedStyle(video)
console.log({
  display: styles.display,        // Should be "block"
  visibility: styles.visibility,  // Should be "visible"
  opacity: styles.opacity,       // Should be "0.01" or "1"
  width: styles.width,
  height: styles.height
})
```

### 4. **When Matched, Check ReadyState**
```javascript
// After matching, in Console:
const video = document.querySelector('video[key="remote-video"]')
console.log({
  readyState: video.readyState,  // Should be 4 (HAVE_ENOUGH_DATA)
  paused: video.paused,          // Should be false if playing
  srcObject: !!video.srcObject,  // Should be true
  videoWidth: video.videoWidth,
  videoHeight: video.videoHeight
})
```

### 5. **Monitor Console Logs**
Look for these logs in order:
1. `✅ Matched with: [userId]`
2. `📥 Received remote track: video live`
3. `🎥 Setting remote VIDEO stream`
4. `Setting srcObject for the first time...`
5. `✅ Made video visible BEFORE setting stream`
6. `✅✅✅ REMOTE VIDEO PLAYING! ✅✅✅`

## 🐛 Expected Issues & Fixes

### Issue: `readyState: 0`
**Cause**: MediaStream not loading into video element
**Fix Applied**: Container never uses `display: none`, video always visible

### Issue: `AbortError: play() interrupted`
**Cause**: Browser autoplay policy
**Fix Applied**: Click-to-play button + clickable container

### Issue: Video element unmounts
**Cause**: React reusing element
**Fix Applied**: Added `key="remote-video"` prop

## 🔍 Current Code Status

✅ **Video Element**:
- Always in DOM (not conditionally rendered)
- Has `key="remote-video"` prop
- `display: 'block'` always
- `visibility: 'visible'` always

✅ **Container**:
- `display: 'block'` always (never `none`)
- Uses `opacity: 0` and `height: 0` when hidden
- Keeps video element active for MediaStream loading

## 📍 Test URLs

- **Frontend**: `https://strangers-connect.vercel.app` (or your Vercel URL)
- **Backend**: `https://strangersconnect.onrender.com` (or your Render URL)

## 🔧 Environment Variables

Make sure Vercel has:
- `NEXT_PUBLIC_SOCKET_URL` = `https://strangersconnect.onrender.com`

