'use client'

import { useEffect, useRef } from 'react'

// Two liquid-glass orbs, one holding a warm light (you) and one a cool light (someone new).
// They drift, reach toward each other, melt together for a moment with a spark where
// they meet, then part again. Ray-marched in a small WebGL shader, transparent so the
// gradient field behind shows through. The camera leans gently with the pointer.

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 res;
uniform float time;
uniform vec3 camPos;
uniform vec3 camU;
uniform vec3 camV;
uniform vec3 camW;
uniform vec3 orbA;
uniform vec3 orbB;
uniform float blend;
uniform float merge;
uniform vec3 sat0;
uniform vec3 sat1;
uniform vec3 sat2;

const float RA = 0.40;
const float RB = 0.37;
const float RS = 0.055;
const vec3 WARM = vec3(1.0, 0.72, 0.28);
const vec3 COOL = vec3(0.45, 0.92, 0.95);
const vec3 SPARK = vec3(1.0, 0.88, 0.62);

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}
float wobble(vec3 p) {
    return 0.012 * sin(6.0 * p.x + time * 1.1) * sin(5.0 * p.y - time * 0.9) * sin(6.0 * p.z + time * 0.7);
}
float orbs(vec3 p) {
    return smin(length(p - orbA) - RA, length(p - orbB) - RB, blend) + wobble(p);
}
float sats(vec3 p) {
    return min(length(p - sat0), min(length(p - sat1), length(p - sat2))) - RS;
}
vec2 map(vec3 p) {
    float a = orbs(p);
    float b = sats(p);
    return a < b ? vec2(a, 0.0) : vec2(b, 1.0);
}
vec3 normalAt(vec3 p) {
    const vec2 k = vec2(1.0, -1.0);
    const float e = 0.0015;
    return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x +
                     k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}

// A soft studio around the objects: dark floor, cool sky, one bright softbox
vec3 env(vec3 d) {
    vec3 c = mix(vec3(0.015, 0.02, 0.035), vec3(0.05, 0.15, 0.24), smoothstep(-0.4, 0.9, d.y));
    c += vec3(0.95, 0.97, 1.0) * smoothstep(0.93, 0.99, dot(d, normalize(vec3(-0.55, 0.75, 0.45)))) * 2.2;
    c += vec3(0.25, 0.8, 0.85) * smoothstep(0.75, 0.97, dot(d, normalize(vec3(0.9, 0.15, -0.2)))) * 0.8;
    c += vec3(0.95, 0.7, 0.3) * smoothstep(0.55, 1.0, dot(d, vec3(0.0, -1.0, 0.0))) * 0.18;
    return c;
}

// How close the view ray passes to a point: gives each core its light and halo
float glow(vec3 ro, vec3 rd, vec3 c, float k) {
    vec3 oc = c - ro;
    float t = max(dot(oc, rd), 0.0);
    vec3 d = oc - rd * t;
    return exp(-dot(d, d) * k);
}

