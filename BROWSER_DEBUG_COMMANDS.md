# Browser Debug Commands - Run in Console

After opening your app on Vercel, open DevTools (F12) → Console tab, and run these commands:

## 1. Check if Video Element Exists
```javascript
const video = document.querySelector('video[key="remote-video"]')
console.log('Video element:', video)
console.log('Has srcObject:', !!video?.srcObject)
console.log('srcObject type:', video?.srcObject?.constructor?.name)
```

## 2. Check Video Stream Details
```javascript
const video = document.querySelector('video[key="remote-video"]')
if (video?.srcObject) {
  const stream = video.srcObject
  console.log('Stream ID:', stream.id)
  console.log('Video tracks:', stream.getVideoTracks().length)
  console.log('Audio tracks:', stream.getAudioTracks().length)
  stream.getVideoTracks().forEach(track => {
    console.log('Track:', {
      enabled: track.enabled,
      readyState: track.readyState,
      muted: track.muted,
      label: track.label
    })
  })
}
```

## 3. Check Video Element State
```javascript
const video = document.querySelector('video[key="remote-video"]')
if (video) {
  const styles = window.getComputedStyle(video)
  console.log({
    display: styles.display,
    visibility: styles.visibility,
    opacity: styles.opacity,
    zIndex: styles.zIndex,
    width: styles.width,
    height: styles.height,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    readyState: video.readyState,
    paused: video.paused,
    srcObject: !!video.srcObject
  })
}
```

## 4. Force Video Visibility (if it's hidden)
```javascript
const video = document.querySelector('video[key="remote-video"]')
if (video && video.srcObject) {
  video.style.opacity = '1'
  video.style.display = 'block'
  video.style.visibility = 'visible'
  video.style.zIndex = '15'
  video.play().then(() => console.log('✅ Video playing')).catch(e => console.error('❌ Play failed:', e))
}
```

## 5. Check WebRTC Connection State
```javascript
// Check if peer connection exists in window (if exposed)
// Otherwise, check console logs for:
// - "🔗 Connection state: connected"
// - "✅✅✅ WebRTC CONNECTED! ✅✅✅"
// - "📥 Received remote track: video live"
```

## 6. Check Container Visibility
```javascript
const container = document.querySelector('.mb-4.bg-black.rounded-lg')
if (container) {
  const styles = window.getComputedStyle(container)
  console.log('Container:', {
    display: styles.display,
    opacity: styles.opacity,
    height: styles.height,
    width: styles.width,
    visibility: styles.visibility
  })
}
```

## 7. Monitor Video Element Changes (Real-time)
```javascript
const video = document.querySelector('video[key="remote-video"]')
if (video) {
  const observer = new MutationObserver(() => {
    console.log('Video element changed:', {
      srcObject: !!video.srcObject,
      opacity: window.getComputedStyle(video).opacity,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight
    })
  })
  observer.observe(video, { attributes: true, attributeFilter: ['style', 'class'] })
  console.log('👀 Monitoring video element...')
}
```

## 8. Check if Local and Remote Streams are Different
```javascript
const localVideo = document.querySelector('video[ref="localVideoRef"]') || 
                   document.querySelectorAll('video')[1] // Usually second video is local
const remoteVideo = document.querySelector('video[key="remote-video"]')

if (localVideo?.srcObject && remoteVideo?.srcObject) {
  const localStream = localVideo.srcObject
  const remoteStream = remoteVideo.srcObject
  console.log('Local stream ID:', localStream.id)
  console.log('Remote stream ID:', remoteStream.id)
  console.log('Are they different?', localStream.id !== remoteStream.id)
}
```

## Quick Fix Command (Run if video exists but not visible)
```javascript
// One-line command to force video visibility
(() => {
  const v = document.querySelector('video[key="remote-video"]')
  if (v?.srcObject) {
    v.style.cssText = 'opacity: 1 !important; display: block !important; visibility: visible !important; z-index: 15 !important;'
    v.play().catch(e => console.log('Autoplay blocked, but video should be visible'))
    console.log('✅ Video forced visible')
  } else {
    console.log('❌ No video element or srcObject found')
  }
})()
```

