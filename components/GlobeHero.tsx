'use client'

import { useEffect, useRef } from 'react'
import { landDots } from '@/lib/landDots'

// A slowly turning dotted globe in cool blues and teals. Cities rise as thin glowing
// skylines, arcs connect people across the world, two satellites trace orbits, and
// each arrival ripples out and says hello in the local language. Pure canvas.

type V3 = [number, number, number]

const CITIES: { name: string; lat: number; lon: number; hi: string }[] = [
    { name: 'Hyderabad', lat: 17.4, lon: 78.5, hi: 'नमस्ते' },
    { name: 'New York', lat: 40.7, lon: -74, hi: 'hey!' },
    { name: 'San Francisco', lat: 37.8, lon: -122.4, hi: 'hi there' },
    { name: 'São Paulo', lat: -23.5, lon: -46.6, hi: 'olá!' },
    { name: 'Mexico City', lat: 19.4, lon: -99.1, hi: '¡hola!' },
    { name: 'London', lat: 51.5, lon: -0.1, hi: 'hello' },
    { name: 'Paris', lat: 48.9, lon: 2.4, hi: 'bonjour' },
    { name: 'Berlin', lat: 52.5, lon: 13.4, hi: 'hallo' },
    { name: 'Lagos', lat: 6.5, lon: 3.4, hi: 'bawo' },
    { name: 'Cairo', lat: 30, lon: 31.2, hi: 'مرحبا' },
    { name: 'Tokyo', lat: 35.7, lon: 139.7, hi: 'こんにちは' },
    { name: 'Seoul', lat: 37.6, lon: 127, hi: '안녕!' },
    { name: 'Shanghai', lat: 31.2, lon: 121.5, hi: '你好' },
    { name: 'Jakarta', lat: -6.2, lon: 106.8, hi: 'halo' },
    { name: 'Sydney', lat: -33.9, lon: 151.2, hi: "g'day" },
    { name: 'Istanbul', lat: 41, lon: 29, hi: 'merhaba' },
    { name: 'Moscow', lat: 55.8, lon: 37.6, hi: 'привет' },
    { name: 'Nairobi', lat: -1.3, lon: 36.8, hi: 'jambo' },
    { name: 'Toronto', lat: 43.7, lon: -79.4, hi: 'hey' },
    { name: 'Manila', lat: 14.6, lon: 121, hi: 'kumusta' },
]

// Cool palette: sky blue to cyan to teal
const BLUE = [124, 180, 255]
const CYAN = [103, 232, 249]
const TEAL = [94, 234, 212]

const toVec = (lat: number, lon: number): V3 => {
    const la = (lat * Math.PI) / 180
    const lo = (lon * Math.PI) / 180
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
}

const scale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k]
const norm = (v: V3): V3 => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1
    return [v[0] / l, v[1] / l, v[2] / l]
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

function slerp(a: V3, b: V3, t: number): V3 {
    const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    const om = Math.acos(dot)
    if (om < 1e-4) return a
    const s = Math.sin(om)
    const k1 = Math.sin((1 - t) * om) / s
    const k2 = Math.sin(t * om) / s
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2]
}

const mix = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t))

function seeded(seed: number) {
    return () => {
        seed = (seed * 16807) % 2147483647
        return (seed - 1) / 2147483646
    }
}

