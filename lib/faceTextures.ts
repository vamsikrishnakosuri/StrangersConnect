// Face paints drawn in the face mesh's texture space. Because they are painted
// against landmark UVs, they wrap onto the 3D face and follow every head turn.
// Everything is generated in code: no image assets, nothing to license.

import { FACE_TRIANGLES, FACE_UVS } from './faceMesh'

export type PaintName = 'neon' | 'tiger' | 'glam' | 'skull'

const S = 1024

const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
const LIPS_OUT = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
const LIPS_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
const EYE_R = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]
const EYE_L = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]
const BROW_R = [70, 63, 105, 66, 107]
const BROW_L = [300, 293, 334, 296, 336]

type XY = [number, number]
const uv = (i: number): XY => [FACE_UVS[i * 2] * S, (1 - FACE_UVS[i * 2 + 1]) * S]
const centroid = (ids: number[]): XY => {
    const pts = ids.map(uv)
    return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
}

function path(ctx: CanvasRenderingContext2D, ids: number[], scale = 1, close = true) {
    const c = centroid(ids)
    ctx.beginPath()
    ids.forEach((id, k) => {
        const [x, y] = uv(id)
        const px = c[0] + (x - c[0]) * scale
        const py = c[1] + (y - c[1]) * scale
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
    })
    if (close) ctx.closePath()
}

// Small deterministic random so a paint looks the same every time
function seeded(seed: number) {
    return () => {
        seed = (seed * 16807) % 2147483647
        return (seed - 1) / 2147483646
    }
}

function cutOpenings(ctx: CanvasRenderingContext2D, mouth = true) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    for (const eye of [EYE_R, EYE_L]) {
        path(ctx, eye, 1.05)
        ctx.fill()
    }
    if (mouth) {
        path(ctx, LIPS_IN)
        ctx.fill()
    }
    ctx.restore()
}

