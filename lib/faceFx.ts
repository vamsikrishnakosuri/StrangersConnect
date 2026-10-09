// Fun face filters (bunny ears, big eyes...) drawn on the user's own device.
// Face tracking is Google's open-source MediaPipe, served from our own domain, so no
// video or images ever leave the browser for this.

import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FaceFx = 'bunny' | 'kitty' | 'bigeyes' | 'bignose' | 'shades'

let landmarkerPromise: Promise<FaceLandmarker> | null = null

export function loadFaceLandmarker(): Promise<FaceLandmarker> {
    if (!landmarkerPromise) {
        landmarkerPromise = (async () => {
            const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
            const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
            const make = (delegate: 'GPU' | 'CPU') =>
                FaceLandmarker.createFromOptions(fileset, {
                    baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                })
            try {
                return await make('GPU')
            } catch {
                return await make('CPU')
            }
        })()
        // Let a later attempt retry if loading failed
        landmarkerPromise.catch(() => {
            landmarkerPromise = null
        })
    }
    return landmarkerPromise
}

type P = { x: number; y: number }
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function drawFaceFx(
    ctx: CanvasRenderingContext2D,
    frame: HTMLCanvasElement,
    lm: NormalizedLandmark[],
    fx: FaceFx,
    scratch: HTMLCanvasElement,
) {
    const w = frame.width
    const h = frame.height
    const pt = (i: number): P => ({ x: lm[i].x * w, y: lm[i].y * h })

    const faceW = dist(pt(234), pt(454))
    const roll = Math.atan2(pt(263).y - pt(33).y, pt(263).x - pt(33).x)
    const along: P = { x: Math.cos(roll), y: Math.sin(roll) }
    const up: P = { x: Math.sin(roll), y: -Math.cos(roll) }
    const hasIris = lm.length > 477
    const eyeA = hasIris ? pt(468) : mid(pt(33), pt(133))
    const eyeB = hasIris ? pt(473) : mid(pt(362), pt(263))
    const eyeW = (dist(pt(33), pt(133)) + dist(pt(362), pt(263))) / 2
    const nose = pt(1)

    // Soft-edged magnifier: copy a smaller patch, scale it up, feather the rim
    const magnify = (c: P, r: number, k: number) => {
        const size = Math.ceil(r * 2)
        scratch.width = size
        scratch.height = size
        const s = scratch.getContext('2d')!
        s.drawImage(frame, c.x - r / k, c.y - r / k, (2 * r) / k, (2 * r) / k, 0, 0, size, size)
        s.globalCompositeOperation = 'destination-in'
        const g = s.createRadialGradient(r, r, r * 0.55, r, r, r)
        g.addColorStop(0, 'rgba(0,0,0,1)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        s.fillStyle = g
        s.fillRect(0, 0, size, size)
        s.globalCompositeOperation = 'source-over'
        ctx.drawImage(scratch, c.x - r, c.y - r)
    }

    const whiskers = (color: string) => {
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(1.5, faceW * 0.008)
        ctx.lineCap = 'round'
        for (const side of [-1, 1]) {
            for (const tilt of [-0.18, 0, 0.18]) {
                const start = { x: nose.x + along.x * side * faceW * 0.1, y: nose.y + along.y * side * faceW * 0.1 + faceW * 0.03 }
                const a = roll + (side < 0 ? Math.PI : 0) + tilt * side
                ctx.beginPath()
                ctx.moveTo(start.x, start.y)
                ctx.lineTo(start.x + Math.cos(a) * faceW * 0.3, start.y + Math.sin(a) * faceW * 0.3)
                ctx.stroke()
            }
        }
        ctx.restore()
    }

    // Two ears standing on the top of the head, following its tilt
    const ears = (draw: (rx: number, ry: number) => void, spread: number, lift: number) => {
        const top = pt(10)
        for (const side of [-1, 1]) {
            const base = {
                x: top.x + along.x * side * faceW * spread + up.x * faceW * lift,
                y: top.y + along.y * side * faceW * spread + up.y * faceW * lift,
            }
            ctx.save()
            ctx.translate(base.x, base.y)
            ctx.rotate(roll + side * 0.18)
            draw(faceW, side)
            ctx.restore()
        }
    }

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = faceW * 0.04

    switch (fx) {
        case 'bigeyes':
            ctx.shadowBlur = 0
            magnify(eyeA, eyeW * 1.05, 1.65)
            magnify(eyeB, eyeW * 1.05, 1.65)
            break

        case 'bignose':
            ctx.shadowBlur = 0
            magnify(nose, dist(pt(98), pt(327)) * 1.15, 1.8)
            break

        case 'bunny':
            ears((fw) => {
                const rx = fw * 0.11
                const ry = fw * 0.34
                ctx.beginPath()
                ctx.ellipse(0, -ry, rx, ry, 0, 0, Math.PI * 2)
                ctx.fillStyle = '#fbf8f3'
                ctx.fill()
                ctx.shadowBlur = 0
                ctx.beginPath()
                ctx.ellipse(0, -ry * 0.95, rx * 0.5, ry * 0.75, 0, 0, Math.PI * 2)
                ctx.fillStyle = '#f5b8c6'
                ctx.fill()
            }, 0.2, 0.02)
            ctx.shadowBlur = 0
            whiskers('rgba(255,255,255,0.9)')
            ctx.beginPath()
            ctx.ellipse(nose.x, nose.y, faceW * 0.045, faceW * 0.032, roll, 0, Math.PI * 2)
            ctx.fillStyle = '#f08ea6'
            ctx.fill()
            break

        case 'kitty':
            ears((fw) => {
                const b = fw * 0.17
                const hgt = fw * 0.3
                ctx.beginPath()
                ctx.moveTo(-b, 0)
                ctx.quadraticCurveTo(-b * 0.2, -hgt * 1.1, 0, -hgt)
                ctx.quadraticCurveTo(b * 0.2, -hgt * 1.1, b, 0)
                ctx.closePath()
                ctx.fillStyle = '#2a2a30'
                ctx.fill()
                ctx.shadowBlur = 0
                ctx.lineWidth = Math.max(1.5, fw * 0.008)
                ctx.strokeStyle = '#ece9e2'
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(-b * 0.5, -hgt * 0.12)
                ctx.lineTo(0, -hgt * 0.78)
                ctx.lineTo(b * 0.5, -hgt * 0.12)
                ctx.closePath()
                ctx.fillStyle = '#f5b8c6'
                ctx.fill()
            }, 0.24, 0.0)
            ctx.shadowBlur = 0
            whiskers('rgba(20,20,24,0.85)')
            ctx.save()
            ctx.translate(nose.x, nose.y)
            ctx.rotate(roll)
            ctx.beginPath()
            ctx.moveTo(-faceW * 0.04, -faceW * 0.015)
            ctx.lineTo(faceW * 0.04, -faceW * 0.015)
            ctx.lineTo(0, faceW * 0.03)
            ctx.closePath()
            ctx.fillStyle = '#1b1b20'
            ctx.fill()
            ctx.restore()
            break

        case 'shades': {
            const lensW = eyeW * 1.9
            const lensH = eyeW * 1.25
            for (const c of [eyeA, eyeB]) {
                ctx.save()
                ctx.translate(c.x, c.y)
                ctx.rotate(roll)
                ctx.beginPath()
                ctx.roundRect(-lensW / 2, -lensH / 2, lensW, lensH, lensH * 0.45)
                const g = ctx.createLinearGradient(0, -lensH / 2, 0, lensH / 2)
                g.addColorStop(0, 'rgba(40,40,46,0.96)')
                g.addColorStop(1, 'rgba(8,8,10,0.96)')
                ctx.fillStyle = g
                ctx.fill()
                ctx.shadowBlur = 0
                ctx.lineWidth = Math.max(1.5, eyeW * 0.08)
                ctx.strokeStyle = '#f2c14e'
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(-lensW * 0.28, -lensH * 0.22)
                ctx.lineTo(-lensW * 0.05, -lensH * 0.3)
                ctx.strokeStyle = 'rgba(255,255,255,0.45)'
                ctx.stroke()
                ctx.restore()
            }
            ctx.beginPath()
            ctx.moveTo(eyeA.x + along.x * lensW * 0.5, eyeA.y + along.y * lensW * 0.5)
            ctx.lineTo(eyeB.x - along.x * lensW * 0.5, eyeB.y - along.y * lensW * 0.5)
            ctx.lineWidth = Math.max(1.5, eyeW * 0.1)
            ctx.strokeStyle = '#f2c14e'
            ctx.stroke()
            break
        }
    }
    ctx.restore()
}
