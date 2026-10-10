'use client'

import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './Logo'

// The S from the logo as a liquid-glass sculpture. A warm light runs through its core
// like a message; when it arrives a greeting pops out. Drag to spin it, tap to send
// a message, and it leans toward the pointer. three.js loads only with this scene.

const GREETINGS = ['hi', 'hola', 'bonjour', 'namaste', 'ciao', 'hallo', 'olá', 'merhaba', 'salut', 'hey', 'konnichiwa', 'jambo']
const PULSE_EVERY = 4.6
const PULSE_TIME = 2.1

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function GlassHero() {
    const wrapRef = useRef<HTMLDivElement>(null)
    const hiRef = useRef<HTMLSpanElement>(null)
    const [fallback, setFallback] = useState(false)

    useEffect(() => {
        const wrap = wrapRef.current
        if (!wrap) return
        let disposed = false
        let cleanup = () => {}

        ;(async () => {
            const [THREE, { RoomEnvironment }] = await Promise.all([
                import('three'),
                import('three/examples/jsm/environments/RoomEnvironment.js'),
            ])
            if (disposed) return
            let renderer: InstanceType<typeof THREE.WebGLRenderer>
            try {
                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
            } catch {
                setFallback(true)
                return
            }
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            const coarse = window.matchMedia('(pointer: coarse)').matches
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2))
            renderer.outputColorSpace = THREE.SRGBColorSpace
            renderer.toneMapping = THREE.ACESFilmicToneMapping
            renderer.toneMappingExposure = 1.0
            const canvas = renderer.domElement
            canvas.className = 'absolute inset-0 h-full w-full'
            wrap.prepend(canvas)

            const disposables: { dispose: () => void }[] = []
            const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x)

            const scene = new THREE.Scene()
            const pmrem = keep(new THREE.PMREMGenerator(renderer))
            const envTex = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture)
            scene.environment = envTex
            scene.environmentIntensity = 0.9
            const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
            const key = new THREE.DirectionalLight(0xfff3e0, 1.2)
            key.position.set(-3, 4, 4)
            scene.add(key)
            const rimLight = new THREE.DirectionalLight(0x6fe3ea, 1.6)
            rimLight.position.set(4, -2, -3)
            scene.add(rimLight)
            const glowLight = new THREE.PointLight(0xffc35a, 0, 3, 1.5)
            scene.add(glowLight)

            const AMBER = new THREE.Color(0xf2c14e)
            const TEAL = new THREE.Color(0x5fd6dc)
            const root = new THREE.Group()
            scene.add(root)
            const sculpture = new THREE.Group()
            root.add(sculpture)

            // The S path from the logo, with full-length arms and a gentle twist in depth
            const S = (x: number, y: number): [number, number] => [(x - 16) / 8, -(y - 16) / 8]
            const pts2: [number, number][] = []
            const line = (a: number[], b: number[], n: number) => {
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
            line([21.5, 8], [10.8, 8], 12)
            cubic([10.8, 8], [7.4, 8], [6.6, 12], [9, 13.6], 20)
            line([9, 13.6], [23, 18.4], 18)
            cubic([23, 18.4], [25.4, 20], [24.6, 24], [21.2, 24], 20)
            line([21.2, 24], [10.5, 24], 12)
            pts2.push([10.5, 24])
            const curve = new THREE.CatmullRomCurve3(
                pts2.map(([x, y], i) => {
                    const [sx, sy] = S(x, y)
                    const u = i / (pts2.length - 1)
                    return new THREE.Vector3(sx, sy, Math.sin(u * Math.PI * 2) * 0.32)
                }),
                false,
                'centripetal',
            )

            const glass = keep(
                new THREE.MeshPhysicalMaterial({
                    color: 0xffffff,
                    metalness: 0,
                    roughness: 0.06,
                    transmission: 1,
                    thickness: 0.42,
                    ior: 1.5,
                    dispersion: 0.35,
                    iridescence: 0.7,
                    iridescenceIOR: 1.3,
                    iridescenceThicknessRange: [120, 520],
                    clearcoat: 1,
                    clearcoatRoughness: 0.04,
                    attenuationColor: new THREE.Color(0xcfe9ee),
                    attenuationDistance: 2.2,
                    specularIntensity: 1,
                    envMapIntensity: 1.2,
                }),
            )
            const R = 0.2
            sculpture.add(new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 420, R, coarse ? 32 : 48, false)), glass))
            const capGeo = keep(new THREE.SphereGeometry(R, 48, 32))
            for (const u of [0, 1]) {
                const cap = new THREE.Mesh(capGeo, glass)
                cap.position.copy(curve.getPointAt(u))
                sculpture.add(cap)
            }

            // The light inside: a thin core with a message pulse running through it
            const coreMat = keep(
                new THREE.ShaderMaterial({
                    uniforms: { progress: { value: -1 }, on: { value: 0 }, amber: { value: AMBER.clone() }, teal: { value: TEAL.clone() } },
                    vertexShader: `
                        varying float vU;
                        void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                    fragmentShader: `
                        uniform float progress, on;
                        uniform vec3 amber, teal;
                        varying float vU;
                        void main() {
                            float d = vU - progress;
                            float head = exp(-d * d * 900.0);
                            float trail = d < 0.0 ? exp(d * 9.0) : 0.0;
                            vec3 base = mix(teal, amber, vU) * 0.24;
                            vec3 c = base + amber * head * 5.0 * on + mix(teal, amber, 0.6) * trail * 1.1 * on;
                            gl_FragColor = vec4(c, 1.0);
                        }`,
                }),
            )
            sculpture.add(new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 420, 0.028, 10, false)), coreMat))

            // Glow that sits over the glass at the head of the pulse
            const glowTex = (() => {
                const c = document.createElement('canvas')
                c.width = c.height = 64
                const x = c.getContext('2d')!
                const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
                gr.addColorStop(0, 'rgba(255,232,180,1)')
                gr.addColorStop(0.3, 'rgba(242,193,78,0.45)')
                gr.addColorStop(1, 'rgba(242,193,78,0)')
                x.fillStyle = gr
                x.fillRect(0, 0, 64, 64)
                return keep(new THREE.CanvasTexture(c))
            })()
            const flare = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: 0 })))
            flare.scale.setScalar(0.7)
            flare.renderOrder = 10
            sculpture.add(flare)

            // Small glass beads on slow orbits, never touching the S
            const beadMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 1, thickness: 0.3, ior: 1.5, iridescence: 1, iridescenceThicknessRange: [200, 700], clearcoat: 1 }))
            const beadGeo = keep(new THREE.SphereGeometry(1, 32, 24))
            const beads = [0.07, 0.05, 0.09].map((r) => {
                const m = new THREE.Mesh(beadGeo, beadMat)
                m.scale.setScalar(r)
                root.add(m)
                return m
            })

            // Drifting dust and a thin turning ring beneath, for depth
            const dustCount = coarse ? 70 : 140
            const dustPos = new Float32Array(dustCount * 3)
            for (let i = 0; i < dustCount; i++) {
                const r = 1.6 + Math.random() * 1.2
                const a = Math.random() * Math.PI * 2
                const y = (Math.random() - 0.5) * 2.6
                dustPos.set([Math.cos(a) * r, y, Math.sin(a) * r * 0.6], i * 3)
            }
            const dustGeo = keep(new THREE.BufferGeometry())
            dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
            const dust = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ map: glowTex, size: 0.06, color: 0xcfeff2, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })))
            root.add(dust)
            const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(1.3, 0.005, 6, 160)), keep(new THREE.MeshBasicMaterial({ color: 0xece9e2, transparent: true, opacity: 0.22 })))
            ring.rotation.x = Math.PI / 2
            ring.position.y = -1.3
            root.add(ring)
            const ring2 = new THREE.Mesh(keep(new THREE.TorusGeometry(1.0, 0.004, 6, 160, Math.PI * 1.2)), keep(new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.45 })))
            ring2.rotation.x = Math.PI / 2
            ring2.position.y = -1.3
            root.add(ring2)

            const fit = () => {
                const w = wrap.clientWidth
                const h = wrap.clientHeight
                if (!w || !h) return
                renderer.setSize(w, h, false)
                camera.aspect = w / h
                const vFov = (camera.fov * Math.PI) / 180
                const distH = (w < 520 ? 3.9 : 3.5) / 2 / Math.tan(vFov / 2)
                const distW = (w < 520 ? 4.3 : 3.3) / 2 / (Math.tan(vFov / 2) * camera.aspect)
                camera.position.set(0, 0.1, Math.max(distH, distW))
                camera.lookAt(0, -0.05, 0)
                camera.updateProjectionMatrix()
                render(performance.now())
            }

            // Interaction: lean toward the pointer, drag to spin with inertia, tap to send
            const target = { x: 0, y: 0 }
            const lean = { x: 0, y: 0 }
            let spin = 0
            let spinVel = 0
            let dragging = false
            let dragX = 0
            let moved = 0
            let pulseStart = 0.6
            const onPointer = (e: PointerEvent) => {
                target.x = e.clientX / window.innerWidth - 0.5
                target.y = e.clientY / window.innerHeight - 0.5
                wrap.style.setProperty('--px', target.x.toFixed(3))
                wrap.style.setProperty('--py', target.y.toFixed(3))
            }
            const onDown = (e: PointerEvent) => {
                dragging = true
                dragX = e.clientX
                moved = 0
                wrap.classList.add('is-dragging')
            }
            const onMove = (e: PointerEvent) => {
                if (!dragging) return
                const dx = e.clientX - dragX
                dragX = e.clientX
                moved += Math.abs(dx)
                spinVel = dx * 0.012
                spin += dx * 0.012
            }
            const onUp = () => {
                if (!dragging) return
                dragging = false
                wrap.classList.remove('is-dragging')
                if (moved < 6) {
                    // A tap: a little hop and a fresh message
                    spinVel += 0.25
                    pulseStart = clock()
                }
            }
            window.addEventListener('pointermove', onPointer, { passive: true })
            wrap.addEventListener('pointerdown', onDown)
            window.addEventListener('pointermove', onMove, { passive: true })
            window.addEventListener('pointerup', onUp)
            window.addEventListener('pointercancel', onUp)

            const startTime = performance.now()
            const clock = () => (performance.now() - startTime) / 1000
            const v = new THREE.Vector3()
            const head = new THREE.Vector3()
            const endPoint = curve.getPointAt(1)
            let greet = -1
            let hiShown = false
            let lastT = 0

            const render = (now: number) => {
                const t = reduced ? 3 : (now - startTime) / 1000
                const dt = Math.min(0.05, t - lastT)
                lastT = t

                // Motion: slow idle turn, inertia from drags, a lean toward the pointer
                if (!dragging) {
                    spin += spinVel
                    spinVel *= 0.94
                    spin += dt * 0.18
                }
                lean.x += (target.x - lean.x) * 0.06
                lean.y += (target.y - lean.y) * 0.06
                sculpture.rotation.y = Math.sin(spin) * 0.55 + lean.x * 0.5
                sculpture.rotation.x = lean.y * 0.25 + Math.sin(t * 0.5) * 0.04
                sculpture.rotation.z = Math.sin(t * 0.35) * 0.04
                sculpture.position.y = reduced ? 0 : Math.sin(t * 0.9) * 0.05
                const breathe = 1 + (reduced ? 0 : Math.sin(t * 1.3) * 0.008)
                sculpture.scale.setScalar(breathe)

                beads.forEach((b, i) => {
                    const a = t * (0.35 + i * 0.12) + i * 2.2
                    const r = 1.55 + i * 0.12
                    b.position.set(Math.cos(a) * r, Math.sin(a * 0.8 + i) * 0.7, Math.sin(a) * r * 0.55)
                })
                dust.rotation.y = t * 0.03
                ring.rotation.z = t * 0.05
                ring2.rotation.z = -t * 0.12

                // The message pulse
                const since = t - pulseStart
                if (since > PULSE_EVERY) pulseStart = t
                const prog = ease(since / PULSE_TIME)
                const on = since < PULSE_TIME + 0.4 ? 1 - ease((since - PULSE_TIME) / 0.4) : 0
                coreMat.uniforms.progress.value = since < PULSE_TIME + 0.4 ? prog : -1
                coreMat.uniforms.on.value = on
                curve.getPointAt(Math.min(prog, 1), head)
                flare.position.copy(head)
                flare.material.opacity = on * 0.9
                glowLight.position.copy(head).applyMatrix4(sculpture.matrixWorld)
                glowLight.intensity = on * 2.2

                renderer.render(scene, camera)

                // The greeting chip pops where the message arrives
                const el = hiRef.current
                if (el) {
                    const arrived = since > PULSE_TIME - 0.1 && since < PULSE_TIME + 1.6
                    if (arrived && !hiShown) {
                        greet = (greet + 1) % GREETINGS.length
                        el.textContent = GREETINGS[greet]
                    }
                    if (arrived !== hiShown) {
                        hiShown = arrived
                        el.classList.toggle('is-on', arrived)
                    }
                    v.copy(endPoint).applyMatrix4(sculpture.matrixWorld).project(camera)
                    const sx = ((v.x + 1) / 2) * wrap.clientWidth
                    const sy = ((1 - v.y) / 2) * wrap.clientHeight
                    el.style.left = `${sx.toFixed(1)}px`
                    el.style.top = `${(sy - 34).toFixed(1)}px`
                }
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
            if (reduced) {
                pulseStart = 3 - PULSE_TIME * 0.6
                render(performance.now())
            } else raf = requestAnimationFrame(loop)

            cleanup = () => {
                cancelAnimationFrame(raf)
                ro.disconnect()
                io.disconnect()
                window.removeEventListener('pointermove', onPointer)
                wrap.removeEventListener('pointerdown', onDown)
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
                window.removeEventListener('pointercancel', onUp)
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
            className="glass-hero relative w-full aspect-[5/4] select-none"
            role="img"
            aria-label="A glass sculpture of the Strangers Connect S. A warm light runs through it like a message and a greeting pops out at the end."
        >
            {fallback && (
                <div className="absolute inset-0 grid place-items-center">
                    <LogoMark className="h-40 w-40" />
                </div>
            )}
            <span ref={hiRef} className="hi-chip">hi</span>
            <div className="glass-chip chip-a">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                    <rect x="3.5" y="7" width="9" height="6.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                Encrypted calls
            </div>
            <div className="glass-chip chip-b">
                <span className="chip-dot" aria-hidden="true" />
                No sign-up
            </div>
            <div className="glass-chip chip-c">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M4 8h8M9 5l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Next in one tap
            </div>
        </div>
    )
}