export function GlobeHero() {
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const wrap = wrapRef.current
        if (!canvas || !wrap) return
        const ctx = canvas.getContext('2d')!
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const fontFamily = getComputedStyle(document.body).fontFamily
        const serifFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-serif') || 'Georgia, serif'
        const rand = seeded(42)

        let W = 0
        let H = 0
        let R = 0
        let dpr = 1
        const resize = () => {
            dpr = Math.min(3, (window.devicePixelRatio || 1) * 1.6) // headroom for the scroll zoom
            W = wrap.clientWidth
            H = Math.round(W * 0.92)
            canvas.width = W * dpr
            canvas.height = H * dpr
            canvas.style.height = `${H}px`
            R = Math.min(W, H) * 0.34
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(wrap)

        // Continents as dots
        const ll = landDots()
        const dots: V3[] = []
        for (let i = 0; i < ll.length; i += 2) dots.push(toVec(ll[i], ll[i + 1]))

        // Each city gets a small skyline: a cluster of thin towers of different heights
        const cities = CITIES.map((c) => {
            const towers = Array.from({ length: 5 + Math.floor(rand() * 4) }, () => ({
                v: toVec(c.lat + (rand() - 0.5) * 2.2, c.lon + (rand() - 0.5) * 2.2),
                h: 0.04 + rand() * 0.1,
                phase: rand() * Math.PI * 2,
            }))
            return { ...c, v: toVec(c.lat, c.lon), towers }
        })

        // Faint stars around the globe
        const stars = Array.from({ length: 90 }, () => ({ x: rand(), y: rand(), r: 0.4 + rand() * 0.9, phase: rand() * Math.PI * 2 }))

        // Two tilted orbits, each with a satellite
        const orbits = [
            { tilt: 0.42, spin: 0.6, radius: 1.22, speed: 0.00022, color: CYAN },
            { tilt: -0.9, spin: 2.1, radius: 1.34, speed: -0.00016, color: BLUE },
        ].map((o) => {
            const n = norm([Math.sin(o.tilt) * Math.cos(o.spin), Math.cos(o.tilt), Math.sin(o.tilt) * Math.sin(o.spin)])
            const u = norm(cross(n, [0, 0, 1]))
            const w = cross(n, u)
            return { ...o, u, w }
        })

        type Arc = { a: number; b: number; born: number; greeted?: boolean }
        type Hello = { city: number; born: number; text: string }
        type Ripple = { city: number; born: number }
        const arcs: Arc[] = []
        const hellos: Hello[] = []
        const ripples: Ripple[] = []
        let lastSpawn = 0
        let yaw = -1.2
        const tilt = 0.32
        let pointer = { x: 0, y: 0 }
        const smooth = { x: 0, y: 0 }

        const onPointer = (e: PointerEvent) => {
            const r = wrap.getBoundingClientRect()
            pointer = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 }
        }
        wrap.addEventListener('pointermove', onPointer)

        const project = (v: V3): { x: number; y: number; z: number } => {
            const cy = Math.cos(yaw + smooth.x * 0.6)
            const sy = Math.sin(yaw + smooth.x * 0.6)
            const x1 = v[0] * cy + v[2] * sy
            const z1 = -v[0] * sy + v[2] * cy
            const t = tilt + smooth.y * 0.3
            const ct = Math.cos(t)
            const st = Math.sin(t)
            const y2 = v[1] * ct - z1 * st
            const z2 = v[1] * st + z1 * ct
            return { x: W / 2 + x1 * R, y: H / 2 - y2 * R, z: z2 }
        }

        // Orbits are not rotated with the earth: they sit still in space
        const projectSpace = (v: V3) => {
            const t = tilt * 0.5 + smooth.y * 0.2
            const y2 = v[1] * Math.cos(t) - v[2] * Math.sin(t)
            const z2 = v[1] * Math.sin(t) + v[2] * Math.cos(t)
            return { x: W / 2 + (v[0] + smooth.x * 0.05) * R, y: H / 2 - y2 * R, z: z2 }
        }

        const spawnArc = (now: number) => {
            let a = Math.floor(Math.random() * cities.length)
            let b = Math.floor(Math.random() * cities.length)
            if (a === b) b = (b + 1) % cities.length
            if (project(cities[a].v).z < 0) [a, b] = [b, a]
            arcs.push({ a, b, born: now })
        }

        const drawOrbit = (o: (typeof orbits)[number], now: number, front: boolean) => {
            const pts = []
            for (let k = 0; k <= 96; k++) {
                const ang = (k / 96) * Math.PI * 2
                const v: V3 = [
                    (o.u[0] * Math.cos(ang) + o.w[0] * Math.sin(ang)) * o.radius,
                    (o.u[1] * Math.cos(ang) + o.w[1] * Math.sin(ang)) * o.radius,
                    (o.u[2] * Math.cos(ang) + o.w[2] * Math.sin(ang)) * o.radius,
                ]
                pts.push(projectSpace(v))
            }
            ctx.lineWidth = 1
            for (let k = 1; k < pts.length; k++) {
                const isFront = pts[k].z >= 0
                if (isFront !== front) continue
                ctx.strokeStyle = `rgba(${o.color[0]},${o.color[1]},${o.color[2]},${front ? 0.32 : 0.1})`
                ctx.beginPath()
                ctx.moveTo(pts[k - 1].x, pts[k - 1].y)
                ctx.lineTo(pts[k].x, pts[k].y)
                ctx.stroke()
            }
            // Satellite
            const ang = now * o.speed * (reduced ? 0.3 : 1)
            const sv: V3 = [
                (o.u[0] * Math.cos(ang) + o.w[0] * Math.sin(ang)) * o.radius,
                (o.u[1] * Math.cos(ang) + o.w[1] * Math.sin(ang)) * o.radius,
                (o.u[2] * Math.cos(ang) + o.w[2] * Math.sin(ang)) * o.radius,
            ]
            const sp = projectSpace(sv)
            if ((sp.z >= 0) === front) {
                const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 8)
                g.addColorStop(0, `rgba(255,255,255,${front ? 0.95 : 0.4})`)
                g.addColorStop(0.35, `rgba(${o.color[0]},${o.color[1]},${o.color[2]},${front ? 0.6 : 0.2})`)
                g.addColorStop(1, 'rgba(0,0,0,0)')
                ctx.fillStyle = g
                ctx.fillRect(sp.x - 8, sp.y - 8, 16, 16)
            }
        }

        let raf = 0
        let visible = true
        const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
        io.observe(wrap)

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame)
            if (!visible || document.hidden) return
            render(now)
        }

        const render = (now: number) => {
            if (!reduced) {
                smooth.x += (pointer.x - smooth.x) * 0.05
                smooth.y += (pointer.y - smooth.y) * 0.05
            }
            // With Reduce Motion on, the globe still turns, just very slowly
            yaw += reduced ? 0.0005 : 0.0016

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, W, H)

            // Stars
            for (const s of stars) {
                const sx = s.x * W
                const sy = s.y * H
                if (Math.hypot(sx - W / 2, sy - H / 2) < R * 1.05) continue
                const tw = reduced ? 0.5 : 0.35 + 0.35 * Math.sin(now * 0.0012 + s.phase)
                ctx.fillStyle = `rgba(200,225,255,${tw * 0.6})`
                ctx.beginPath()
                ctx.arc(sx, sy, s.r, 0, Math.PI * 2)
                ctx.fill()
            }

            // Atmosphere: cool blue and teal glow
            const halo = ctx.createRadialGradient(W / 2, H / 2, R * 0.85, W / 2, H / 2, R * 1.5)
            halo.addColorStop(0, 'rgba(103,232,249,0.14)')
            halo.addColorStop(0.45, 'rgba(124,180,255,0.07)')
            halo.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = halo
            ctx.fillRect(0, 0, W, H)

            // Orbits behind the earth
            for (const o of orbits) drawOrbit(o, now, false)

            const body = ctx.createRadialGradient(W / 2 - R * 0.35, H / 2 - R * 0.4, R * 0.1, W / 2, H / 2, R)
            body.addColorStop(0, 'rgba(22,34,48,0.97)')
            body.addColorStop(1, 'rgba(10,14,20,0.97)')
            ctx.fillStyle = body
            ctx.beginPath()
            ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2)
            ctx.fill()
            // Thin rim light on the upper left
            const rim = ctx.createLinearGradient(W / 2 - R, H / 2 - R, W / 2 + R, H / 2 + R)
            rim.addColorStop(0, 'rgba(103,232,249,0.45)')
            rim.addColorStop(0.5, 'rgba(124,180,255,0.08)')
            rim.addColorStop(1, 'rgba(124,180,255,0.02)')
            ctx.strokeStyle = rim
            ctx.lineWidth = 1.2
            ctx.stroke()

            // Land dots, brighter toward the viewer
            for (const d of dots) {
                const p = project(d)
                if (p.z < -0.15) continue
                const a = Math.max(0, p.z) * 0.65 + 0.07
                ctx.fillStyle = `rgba(214,236,255,${a})`
                const s = 1 + Math.max(0, p.z) * 1.15
                ctx.beginPath()
                ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2)
                ctx.fill()
            }

            // City skylines: thin towers standing out from the surface
            for (const c of cities) {
                for (const t of c.towers) {
                    const base = project(t.v)
                    if (base.z < 0.08) continue
                    const breath = reduced ? 1 : 0.85 + 0.15 * Math.sin(now * 0.0015 + t.phase)
                    const top = project(scale(t.v, 1 + t.h * breath))
                    const col = mix(BLUE, CYAN, (t.h - 0.04) / 0.1)
                    const g = ctx.createLinearGradient(base.x, base.y, top.x, top.y)
                    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.15 * base.z})`)
                    g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},${0.95 * base.z})`)
                    ctx.strokeStyle = g
                    ctx.lineWidth = 2
                    ctx.beginPath()
                    ctx.moveTo(base.x, base.y)
                    ctx.lineTo(top.x, top.y)
                    ctx.stroke()
                    ctx.fillStyle = `rgba(230,250,255,${0.85 * base.z})`
                    ctx.fillRect(top.x - 0.9, top.y - 0.9, 1.8, 1.8)
                }
            }

            if (now - lastSpawn > (reduced ? 2600 : 1100) && arcs.length < (reduced ? 3 : 7)) {
                spawnArc(now)
                lastSpawn = now
            }

            // Arcs: draw in, travel, fade (blue to teal)
            const LIFE = 3800
            for (let k = arcs.length - 1; k >= 0; k--) {
                const arc = arcs[k]
                const age = (now - arc.born) / LIFE
                if (age >= 1) {
                    arcs.splice(k, 1)
                    continue
                }
                const a = cities[arc.a].v
                const b = cities[arc.b].v
                const head = Math.min(1, age / 0.45)
                const tail = Math.max(0, (age - 0.55) / 0.45)
                const dist = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
                const lift = 0.14 + dist * 0.16
                const STEPS = 44
                let prev: { x: number; y: number; z: number } | null = null
                for (let s = 0; s <= STEPS; s++) {
                    const t = s / STEPS
                    if (t < tail || t > head) {
                        prev = null
                        continue
                    }
                    const v = slerp(a, b, t)
                    const p = project(scale(v, 1 + Math.sin(Math.PI * t) * lift))
                    if (prev && p.z > -0.25 && prev.z > -0.25) {
                        const c = mix(BLUE, TEAL, t)
                        const alpha = Math.min(1, 0.25 + Math.max(0, p.z)) * (1 - tail * 0.6)
                        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`
                        ctx.lineWidth = 1.7
                        ctx.beginPath()
                        ctx.moveTo(prev.x, prev.y)
                        ctx.lineTo(p.x, p.y)
                        ctx.stroke()
                    }
                    prev = p
                }
                if (head < 1) {
                    const v = slerp(a, b, head)
                    const p = project(scale(v, 1 + Math.sin(Math.PI * head) * lift))
                    if (p.z > -0.2) {
                        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9)
                        g.addColorStop(0, 'rgba(255,255,255,0.95)')
                        g.addColorStop(0.4, 'rgba(103,232,249,0.6)')
                        g.addColorStop(1, 'rgba(103,232,249,0)')
                        ctx.fillStyle = g
                        ctx.fillRect(p.x - 9, p.y - 9, 18, 18)
                    }
                } else if (!arc.greeted) {
                    // Arrival: a ripple on the surface and a hello in the local language
                    arc.greeted = true
                    ripples.push({ city: arc.b, born: now })
                    if (!hellos.some((h) => h.city === arc.b && now - h.born < 2400)) {
                        hellos.push({ city: arc.b, born: now, text: cities[arc.b].hi })
                    }
                }
            }

            // Ripples: a ring spreading out across the surface
            for (let k = ripples.length - 1; k >= 0; k--) {
                const rp = ripples[k]
                const age = (now - rp.born) / 1400
                if (age >= 1) {
                    ripples.splice(k, 1)
                    continue
                }
                const c = cities[rp.city].v
                const tA = norm(cross(c, [0, 1, 0]))
                const tB = cross(c, tA)
                const ang = 0.02 + age * 0.13
                ctx.strokeStyle = `rgba(103,232,249,${(1 - age) * 0.7})`
                ctx.lineWidth = 1.2
                ctx.beginPath()
                let started = false
                for (let s = 0; s <= 32; s++) {
                    const th = (s / 32) * Math.PI * 2
                    const v = norm([
                        c[0] * Math.cos(ang) + (tA[0] * Math.cos(th) + tB[0] * Math.sin(th)) * Math.sin(ang),
                        c[1] * Math.cos(ang) + (tA[1] * Math.cos(th) + tB[1] * Math.sin(th)) * Math.sin(ang),
                        c[2] * Math.cos(ang) + (tA[2] * Math.cos(th) + tB[2] * Math.sin(th)) * Math.sin(ang),
                    ])
                    const p = project(v)
                    if (p.z < 0) {
                        started = false
                        continue
                    }
                    if (!started) {
                        ctx.moveTo(p.x, p.y)
                        started = true
                    } else ctx.lineTo(p.x, p.y)
                }
                ctx.stroke()
            }

            // Orbits in front of the earth
            for (const o of orbits) drawOrbit(o, now, true)

            // Greeting bubbles
            for (let k = hellos.length - 1; k >= 0; k--) {
                const h = hellos[k]
                const age = (now - h.born) / 2400
                if (age >= 1) {
                    hellos.splice(k, 1)
                    continue
                }
                const p = project(cities[h.city].v)
                if (p.z < 0.1) continue
                const fade = age < 0.15 ? age / 0.15 : age > 0.75 ? (1 - age) / 0.25 : 1
                const rise = age * 14
                ctx.font = `italic 15px ${serifFamily}, ${fontFamily}`
                const tw = ctx.measureText(h.text).width
                const bw = tw + 22
                const bh = 28
                const bx = p.x - bw / 2
                const by = p.y - bh - 18 - rise
                ctx.globalAlpha = fade * Math.min(1, p.z + 0.3)
                ctx.fillStyle = 'rgba(12,18,26,0.92)'
                ctx.strokeStyle = 'rgba(103,232,249,0.65)'
                ctx.lineWidth = 1.1
                ctx.beginPath()
                ctx.roundRect(bx, by, bw, bh, 14)
                ctx.moveTo(p.x - 5, by + bh)
                ctx.lineTo(p.x, by + bh + 7)
                ctx.lineTo(p.x + 5, by + bh)
                ctx.fill()
                ctx.stroke()
                ctx.fillStyle = '#e6f4ff'
                ctx.textBaseline = 'middle'
                ctx.fillText(h.text, bx + 11, by + bh / 2 + 1)
                ctx.globalAlpha = 1
            }
        }

        raf = requestAnimationFrame(frame)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            io.disconnect()
            wrap.removeEventListener('pointermove', onPointer)
        }
    }, [])

    return (
        <div ref={wrapRef} className="relative w-full select-none" aria-label="A globe with people connecting and saying hello in different languages" role="img">
            <canvas ref={canvasRef} className="block w-full" />
        </div>
    )
}
