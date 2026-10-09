'use client'

import { useEffect, useRef } from 'react'
import { landDots } from '@/lib/landDots'

// A slowly turning dotted globe. Blue-to-pink arcs connect people across the world,
// and each arrival says hello in the local language. Pure canvas, no libraries.

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

const BLUE = [124, 180, 255]
const PINK = [255, 143, 200]

const toVec = (lat: number, lon: number): V3 => {
    const la = (lat * Math.PI) / 180
    const lo = (lon * Math.PI) / 180
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
}

function slerp(a: V3, b: V3, t: number): V3 {
    const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    const om = Math.acos(dot)
    if (om < 1e-4) return a
    const s = Math.sin(om)
    const k1 = Math.sin((1 - t) * om) / s
    const k2 = Math.sin(t * om) / s
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2]
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
            R = Math.min(W, H) * 0.36
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(wrap)

        // Continents drawn as evenly spaced dots
        const ll = landDots()
        const dots: V3[] = []
        for (let i = 0; i < ll.length; i += 2) dots.push(toVec(ll[i], ll[i + 1]))
        const cities = CITIES.map((c) => ({ ...c, v: toVec(c.lat, c.lon) }))

        type Arc = { a: number; b: number; born: number }
        type Hello = { city: number; born: number; text: string }
        const arcs: Arc[] = []
        const hellos: Hello[] = []
        let lastSpawn = 0
        let yaw = -1.2
        const tilt = 0.32
        let pointer = { x: 0, y: 0 }
        let smooth = { x: 0, y: 0 }

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

        const spawnArc = (now: number) => {
            let a = Math.floor(Math.random() * cities.length)
            let b = Math.floor(Math.random() * cities.length)
            if (a === b) b = (b + 1) % cities.length
            // Prefer arcs that start on the visible side
            if (project(cities[a].v).z < 0) [a, b] = [b, a]
            arcs.push({ a, b, born: now })
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

            // Atmosphere: soft blue and pink light around the sphere
            const halo = ctx.createRadialGradient(W / 2, H / 2, R * 0.85, W / 2, H / 2, R * 1.45)
            halo.addColorStop(0, 'rgba(124,180,255,0.16)')
            halo.addColorStop(0.5, 'rgba(255,143,200,0.07)')
            halo.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = halo
            ctx.fillRect(0, 0, W, H)
            const body = ctx.createRadialGradient(W / 2 - R * 0.35, H / 2 - R * 0.4, R * 0.1, W / 2, H / 2, R)
            body.addColorStop(0, 'rgba(30,32,44,0.95)')
            body.addColorStop(1, 'rgba(14,14,18,0.95)')
            ctx.fillStyle = body
            ctx.beginPath()
            ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = 'rgba(236,233,226,0.12)'
            ctx.lineWidth = 1
            ctx.stroke()

            // Dots, brighter toward the viewer
            for (const d of dots) {
                const p = project(d)
                if (p.z < -0.15) continue
                const a = Math.max(0, p.z) * 0.7 + 0.08
                ctx.fillStyle = `rgba(236,233,226,${a})`
                const s = 1 + Math.max(0, p.z) * 1.2
                ctx.beginPath()
                ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2)
                ctx.fill()
            }

            // Cities
            for (const c of cities) {
                const p = project(c.v)
                if (p.z < 0.05) continue
                ctx.fillStyle = `rgba(242,193,78,${0.35 + p.z * 0.55})`
                ctx.beginPath()
                ctx.arc(p.x, p.y, 1.6 + p.z * 1.4, 0, Math.PI * 2)
                ctx.fill()
            }

            // New connection every so often
            if (now - lastSpawn > (reduced ? 2600 : 1100) && arcs.length < (reduced ? 3 : 7)) {
                spawnArc(now)
                lastSpawn = now
            }

            // Arcs: draw in, travel, fade
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
                const lift = 0.12 + dist * 0.16
                const STEPS = 40
                let prev: { x: number; y: number; z: number } | null = null
                for (let s = 0; s <= STEPS; s++) {
                    const t = s / STEPS
                    if (t < tail || t > head) {
                        prev = null
                        continue
                    }
                    const v = slerp(a, b, t)
                    const h = 1 + Math.sin(Math.PI * t) * lift
                    const p = project([v[0] * h, v[1] * h, v[2] * h])
                    if (prev && p.z > -0.25 && prev.z > -0.25) {
                        const c = BLUE.map((x, i) => Math.round(x + (PINK[i] - x) * t))
                        const alpha = Math.min(1, 0.25 + Math.max(0, p.z)) * (1 - tail * 0.6)
                        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`
                        ctx.lineWidth = 1.8
                        ctx.beginPath()
                        ctx.moveTo(prev.x, prev.y)
                        ctx.lineTo(p.x, p.y)
                        ctx.stroke()
                    }
                    prev = p
                }
                // Glowing head
                if (head < 1) {
                    const v = slerp(a, b, head)
                    const h = 1 + Math.sin(Math.PI * head) * lift
                    const p = project([v[0] * h, v[1] * h, v[2] * h])
                    if (p.z > -0.2) {
                        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9)
                        g.addColorStop(0, 'rgba(255,255,255,0.95)')
                        g.addColorStop(0.4, 'rgba(255,143,200,0.6)')
                        g.addColorStop(1, 'rgba(255,143,200,0)')
                        ctx.fillStyle = g
                        ctx.fillRect(p.x - 9, p.y - 9, 18, 18)
                    }
                } else if (!hellos.some((h) => h.city === arc.b && now - h.born < 2400)) {
                    // Arrival: say hello in the local language
                    if (!(arc as Arc & { greeted?: boolean }).greeted) {
                        ;(arc as Arc & { greeted?: boolean }).greeted = true
                        hellos.push({ city: arc.b, born: now, text: cities[arc.b].hi })
                    }
                }
            }

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
                const by = p.y - bh - 12 - rise
                ctx.globalAlpha = fade * Math.min(1, p.z + 0.3)
                ctx.fillStyle = 'rgba(19,19,22,0.92)'
                ctx.strokeStyle = 'rgba(255,143,200,0.7)'
                ctx.lineWidth = 1.2
                ctx.beginPath()
                ctx.roundRect(bx, by, bw, bh, 14)
                ctx.moveTo(p.x - 5, by + bh)
                ctx.lineTo(p.x, by + bh + 7)
                ctx.lineTo(p.x + 5, by + bh)
                ctx.fill()
                ctx.stroke()
                ctx.fillStyle = '#ece9e2'
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