export function paintFaceTexture(name: PaintName): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = S
    canvas.height = S
    const ctx = canvas.getContext('2d')!
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const rand = seeded(7)

    if (name === 'neon') {
        // Fine mesh lines with glowing contours, in the brand's line-art style
        ctx.strokeStyle = 'rgba(236,233,226,0.28)'
        ctx.lineWidth = 1.4
        for (let t = 0; t < FACE_TRIANGLES.length; t += 3) {
            const a = uv(FACE_TRIANGLES[t])
            const b = uv(FACE_TRIANGLES[t + 1])
            const c = uv(FACE_TRIANGLES[t + 2])
            ctx.beginPath()
            ctx.moveTo(a[0], a[1])
            ctx.lineTo(b[0], b[1])
            ctx.lineTo(c[0], c[1])
            ctx.closePath()
            ctx.stroke()
        }
        ctx.shadowColor = '#f2c14e'
        ctx.shadowBlur = 18
        ctx.strokeStyle = '#f6d488'
        ctx.lineWidth = 5
        for (const loop of [OVAL, EYE_R, EYE_L, LIPS_OUT]) {
            path(ctx, loop)
            ctx.stroke()
        }
        for (const brow of [BROW_R, BROW_L]) {
            path(ctx, brow, 1, false)
            ctx.stroke()
        }
        return canvas
    }

    if (name === 'tiger') {
        path(ctx, OVAL)
        ctx.save()
        ctx.clip()
        ctx.fillStyle = 'rgba(234,128,38,0.78)'
        ctx.fillRect(0, 0, S, S)
        // White muzzle and cheeks
        ctx.fillStyle = 'rgba(255,250,240,0.88)'
        ctx.shadowColor = 'rgba(255,250,240,0.9)'
        ctx.shadowBlur = 40
        for (const id of [205, 425, 18, 200]) {
            const [x, y] = uv(id)
            ctx.beginPath()
            ctx.arc(x, y, id === 18 || id === 200 ? 70 : 85, 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.shadowBlur = 0
        // Tapered stripes reaching in from the edge of the face
        const center = uv(168)
        ctx.fillStyle = 'rgba(28,18,12,0.92)'
        OVAL.forEach((id, k) => {
            if (k % 2 === 1 || (k > 12 && k < 24)) return // skip chin area
            const [x, y] = uv(id)
            const dx = center[0] - x
            const dy = center[1] - y
            const len = 0.28 + rand() * 0.14
            const nx = -dy * 0.06
            const ny = dx * 0.06
            ctx.beginPath()
            ctx.moveTo(x + nx, y + ny)
            ctx.quadraticCurveTo(x + dx * len * 0.5 + nx * 0.4 + dy * 0.05, y + dy * len * 0.5 + ny * 0.4 - dx * 0.05, x + dx * len, y + dy * len)
            ctx.quadraticCurveTo(x + dx * len * 0.5 - nx * 0.4 + dy * 0.05, y + dy * len * 0.5 - ny * 0.4 - dx * 0.05, x - nx, y - ny)
            ctx.closePath()
            ctx.fill()
        })
        ctx.restore()
        // Nose
        ctx.fillStyle = 'rgba(20,14,10,0.95)'
        path(ctx, [98, 4, 327, 2])
        ctx.fill()
        cutOpenings(ctx)
        return canvas
    }

    if (name === 'glam') {
        // Blush
        for (const id of [50, 280]) {
            const [x, y] = uv(id)
            const g = ctx.createRadialGradient(x, y, 0, x, y, 120)
            g.addColorStop(0, 'rgba(240,120,150,0.5)')
            g.addColorStop(1, 'rgba(240,120,150,0)')
            ctx.fillStyle = g
            ctx.fillRect(x - 130, y - 130, 260, 260)
        }
        // Shimmer between eyes and brows
        for (const [eye, brow] of [[EYE_R, BROW_R], [EYE_L, BROW_L]] as const) {
            const e = centroid(eye)
            const b = centroid(brow)
            const g = ctx.createRadialGradient((e[0] + b[0]) / 2, (e[1] + b[1]) / 2, 0, (e[0] + b[0]) / 2, (e[1] + b[1]) / 2, 75)
            g.addColorStop(0, 'rgba(242,193,78,0.42)')
            g.addColorStop(1, 'rgba(242,193,78,0)')
            ctx.fillStyle = g
            ctx.fillRect(0, 0, S, S)
        }
        // Freckles across the nose and cheeks
        const nose = uv(195)
        ctx.fillStyle = 'rgba(120,70,45,0.55)'
        for (let k = 0; k < 70; k++) {
            const a = rand() * Math.PI * 2
            const r = Math.sqrt(rand()) * 150
            const x = nose[0] + Math.cos(a) * r * 1.6
            const y = nose[1] + Math.sin(a) * r * 0.55
            ctx.beginPath()
            ctx.arc(x, y, 2 + rand() * 3, 0, Math.PI * 2)
            ctx.fill()
        }
        // Sparkles on the cheekbones
        ctx.fillStyle = 'rgba(255,240,200,0.95)'
        ctx.shadowColor = '#f2c14e'
        ctx.shadowBlur = 10
        for (const id of [116, 345, 117, 346]) {
            const [x, y] = uv(id)
            const s = 10 + rand() * 6
            ctx.beginPath()
            ctx.moveTo(x, y - s)
            ctx.quadraticCurveTo(x, y, x + s, y)
            ctx.quadraticCurveTo(x, y, x, y + s)
            ctx.quadraticCurveTo(x, y, x - s, y)
            ctx.quadraticCurveTo(x, y, x, y - s)
            ctx.fill()
        }
        ctx.shadowBlur = 0
        // Lip tint (outer lips minus the mouth opening)
        ctx.fillStyle = 'rgba(196,40,84,0.5)'
        path(ctx, LIPS_OUT)
        ctx.fill()
        cutOpenings(ctx)
        return canvas
    }

    // skull
    path(ctx, OVAL)
    ctx.save()
    ctx.clip()
    const c = uv(6)
    const g = ctx.createRadialGradient(c[0], c[1], 60, c[0], c[1], 520)
    g.addColorStop(0, 'rgba(248,246,240,0.95)')
    g.addColorStop(1, 'rgba(150,148,145,0.95)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    ctx.restore()
    // Sockets
    ctx.fillStyle = 'rgba(12,12,14,0.96)'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 30
    for (const eye of [EYE_R, EYE_L]) {
        path(ctx, eye, 1.9)
        ctx.fill()
    }
    // Nose hole
    path(ctx, [98, 6, 327, 2], 1.1)
    ctx.fill()
    ctx.shadowBlur = 0
    // Stitched mouth
    ctx.strokeStyle = 'rgba(12,12,14,0.95)'
    ctx.lineWidth = 6
    path(ctx, LIPS_IN)
    ctx.stroke()
    const left = uv(61)
    const right = uv(291)
    for (let k = 1; k < 10; k++) {
        const x = left[0] + ((right[0] - left[0]) * k) / 10
        const y = left[1] + ((right[1] - left[1]) * k) / 10
        ctx.beginPath()
        ctx.moveTo(x, y - 26)
        ctx.lineTo(x, y + 26)
        ctx.stroke()
    }
    cutOpenings(ctx)
    return canvas
}
