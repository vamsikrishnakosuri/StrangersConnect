'use client'

import { useEffect, useRef } from 'react'

// A slowly flowing gradient field in deep blue, teal and cyan, drawn by a small
// WebGL shader (domain-warped noise). The page's film grain sits on top of it.
// Rendered at reduced resolution: a soft gradient does not need sharp pixels.

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float time;
uniform vec2 mouse;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / res;
    vec2 p = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
    float t = time * 0.035;

    // Domain warping gives the slow, liquid flow
    vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 4.0));
    vec2 r = vec2(fbm(p * 1.8 + 3.0 * q + vec2(1.7, 9.2) + t * 1.3), fbm(p * 1.8 + 3.0 * q + vec2(8.3, 2.8) - t));
    float f = fbm(p * 1.6 + 2.5 * r + mouse * 0.25);

    vec3 base = vec3(0.043, 0.047, 0.063);
    vec3 deep = vec3(0.05, 0.13, 0.24);
    vec3 teal = vec3(0.09, 0.55, 0.55);
    vec3 cyan = vec3(0.40, 0.86, 0.95);

    vec3 col = mix(base, deep, smoothstep(0.25, 0.75, f));
    col = mix(col, teal, smoothstep(0.55, 0.95, f * length(q)) * 0.75);
    col = mix(col, cyan, smoothstep(0.78, 1.05, f * r.x) * 0.35);

    // Keep it dark and calm toward the edges and the bottom, brighter behind the globe
    float glow = smoothstep(1.2, 0.0, length(p - vec2(0.0, -0.25)));
    col *= 0.55 + 0.6 * glow;
    col = mix(base, col, smoothstep(0.0, 0.35, uv.y));

    // Fine dither so the gradient never bands
    col += (hash(gl_FragCoord.xy + time) - 0.5) * 0.02;
    gl_FragColor = vec4(col, 1.0);
}
`

export function NoiseField({ className = '' }: { className?: string }) {
    const ref = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
        if (!gl) return // the CSS fallback gradient behind it stays visible
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
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
        gl.useProgram(prog)

        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const loc = gl.getAttribLocation(prog, 'p')
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
        const uRes = gl.getUniformLocation(prog, 'res')
        const uTime = gl.getUniformLocation(prog, 'time')
        const uMouse = gl.getUniformLocation(prog, 'mouse')

        const SCALE = 0.5
        let w = 0
        let h = 0
        const resize = () => {
            const nw = Math.max(1, Math.round(canvas.clientWidth * SCALE))
            const nh = Math.max(1, Math.round(canvas.clientHeight * SCALE))
            if (nw === w && nh === h) return
            w = canvas.width = nw
            h = canvas.height = nh
            gl.viewport(0, 0, w, h)
            draw(performance.now())
        }

        let mouse = { x: 0, y: 0 }
        const smooth = { x: 0, y: 0 }
        const onMove = (e: PointerEvent) => {
            mouse = { x: e.clientX / window.innerWidth - 0.5, y: 0.5 - e.clientY / window.innerHeight }
        }
        window.addEventListener('pointermove', onMove, { passive: true })

        const start = performance.now() - Math.random() * 60000
        const draw = (now: number) => {
            smooth.x += (mouse.x - smooth.x) * 0.03
            smooth.y += (mouse.y - smooth.y) * 0.03
            gl.uniform2f(uRes, w, h)
            gl.uniform1f(uTime, (now - start) / 1000)
            gl.uniform2f(uMouse, smooth.x, smooth.y)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }

        const ro = new ResizeObserver(resize)
        ro.observe(canvas)
        resize()

        let visible = true
        const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
        io.observe(canvas)

        let raf = 0
        let last = 0
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop)
            // 30 fps is plenty for a slow gradient and saves battery
            if (!visible || document.hidden || now - last < 33) return
            last = now
            draw(now)
        }
        if (reduced) draw(performance.now())
        else raf = requestAnimationFrame(loop)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            io.disconnect()
            window.removeEventListener('pointermove', onMove)
        }
    }, [])

    return (
        <canvas
            ref={ref}
            aria-hidden="true"
            className={`h-full w-full ${className}`}
            style={{ background: 'radial-gradient(ellipse at 50% 70%, #0d2238 0%, #0b0c10 70%)' }}
        />
    )
}
