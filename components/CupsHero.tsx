'use client'

import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './Logo'

// The logo, built in 3D: two paper-cup telephones whose string traces the S.
// Someone says hi into the top cup, the word runs down the string as a warm light,
// and the person at the other end hears it with the cup to their ear.
// three.js is loaded only when this scene mounts.

const GREETINGS = ['hi', 'hola', 'bonjour', 'namaste', 'ciao', 'hallo', 'olá', 'merhaba', 'salut', 'hey', 'konnichiwa', 'jambo']
const CYCLE = 7

// Logo coordinates (32 x 32, y down) to scene units (y up, centred)
const S = (x: number, y: number): [number, number] => [(x - 16) / 8, -(y - 16) / 8]

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const bump = (x: number, a: number, b: number, c: number, d: number) => ease((x - a) / (b - a)) * (1 - ease((x - c) / (d - c)))

export function CupsHero() {
    const wrapRef = useRef<HTMLDivElement>(null)
    const hiRef = useRef<HTMLSpanElement>(null)
    const youRef = useRef<HTMLSpanElement>(null)
    const themRef = useRef<HTMLSpanElement>(null)
    const [fallback, setFallback] = useState(false)

    useEffect(() => {
        const wrap = wrapRef.current
        if (!wrap) return
        let disposed = false
        let cleanup = () => {}

        ;(async () => {
            const THREE = await import('three')
            if (disposed) return
            let renderer: InstanceType<typeof THREE.WebGLRenderer>
            try {
                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
            } catch {
                setFallback(true)
                return
            }
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            const coarse = window.matchMedia('(pointer: coarse)').matches
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2))
            renderer.outputColorSpace = THREE.SRGBColorSpace
            renderer.toneMapping = THREE.ACESFilmicToneMapping
            renderer.toneMappingExposure = 1.05
            const canvas = renderer.domElement
            canvas.className = 'absolute inset-0 h-full w-full'
            wrap.prepend(canvas)

            const scene = new THREE.Scene()
            const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
            camera.position.set(0, 0, 9.2)

            // Studio light: cool sky, warm floor bounce, one soft key, a teal rim
            scene.add(new THREE.HemisphereLight(0x9fc4dc, 0x2a2118, 0.9))
            const key = new THREE.DirectionalLight(0xfff6ea, 2.1)
            key.position.set(-3, 4, 5)
            scene.add(key)
            const rim = new THREE.DirectionalLight(0x5fd6dc, 1.4)
            rim.position.set(4, -1, -4)
            scene.add(rim)
            const spark = new THREE.PointLight(0xffc35a, 0, 2.2, 1.6)
            scene.add(spark)

            const AMBER = new THREE.Color(0xf2c14e)
            const PAPER = 0xece9e2
            const world = new THREE.Group()
            scene.add(world)
            const disposables: { dispose: () => void }[] = []
            const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x)

            // Paper cup: an open cone with a rolled rim and a thin amber band
            const makeCup = (base: [number, number], dir: 1 | -1) => {
                const r0 = 0.25
                const r1 = 0.46
                const L = 1.125
                const mat = keep(new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, emissive: AMBER, emissiveIntensity: 0 }))
                const g = new THREE.Group()
                g.add(new THREE.Mesh(keep(new THREE.LatheGeometry([new THREE.Vector2(r0, 0), new THREE.Vector2(r1, L)], 64)), mat))
                const bottom = new THREE.Mesh(keep(new THREE.CircleGeometry(r0, 48)), mat)
                bottom.rotation.x = Math.PI / 2
                g.add(bottom)
                const rimRing = new THREE.Mesh(keep(new THREE.TorusGeometry(r1, 0.022, 12, 72)), mat)
                rimRing.rotation.x = Math.PI / 2
                rimRing.position.y = L
                g.add(rimRing)
                const bandMat = keep(new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6, emissive: AMBER, emissiveIntensity: 0.15 }))
                const band = new THREE.Mesh(keep(new THREE.TorusGeometry(r0 + (r1 - r0) * 0.78, 0.012, 8, 72)), bandMat)
                band.rotation.x = Math.PI / 2
                band.position.y = L * 0.78
                g.add(band)
                g.rotation.z = dir === 1 ? -Math.PI / 2 : Math.PI / 2
                g.position.set(base[0], base[1], 0)
                world.add(g)
                return { group: g, mat }
            }
            const topCup = makeCup(S(14.2, 8), 1)
            const bottomCup = makeCup(S(17.8, 24), -1)

            // The string follows the S in the logo, with a little depth so it reads in 3D
            const pts2: [number, number][] = []
            const line = (a: [number, number], b: [number, number], n: number) => {
                for (let i = 0; i < n; i++) pts2.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])
            }
            const cubic = (p0: number[], p1: number[], p2: number[], p3: number[], n: number) => {
                for (let i = 0; i < n; i++) {
                    const t = i / n
                    const m = 1 - t
                    pts2.push([
                        m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
                        m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
                    ])
                }
            }
            line([14.2, 8], [10.8, 8], 6)
            cubic([10.8, 8], [7.4, 8], [6.6, 12], [9, 13.6], 18)
            line([9, 13.6], [23, 18.4], 16)
            cubic([23, 18.4], [25.4, 20], [24.6, 24], [21.2, 24], 18)
            line([21.2, 24], [17.8, 24], 6)
            pts2.push([17.8, 24])
            const pts3 = pts2.map(([x, y], i) => {
                const [sx, sy] = S(x, y)
                return new THREE.Vector3(sx, sy, Math.sin((i / (pts2.length - 1)) * Math.PI) * 0.28)
            })
            const curve = new THREE.CatmullRomCurve3(pts3, false, 'centripetal')
            const stringMat = keep(
                new THREE.ShaderMaterial({
                    uniforms: { progress: { value: 0 }, on: { value: 0 }, time: { value: 0 }, base: { value: new THREE.Color(0xcfcac0) }, glowC: { value: AMBER.clone() } },
                    vertexShader: `
                        uniform float progress, on, time;
                        varying float vU;
                        void main() {
                            vU = uv.x;
                            float d = uv.x - progress;
                            vec3 p = position + normal * on * 0.012 * exp(-d * d * 160.0) * sin(uv.x * 70.0 - time * 18.0);
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                        }`,
                    fragmentShader: `
                        uniform float progress, on;
                        uniform vec3 base, glowC;
                        varying float vU;
                        void main() {
                            float d = vU - progress;
                            float head = exp(-d * d * 1200.0);
                            float trail = d < 0.0 ? exp(d * 22.0) * 0.45 : 0.0;
                            gl_FragColor = vec4(base * 0.55 + glowC * (head * 2.4 + trail) * on, 1.0);
                        }`,
                }),
            )
            world.add(new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 360, 0.014, 8, false)), stringMat))

            // Soft glow sprite for the travelling word
            const glowTex = (() => {
                const c = document.createElement('canvas')
                c.width = c.height = 64
                const x = c.getContext('2d')!
                const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
                gr.addColorStop(0, 'rgba(255,230,170,1)')
                gr.addColorStop(0.25, 'rgba(242,193,78,0.55)')
                gr.addColorStop(1, 'rgba(242,193,78,0)')
                x.fillStyle = gr
                x.fillRect(0, 0, 64, 64)
                return keep(new THREE.CanvasTexture(c))
            })()
            const bead = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })))
            bead.scale.setScalar(0.32)
            world.add(bead)

            // Line-art people, drawn as thin tubes in the site's paper colour
            const inkMat = keep(new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.7, emissive: AMBER, emissiveIntensity: 0 }))
            const earMat = keep(new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.7, emissive: AMBER, emissiveIntensity: 0 }))
            const stroke = (group: InstanceType<typeof THREE.Group>, pts: [number, number][], r = 0.02, mat = inkMat, closed = false) => {
                const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), closed, 'centripetal')
                group.add(new THREE.Mesh(keep(new THREE.TubeGeometry(c, 96, r, 8, closed)), mat))
            }
            const k = 0.9
            // You: a profile facing the top cup, speaking into it
            const you = new THREE.Group()
            stroke(you, [[0.36, 0.5], [0.05, 0.62], [-0.27, 0.48], [-0.35, 0.24], [-0.47, 0.06], [-0.36, -0.02], [-0.4, -0.11], [-0.33, -0.16], [-0.39, -0.22], [-0.3, -0.38], [-0.06, -0.46], [-0.02, -0.68]])
            stroke(you, [[0.36, 0.5], [0.44, 0.18], [0.32, -0.28], [0.26, -0.68]])
            stroke(you, [[-0.02, -0.7], [-0.32, -0.8], [-0.52, -0.98]])
            stroke(you, [[0.26, -0.7], [0.52, -0.78], [0.7, -0.98]])
            stroke(you, [[-0.23, 0.17], [-0.18, 0.21], [-0.13, 0.17]], 0.014)
            you.scale.setScalar(k)
            const [tmx, tmy] = S(23.2, 8)
            you.position.set(tmx + 0.18 + 0.36 * k, tmy + 0.16 * k, 0)
            world.add(you)
            // Someone new: facing you, eyes closed, cup held to the ear
            const them = new THREE.Group()
            const oval: [number, number][] = []
            for (let i = 0; i < 24; i++) {
                const a = (i / 24) * Math.PI * 2
                oval.push([Math.cos(a) * 0.35, Math.sin(a) * 0.45 + 0.02])
            }
            stroke(them, oval, 0.02, inkMat, true)
            stroke(them, [[0.33, 0.12], [0.45, 0.15], [0.49, 0.02], [0.45, -0.12], [0.34, -0.14]], 0.02, earMat)
            stroke(them, [[-0.21, 0.06], [-0.14, 0.01], [-0.07, 0.06]], 0.014)
            stroke(them, [[0.07, 0.06], [0.14, 0.01], [0.21, 0.06]], 0.014)
            stroke(them, [[-0.09, -0.2], [0, -0.25], [0.09, -0.2]], 0.014)
            stroke(them, [[-0.12, -0.42], [-0.14, -0.66], [-0.4, -0.76], [-0.62, -0.98]])
            stroke(them, [[0.12, -0.42], [0.14, -0.66], [0.4, -0.76], [0.62, -0.98]])
            them.scale.setScalar(k)
            const [bmx, bmy] = S(8.8, 24)
            them.position.set(bmx - 0.06 - 0.47 * k, bmy, 0)
            world.add(them)

            // Sound rings: into the top cup when you speak, out of the bottom cup into the ear
            const ringGeo = keep(new THREE.RingGeometry(0.94, 1, 64))
            const makeRing = () => {
                const m = new THREE.Mesh(ringGeo, keep(new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })))
                m.rotation.y = Math.PI / 2
                world.add(m)
                return m
            }
            const speakRings = [0, 1, 2].map(makeRing)
            const hearRings = [0, 1, 2].map(makeRing)

            // Sizing: keep the whole drawing in frame at any width
            const fit = () => {
                const w = wrap.clientWidth
                const h = wrap.clientHeight
                if (!w || !h) return
                renderer.setSize(w, h, false)
                camera.aspect = w / h
                const needW = 4.15
                const needH = 4.15
                const vFov = (camera.fov * Math.PI) / 180
                const distH = needH / 2 / Math.tan(vFov / 2)
                const distW = needW / 2 / (Math.tan(vFov / 2) * camera.aspect)
                camera.position.z = Math.max(distH, distW)
                camera.updateProjectionMatrix()
                render(performance.now())
            }

            const target = { x: 0, y: 0 }
            const lean = { x: 0, y: 0 }
            const onPointer = (e: PointerEvent) => {
                target.x = e.clientX / window.innerWidth - 0.5
                target.y = e.clientY / window.innerHeight - 0.5
            }
            window.addEventListener('pointermove', onPointer, { passive: true })

            const v = new THREE.Vector3()
            const place = (el: HTMLElement | null, x: number, y: number, z: number, show: number) => {
                if (!el) return
                v.set(x, y, z).applyMatrix4(world.matrixWorld).project(camera)
                const sx = ((v.x + 1) / 2) * wrap.clientWidth
                const sy = ((1 - v.y) / 2) * wrap.clientHeight
                el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`
                el.style.opacity = show.toFixed(2)
            }

            let lastCycle = -1
            const start = performance.now()
            const p = new THREE.Vector3()
            const render = (now: number) => {
                const t = reduced ? 2.6 : (now - start) / 1000 + 0.4
                const c = t % CYCLE
                const n = Math.floor(t / CYCLE)
                if (n !== lastCycle && hiRef.current) {
                    lastCycle = n
                    hiRef.current.textContent = GREETINGS[n % GREETINGS.length]
                }

                lean.x += (target.x - lean.x) * 0.05
                lean.y += (target.y - lean.y) * 0.05
                const idle = reduced ? 0 : Math.sin(t * 0.35) * (coarse ? 0.22 : 0.1)
                world.rotation.y = lean.x * 0.45 + idle
                world.rotation.x = lean.y * 0.18 + 0.04
                world.position.y = 0.14 + (reduced ? 0 : Math.sin(t * 0.8) * 0.03)

                // 1. You speak: rings flow into the top cup
                const speak = bump(c, 0, 0.3, 1.3, 1.7)
                speakRings.forEach((r, i) => {
                    const f = ((c * 1.6 + i / 3) % 1)
                    r.position.set(tmx + 0.2 - f * 0.25, tmy, 0)
                    r.scale.setScalar(0.12 + f * 0.3)
                    ;(r.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = speak * Math.sin(f * Math.PI) * 0.7
                })
                topCup.mat.emissiveIntensity = speak * 0.12

                // 2. The word runs down the string
                const prog = ease((c - 1.25) / 2.6)
                const on = bump(c, 1.1, 1.4, 3.75, 4.1)
                stringMat.uniforms.progress.value = prog
                stringMat.uniforms.on.value = on
                stringMat.uniforms.time.value = t
                curve.getPointAt(Math.min(prog, 1), p)
                bead.position.copy(p)
                bead.material.opacity = on
                spark.position.copy(p).applyMatrix4(world.matrixWorld)
                spark.intensity = on * 1.6

                // 3. They hear it: the cup glows, rings reach the ear, a small nod
                const hear = bump(c, 3.7, 4.0, 5.0, 5.8)
                bottomCup.mat.emissiveIntensity = hear * 0.18
                earMat.emissiveIntensity = hear * 1.1
                hearRings.forEach((r, i) => {
                    const f = ((c * 1.4 + i / 3) % 1)
                    r.position.set(bmx - 0.04 - f * 0.12, bmy, 0)
                    r.scale.setScalar(0.3 + f * 0.35)
                    ;(r.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = hear * Math.sin(f * Math.PI) * 0.55
                })
                them.rotation.z = hear * Math.sin((c - 3.7) * 5) * 0.035

                renderer.render(scene, camera)

                // The word: appears at your mouth, then rides the light down the string
                world.updateMatrixWorld()
                const sayX = you.position.x - 0.42 * k
                const sayY = you.position.y + 0.12
                if (c < 1.3) place(hiRef.current, sayX - c * 0.12, sayY + 0.25 + c * 0.05, 0, speak)
                else place(hiRef.current, p.x, p.y + 0.22, p.z, on)
                place(youRef.current, you.position.x + 0.1, you.position.y - 1.05 * k, 0, 1)
                place(themRef.current, them.position.x, them.position.y - 1.05 * k, 0, 1)
            }

            const ro = new ResizeObserver(fit)
            ro.observe(wrap)
            fit()

            let visible = true
            const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
            io.observe(wrap)
            let raf = 0
            const loop = (now: number) => {
                raf = requestAnimationFrame(loop)
                if (visible && !document.hidden) render(now)
            }
            if (reduced) render(performance.now())
            else raf = requestAnimationFrame(loop)

            cleanup = () => {
                cancelAnimationFrame(raf)
                ro.disconnect()
                io.disconnect()
                window.removeEventListener('pointermove', onPointer)
                disposables.forEach((d) => d.dispose())
                renderer.dispose()
                canvas.remove()
            }
        })()

        return () => {
            disposed = true
            cleanup()
        }
    }, [])

    return (
        <div
            ref={wrapRef}
            className="cups-hero relative w-full aspect-[5/4] select-none"
            role="img"
            aria-label="Two paper-cup telephones joined by a string shaped like an S. One person says hi, and the word travels along the string to the other person, who hears it."
        >
            {fallback && (
                <div className="absolute inset-0 grid place-items-center">
                    <LogoMark className="h-40 w-40" />
                </div>
            )}
            <span ref={hiRef} className="orb-hi">hi</span>
            <span ref={youRef} className="orb-label">you</span>
            <span ref={themRef} className="orb-label">someone new</span>
        </div>
    )
}
