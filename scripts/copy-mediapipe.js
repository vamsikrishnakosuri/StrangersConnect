// Copies the MediaPipe WASM runtime into public/ so it is served from our own domain.
// Users' browsers never contact a third party to run face filters.
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const dest = path.join(__dirname, '..', 'public', 'mediapipe', 'wasm')
fs.mkdirSync(dest, { recursive: true })
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f))
}
console.log('MediaPipe runtime copied to public/mediapipe/wasm')
