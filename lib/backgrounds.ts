// Virtual backgrounds, Zoom-style. Person segmentation is MediaPipe's open-source
// selfie segmenter (Apache 2.0), served from our own domain and run on the device.
// The scenes are drawn in code, so there are no image assets to license.

import type { ImageSegmenter } from '@mediapipe/tasks-vision'

export type BackgroundName = 'none' | 'blur' | 'aurora' | 'sunset' | 'studio' | 'night' | 'paper' | 'custom'

let segmenterPromise: Promise<ImageSegmenter> | null = null

export function loadSegmenter(): Promise<ImageSegmenter> {
    if (!segmenterPromise) {
        segmenterPromise = (async () => {
            const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision')
            const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
            const make = (delegate: 'GPU' | 'CPU') =>
                ImageSegmenter.createFromOptions(fileset, {
                    baseOptions: { modelAssetPath: '/mediapipe/selfie_segmenter.tflite', delegate },
                    runningMode: 'VIDEO',
                    outputConfidenceMasks: true,
                    outputCategoryMask: false,
                })
            try {
                return await make('GPU')
            } catch {
                return await make('CPU')
            }
        })()
        segmenterPromise.catch(() => {
            segmenterPromise = null
        })
    }
    return segmenterPromise
}

function seeded(seed: number) {
    return () => {
        seed = (seed * 16807) % 2147483647
        return (seed - 1) / 2147483646
    }
}

/** Paints a built-in scene at the given size. */
export function paintScene(name: Exclude<BackgroundName, 'none' | 'blur' | 'custom'>, w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d')!
    const rand = seeded(11)
    const glow = (cx: number, cy: number, r: number, color: string) => {
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, color)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        x.fillStyle = g
        x.fillRect(0, 0, w, h)
    }

    if (name === 'aurora') {
        x.fillStyle = '#0b0d1a'
        x.fillRect(0, 0, w, h)
        glow(w * 0.2, h * 0.3, Math.max(w, h) * 0.7, 'rgba(124,180,255,0.55)')
        glow(w * 0.85, h * 0.7, Math.max(w, h) * 0.7, 'rgba(255,143,200,0.5)')
        glow(w * 0.55, h * 0.1, Math.max(w, h) * 0.4, 'rgba(94,234,212,0.3)')
    } else if (name === 'sunset') {
        const g = x.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, '#2b1a4a')
        g.addColorStop(0.5, '#e0607e')
        g.addColorStop(1, '#f6b26b')
        x.fillStyle = g
        x.fillRect(0, 0, w, h)
        glow(w * 0.5, h * 0.78, Math.min(w, h) * 0.45, 'rgba(255,220,150,0.8)')
        x.fillStyle = 'rgba(40,20,50,0.55)'
        x.beginPath()
        x.moveTo(0, h)
        for (let i = 0; i <= 8; i++) x.lineTo((w / 8) * i, h * (0.82 + rand() * 0.08))
        x.lineTo(w, h)
        x.fill()
    } else if (name === 'studio') {
        const g = x.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.75)
        g.addColorStop(0, '#5a5a62')
        g.addColorStop(1, '#17171b')
        x.fillStyle = g
        x.fillRect(0, 0, w, h)
    } else if (name === 'night') {
        x.fillStyle = '#0a0b12'
        x.fillRect(0, 0, w, h)
        // Soft bokeh lights
        for (let i = 0; i < 38; i++) {
            const r = (0.02 + rand() * 0.07) * Math.max(w, h)
            const hue = [210, 330, 40, 180][i % 4]
            glow(rand() * w, rand() * h, r, `hsla(${hue},85%,65%,${0.18 + rand() * 0.25})`)
        }
    } else {
        // paper: the brand's charcoal drafting grid with a warm glow
        x.fillStyle = '#0e0e10'
        x.fillRect(0, 0, w, h)
        glow(w * 0.5, h * 0.35, Math.max(w, h) * 0.6, 'rgba(242,193,78,0.16)')
        x.strokeStyle = 'rgba(236,233,226,0.07)'
        x.lineWidth = 1
        const step = Math.max(w, h) / 18
        for (let gx = 0; gx < w; gx += step) {
            x.beginPath()
            x.moveTo(gx, 0)
            x.lineTo(gx, h)
            x.stroke()
        }
        for (let gy = 0; gy < h; gy += step) {
            x.beginPath()
            x.moveTo(0, gy)
            x.lineTo(w, gy)
            x.stroke()
        }
    }
    return c
}

/** Small preview images for the picker. */
const thumbCache = new Map<string, string>()
export function sceneThumb(name: Exclude<BackgroundName, 'none' | 'blur' | 'custom'>): string {
    let url = thumbCache.get(name)
    if (!url) {
        url = paintScene(name, 96, 96).toDataURL('image/png')
        thumbCache.set(name, url)
    }
    return url
}