vec3 tone(vec3 x) {
    return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
    vec3 ro = camPos;
    vec3 rd = normalize(uv.x * camU + uv.y * camV + 2.0 * camW);
    vec3 mid = mix(orbA, orbB, 0.5);

    // Halo light, drawn whether or not the ray hits glass
    vec3 halo = WARM * glow(ro, rd, orbA, 5.0) * 0.32 + COOL * glow(ro, rd, orbB, 5.0) * 0.26
              + SPARK * glow(ro, rd, mid, 9.0) * merge * 0.35;

    // Skip rays that cannot reach the objects
    float b = dot(ro, rd);
    float disc = b * b - dot(ro, ro) + 2.4;
    vec3 col = halo;
    float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    if (disc > 0.0) {
        float t = max(-b - sqrt(disc), 0.0);
        float tEnd = -b + sqrt(disc);
        vec2 h = vec2(1.0, 0.0);
        for (int i = 0; i < 80; i++) {
            h = map(ro + rd * t);
            if (h.x < 0.0008 * t || t > tEnd) break;
            t += h.x;
        }
        if (t < tEnd) {
            vec3 p = ro + rd * t;
            vec3 n = normalAt(p);
            float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.6);
            vec3 refl = env(reflect(rd, n));
            vec3 refr = env(refract(rd, n, 0.72));
            // Thin-film shimmer on the rim, kept faint
            vec3 film = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + vec3(0.0, 0.33, 0.67) + time * 0.03));
            float facing = max(dot(n, -rd), 0.0);
            float spec = pow(max(dot(reflect(rd, n), normalize(vec3(-0.55, 0.75, 0.45))), 0.0), 140.0);
            if (h.y < 0.5) {
                // Liquid glass: a clear body you see through, a small light inside, bright rims
                vec3 inner = WARM * glow(ro, rd, orbA, 30.0) * 0.85 + COOL * glow(ro, rd, orbB, 30.0) * 0.7
                           + SPARK * glow(ro, rd, mid, 60.0) * merge * 0.9;
                vec3 tint = mix(WARM, COOL, smoothstep(-0.25, 0.25, dot(p - mid, normalize(orbB - orbA))));
                col = refr * 0.22 + inner + tint * pow(facing, 4.0) * 0.06
                    + refl * (0.03 + 0.85 * fres) + film * fres * 0.18 + vec3(spec) * 1.4;
                alpha = clamp(0.42 + 0.58 * fres + max(inner.r, max(inner.g, inner.b)) + spec, 0.0, 1.0);
            } else {
                // Small glass beads
                col = refr * 0.25 + refl * (0.1 + 0.8 * fres) + COOL * 0.05 + film * fres * 0.12 + vec3(spec);
                alpha = clamp(0.5 + 0.5 * fres + spec, 0.0, 1.0);
            }
            col += halo * 0.4;
        }
    }
    col = tone(col * 1.1);
    gl_FragColor = vec4(col, alpha);
}
`

type V3 = [number, number, number]

const GREETINGS = ['hi', 'hola', 'bonjour', 'namaste', 'ciao', 'hallo', 'olá', 'merhaba', 'salut', 'hey']

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1
    return [a[0] / l, a[1] / l, a[2] / l]
}
const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
}

// The choreography, shared by the shader uniforms and the floating labels
function scene(s: number) {
    const apart = smooth(0, 1, 0.5 + 0.5 * Math.cos(s * 0.5))
    const sep = 0.34 + 0.58 * apart
    const a = s * 0.16
    const ca = Math.cos(a)
    const sa = Math.sin(a) * 0.55
    const orbA: V3 = [-sep * ca, 0.06 * Math.sin(s * 0.7), -sep * sa]
    const orbB: V3 = [sep * ca, -0.05 * Math.sin(s * 0.6 + 1), sep * sa]
    const merge = 1 - smooth(0.42, 0.7, sep)
    const sats: V3[] = [0, 1, 2].map((i) => {
        const t = s * (0.22 + i * 0.05) + i * 2.1
        const r = 1.15 + i * 0.12
        return [Math.cos(t) * r, Math.sin(t * 1.3 + i) * 0.35, Math.sin(t) * r * 0.6] as V3
    })
    return { orbA, orbB, merge, sats, blend: 0.18 + 0.16 * (1 - apart) }
}

function camera(yaw: number, pitch: number) {
    const dist = 3.45
    const pos: V3 = [Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist]
    const w = norm(sub([0, 0, 0], pos))
    const u = norm(cross(w, [0, 1, 0]))
    const v = cross(u, w)
    return { pos, u, v, w }
}

export function OrbsHero() {
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const youRef = useRef<HTMLSpanElement>(null)
    const themRef = useRef<HTMLSpanElement>(null)
    const hiRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const wrap = wrapRef.current
        const canvas = canvasRef.current
        if (!wrap || !canvas) return
        const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true })
        if (!gl) {
            wrap.dataset.fallback = 'true'
            return
        }
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        const compile = (type: number, src: string) => {
            const sh = gl.createShader(type)!
            gl.shaderSource(sh, src)
            gl.compileShader(sh)
            return sh
        }
        const prog = gl.createProgram()!
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            wrap.dataset.fallback = 'true'
            return
        }
        gl.useProgram(prog)
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const loc = gl.getAttribLocation(prog, 'p')
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
        const U = (n: string) => gl.getUniformLocation(prog, n)
        const u = {
            res: U('res'), time: U('time'), camPos: U('camPos'), camU: U('camU'), camV: U('camV'), camW: U('camW'),
            orbA: U('orbA'), orbB: U('orbB'), blend: U('blend'), merge: U('merge'), sat0: U('sat0'), sat1: U('sat1'), sat2: U('sat2'),
        }

        // Fewer pixels on small or slow devices; it is a soft scene, not a photo
        const coarse = window.matchMedia('(pointer: coarse)').matches
        let quality = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5)
        let W = 0
        let H = 0
        const resize = () => {
            const cw = wrap.clientWidth
            const ch = wrap.clientHeight
            const nw = Math.max(1, Math.round(cw * quality))
            const nh = Math.max(1, Math.round(ch * quality))
            if (nw === canvas.width && nh === canvas.height && cw === W && ch === H) return
            W = cw
            H = ch
            canvas.width = nw
            canvas.height = nh
            gl.viewport(0, 0, nw, nh)
            draw(performance.now())
        }

        const target = { x: 0, y: 0 }
        const lean = { x: 0, y: 0 }
        const onPointer = (e: PointerEvent) => {
            target.x = e.clientX / window.innerWidth - 0.5
            target.y = e.clientY / window.innerHeight - 0.5
        }
        window.addEventListener('pointermove', onPointer, { passive: true })

        let greet = 0
        let wasMerged = false
        const place = (el: HTMLElement | null, p: V3, cam: ReturnType<typeof camera>, lift: number, show: number) => {
            if (!el) return
            const d = sub(p, cam.pos)
            const z = dot(d, cam.w)
            const x = (dot(d, cam.u) / z) * 2
            const y = (dot(d, cam.v) / z) * 2
            const sx = W / 2 + x * H
            const sy = H / 2 - y * H - lift * (H / z) * 2
            el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`
            el.style.opacity = show.toFixed(2)
        }

        const start = performance.now()
        const draw = (now: number) => {
            const s = reduced ? 7 : (now - start) / 1000 + 2
            lean.x += (target.x - lean.x) * 0.04
            lean.y += (target.y - lean.y) * 0.04
            const idle = coarse ? Math.sin(s * 0.2) * 0.25 : 0
            const cam = camera(lean.x * 0.6 + idle, 0.12 - lean.y * 0.3)
            const sc = scene(s)

            gl.uniform2f(u.res, canvas.width, canvas.height)
            gl.uniform1f(u.time, s)
            gl.uniform3fv(u.camPos, cam.pos)
            gl.uniform3fv(u.camU, cam.u)
            gl.uniform3fv(u.camV, cam.v)
            gl.uniform3fv(u.camW, cam.w)
            gl.uniform3fv(u.orbA, sc.orbA)
            gl.uniform3fv(u.orbB, sc.orbB)
            gl.uniform1f(u.blend, sc.blend)
            gl.uniform1f(u.merge, sc.merge)
            gl.uniform3fv(u.sat0, sc.sats[0])
            gl.uniform3fv(u.sat1, sc.sats[1])
            gl.uniform3fv(u.sat2, sc.sats[2])
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

            // Labels ride above the orbs; a greeting appears where they meet
            const labels = 1 - smooth(0.02, 0.3, sc.merge)
            place(youRef.current, sc.orbA, cam, 0.5, labels)
            place(themRef.current, sc.orbB, cam, 0.47, labels)
            const merged = sc.merge > 0.7
            if (merged && !wasMerged && hiRef.current) {
                greet = (greet + 1) % GREETINGS.length
                hiRef.current.textContent = GREETINGS[greet]
            }
            wasMerged = merged
            const mid: V3 = [(sc.orbA[0] + sc.orbB[0]) / 2, (sc.orbA[1] + sc.orbB[1]) / 2, (sc.orbA[2] + sc.orbB[2]) / 2]
            place(hiRef.current, mid, cam, 0.55, smooth(0.6, 0.95, sc.merge))
        }

        const ro = new ResizeObserver(resize)
        ro.observe(wrap)
        resize()

        let visible = true
        const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
        io.observe(wrap)

        // If frames run slow, render fewer pixels
        let raf = 0
        let last = 0
        let slow = 0
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop)
            if (!visible || document.hidden) {
                last = now
                return
            }
            const dt = now - last
            last = now
            if (dt > 26 && dt < 200) slow++
            else if (slow > 0) slow--
            if (slow > 40 && quality > 0.6) {
                quality *= 0.8
                slow = 0
                W = 0
                resize()
            }
            draw(now)
        }
        if (reduced) draw(performance.now())
        else raf = requestAnimationFrame(loop)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            io.disconnect()
            window.removeEventListener('pointermove', onPointer)
        }
    }, [])

    return (
        <div
            ref={wrapRef}
            className="orbs-hero relative w-full aspect-[3/2] select-none"
            role="img"
            aria-label="Two glowing glass orbs, one warm and one cool, drift together, meet and say hello"
        >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            <span ref={youRef} className="orb-label">you</span>
            <span ref={themRef} className="orb-label">someone new</span>
            <span ref={hiRef} className="orb-hi">hi</span>
        </div>
    )
}
