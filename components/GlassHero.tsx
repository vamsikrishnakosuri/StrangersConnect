'use client'

import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './Logo'

// The S from the logo as a liquid-glass sculpture, telling the story of a private message:
// you say hi, it scrambles and locks as it enters the glass, travels sealed, an onlooker
// tries to listen and gets only noise, and it unlocks as "hi" for the other person.
// Drag to spin it, tap to send a new message. As the page scrolls, the camera flies
// toward the glass and into it. three.js loads only with this scene.

const GREETINGS = ['hi', 'hola', 'bonjour', 'namaste', 'ciao', 'hallo', 'olá', 'merhaba', 'salut', 'hey', 'konnichiwa', 'jambo']
// One message, in seconds: lock, travel sealed, unlock, rest
const CYCLE = 7.4
const TRAVEL_START = 1.15
const TRAVEL_TIME = 3.0
const ARRIVE = TRAVEL_START + TRAVEL_TIME
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&@*+=/<>'
const noise = (n: number) => Array.from({ length: n }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('')

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const bump = (x: number, a: number, b: number, c: number, d: number) => ease((x - a) / (b - a)) * (1 - ease((x - c) / (d - c)))

export function GlassHero() {
    const wrapRef = useRef<HTMLDivElement>(null)
    const sendRef = useRef<HTMLDivElement>(null)
    const recvRef = useRef<HTMLDivElement>(null)
    const eyeRef = useRef<HTMLDivElement>(null)
    const eyeTextRef = useRef<HTMLSpanElement>(null)
    const probeRef = useRef<SVGLineElement>(null)
    const probeTipRef = useRef<SVGCircleElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const chipRef = useRef<HTMLDivElement>(null)
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
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.6))
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
            // Paper-cup cones at both ends, like the logo: flared glass horns with an amber rim
            // and a light inside that glows when a message leaves or arrives
            const coneLen = 0.78
            const coneR = 0.5
            const profile: InstanceType<typeof THREE.Vector2>[] = []
            for (let i = 0; i <= 18; i++) {
                const k = i / 18
                profile.push(new THREE.Vector2(R * 0.92 + (coneR - R * 0.92) * Math.pow(k, 1.5), k * coneLen))
            }
            const coneGeo = keep(new THREE.LatheGeometry(profile, 72))
            const coneGlass = keep(glass.clone())
            coneGlass.side = THREE.DoubleSide
            const rimGeo = keep(new THREE.TorusGeometry(coneR, 0.026, 16, 96))
            const rimMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xf2c14e, roughness: 0.25, metalness: 0.3, clearcoat: 1, emissive: AMBER, emissiveIntensity: 0.25 }))
            const capGeo = keep(new THREE.SphereGeometry(R, 48, 32))
            const voiceGeo = keep(new THREE.CircleGeometry(coneR * 0.9, 48))
            const mouths: InstanceType<typeof THREE.Vector3>[] = []
            const voices: InstanceType<typeof THREE.MeshBasicMaterial>[] = []
            for (const u of [0, 1]) {
                const at = curve.getPointAt(u)
                const out = curve.getTangentAt(u)
                if (u === 0) out.negate()
                const cone = new THREE.Group()
                cone.position.copy(at)
                cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out)
                cone.add(new THREE.Mesh(coneGeo, coneGlass))
                const rimRing = new THREE.Mesh(rimGeo, rimMat)
                rimRing.rotation.x = Math.PI / 2
                rimRing.position.y = coneLen
                cone.add(rimRing)
                const vm = keep(new THREE.MeshBasicMaterial({ map: null, color: 0xffc35a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))
                const voice = new THREE.Mesh(voiceGeo, vm)
                voice.rotation.x = -Math.PI / 2
                voice.position.y = coneLen * 0.82
                cone.add(voice)
                voices.push(vm)
                sculpture.add(cone)
                const cap = new THREE.Mesh(capGeo, glass)
                cap.position.copy(at)
                sculpture.add(cap)
                mouths.push(at.clone().addScaledVector(out, coneLen))
            }

            // The light inside: a thin core with a message pulse running through it
            const coreMat = keep(
                new THREE.ShaderMaterial({
                    uniforms: { progress: { value: -1 }, on: { value: 0 }, locked: { value: 0 }, amber: { value: AMBER.clone() }, teal: { value: TEAL.clone() } },
                    vertexShader: `
                        varying float vU;
                        void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                    fragmentShader: `
                        uniform float progress, on, locked;
                        uniform vec3 amber, teal;
                        varying float vU;
                        void main() {
                            float d = vU - progress;
                            float head = exp(-d * d * 900.0);
                            float trail = d < 0.0 ? exp(d * 9.0) : 0.0;
                            vec3 base = mix(teal, amber, vU) * 0.24;
                            vec3 hc = mix(amber, teal * 1.3, locked);
                            vec3 c = base + hc * head * 5.0 * on + hc * trail * 1.0 * on;
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

            // The shield: a ring of glass hexagons that flashes where someone tries to look in
            const hexTex = (() => {
                const c = document.createElement('canvas')
                c.width = c.height = 256
                const x = c.getContext('2d')!
                x.strokeStyle = 'rgba(160,240,245,1)'
                x.lineWidth = 2
                const r = 14
                const h = Math.sqrt(3) * r
                for (let row = -1; row < 12; row++) {
                    for (let col = -1; col < 13; col++) {
                        const cx = col * r * 1.5
                        const cy = row * h + (col % 2 ? h / 2 : 0)
                        const dist = Math.hypot(cx - 128, cy - 128)
                        if (dist > 118) continue
                        x.globalAlpha = Math.max(0, 1 - Math.abs(dist - 80) / 50)
                        x.beginPath()
                        for (let k = 0; k < 6; k++) {
                            const a = (Math.PI / 3) * k
                            const px = cx + Math.cos(a) * (r - 2)
                            const py = cy + Math.sin(a) * (r - 2)
                            if (k) x.lineTo(px, py)
                            else x.moveTo(px, py)
                        }
                        x.closePath()
                        x.stroke()
                    }
                }
                return keep(new THREE.CanvasTexture(c))
            })()
            const shield = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: hexTex, color: 0x9ff0f5, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: 0 })))
            shield.renderOrder = 11
            sculpture.add(shield)

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
            const pool = new THREE.Mesh(
                keep(new THREE.PlaneGeometry(3.2, 3.2)),
                keep(new THREE.MeshBasicMaterial({ map: glowTex, color: 0x5fd6dc, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })),
            )
            pool.rotation.x = -Math.PI / 2
            pool.position.y = -1.31
            root.add(pool)

            // Scroll-driven camera: the S starts below the headline, then the camera flies
            // toward it and into the glass as the hero scrolls by
            const section = wrap.closest('[data-scene="hero"]') as HTMLElement | null
            const stage = section?.firstElementChild as HTMLElement | null
            const textEl = section?.querySelector('[data-anim="hero-text"]') as HTMLElement | null
            let textBottom = 0
            const measureText = () => {
                if (!textEl) return wrap.clientHeight * 0.45
                let y = 0
                let el: HTMLElement | null = textEl
                while (el && el !== stage) {
                    y += el.offsetTop
                    el = el.offsetParent as HTMLElement | null
                }
                return y + textEl.offsetHeight
            }
            const scrollProgress = () => {
                if (!section) return 0
                const span = section.offsetHeight - window.innerHeight
                return span > 0 ? Math.min(1, Math.max(0, -section.getBoundingClientRect().top / span)) : 0
            }
            let zoomS = 0
            // Two acts: the S rises to the middle at full view, then the camera flies into the glass
            const frame = (rise: number, z: number) => {
                const W = wrap.clientWidth
                const H = wrap.clientHeight
                const tanH = Math.tan((camera.fov * Math.PI) / 360)
                // Start: just below the headline, peeking up from the bottom of the screen if it must
                const free = H - textBottom - 24
                const ppu0 = Math.min((W * 0.94) / 3.4, Math.max(free / 3.0, H * 0.17))
                const ppuMid = Math.min((W * 0.9) / 3.4, (H * 0.78) / 3.0)
                const ppu1 = H * 1.0
                const cy0 = textBottom + 24 + 1.45 * ppu0
                const ppu = (ppu0 + (ppuMid - ppu0) * rise) * Math.pow(ppu1 / ppuMid, z)
                const cy = cy0 + (H / 2 - cy0) * rise
                camera.position.set(0, 0, H / (2 * ppu * tanH))
                camera.lookAt(0, 0, 0)
                camera.setViewOffset(W, H, 0, H / 2 - cy, W, H)
                camera.updateProjectionMatrix()
            }

            const fit = () => {
                const w = wrap.clientWidth
                const h = wrap.clientHeight
                if (!w || !h) return
                renderer.setSize(w, h, false)
                camera.aspect = w / h
                textBottom = measureText()
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
                    pulseStart = clock() - 0.2
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
            const lift = new THREE.Vector3()
            const mouthUp = (i: number) => lift.copy(mouths[i]).add(new THREE.Vector3(0, 0.55, 0))
            const anchor = new THREE.Vector3()
            const placeChip = (el: HTMLElement | null, x: number, y: number, z: number) => {
                if (!el) return
                anchor.set(x, y, z).project(camera)
                const W = wrap.clientWidth
                const sx = ((anchor.x + 1) / 2) * W
                const sy = ((1 - anchor.y) / 2) * wrap.clientHeight
                const left = Math.min(W - el.offsetWidth - 8, Math.max(8, sx - el.offsetWidth / 2))
                el.style.left = `${left.toFixed(1)}px`
                el.style.top = `${(sy - el.offsetHeight / 2).toFixed(1)}px`
            }
            const toScreen = (p: InstanceType<typeof THREE.Vector3>) => {
                v.copy(p).applyMatrix4(sculpture.matrixWorld).project(camera)
                return [((v.x + 1) / 2) * wrap.clientWidth, ((1 - v.y) / 2) * wrap.clientHeight]
            }
            const setText = (el: Element | null | undefined, text: string) => {
                if (el && el.textContent !== text) el.textContent = text
            }
            const setClass = (el: Element | null, name: string, on: boolean) => {
                if (el && el.classList.contains(name) !== on) el.classList.toggle(name, on)
            }
            const place = (el: HTMLElement | null, x: number, y: number) => {
                if (!el) return
                el.style.left = `${x.toFixed(1)}px`
                el.style.top = `${y.toFixed(1)}px`
            }
            let greet = -1
            let word = GREETINGS[0]
            let lastCycle = -1
            let lastNoise = 0
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
                const zt = scrollProgress()
                zoomS = reduced ? zt : zoomS + (zt - zoomS) * 0.14
                const rise = ease(zoomS / 0.3)
                const z = ease((zoomS - 0.32) / 0.5)
                frame(rise, z)
                wrap.style.opacity = (1 - ease((zoomS - 0.66) / 0.3) * 0.92).toFixed(3)
                if (overlayRef.current) overlayRef.current.style.opacity = (1 - ease(z * 3)).toFixed(3)
                sculpture.rotation.y = Math.sin(spin) * 0.55 * (1 - z) + lean.x * 0.5 + z * 0.9
                sculpture.rotation.x = lean.y * 0.25 + Math.sin(t * 0.5) * 0.04 + z * 0.3
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
                ;(pool.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = 0.18 + 0.3 * Math.max(0, Math.min(1, coreMat.uniforms.on.value))

                // One message: lock, travel sealed past an onlooker, unlock
                let since = t - pulseStart
                if (since > CYCLE) {
                    pulseStart = t
                    since = 0
                }
                if (pulseStart !== lastCycle) {
                    lastCycle = pulseStart
                    greet = (greet + 1) % GREETINGS.length
                    word = GREETINGS[greet]
                }
                const tp = (since - TRAVEL_START) / TRAVEL_TIME
                const prog = ease(tp)
                const on = tp > 0 ? (tp < 1 ? ease(tp * 8) : 1 - ease((tp - 1) * 5)) : 0
                coreMat.uniforms.progress.value = tp > 0 && tp < 1.25 ? prog : -1
                coreMat.uniforms.on.value = on
                coreMat.uniforms.locked.value = 1
                curve.getPointAt(Math.min(Math.max(prog, 0), 1), head)
                flare.position.copy(head)
                flare.material.color.set(0x9ff0f5)
                flare.material.opacity = on * 0.8
                glowLight.color.set(0x7fe6ec)
                glowLight.position.copy(head).applyMatrix4(sculpture.matrixWorld)
                glowLight.intensity = on * 2.0

                // The onlooker probes the middle of the trip and hits the shield
                const probe = bump(tp, 0.36, 0.44, 0.62, 0.7)
                const hit = bump(tp, 0.43, 0.48, 0.6, 0.72)
                shield.position.copy(head)
                shield.scale.setScalar(0.35 + ease((tp - 0.43) / 0.25) * 0.75)
                shield.material.opacity = hit * 0.95

                voices[0].opacity = bump(since, 0.2, 0.6, TRAVEL_START + 0.1, TRAVEL_START + 0.6) * 0.55
                voices[1].opacity = bump(since, ARRIVE - 0.2, ARRIVE + 0.1, ARRIVE + 1.0, ARRIVE + 1.8) * 0.55
                rimMat.emissiveIntensity = 0.25 + (voices[0].opacity + voices[1].opacity) * 0.9

                renderer.render(scene, camera)

                // Words and labels drawn over the scene
                const tick = now - lastNoise > 70
                if (tick) lastNoise = now
                const [hx, hy] = toScreen(head)

                // You: the word appears, then scrambles and locks as it enters the glass
                const send = sendRef.current
                if (send) {
                    const [sx, sy] = toScreen(mouthUp(0))
                    place(send, sx, sy - 8)
                    const lockP = ease((since - 0.45) / 0.55)
                    setClass(send, 'is-on', since > 0.05 && since < TRAVEL_START + 0.15)
                    setClass(send, 'is-locked', lockP > 0.5)
                    if (tick || lockP === 0) {
                        const k = Math.round(lockP * word.length)
                        setText(send.lastElementChild, lockP >= 1 ? noise(Math.max(4, word.length + 2)) : noise(k) + word.slice(k))
                    }
                }

                // The chips stay beside the S wherever the camera puts it
                placeChip(chipRef.current, -1.55, 1.15, 0)
                placeChip(eyeRef.current, 1.85, -0.15, 0)

                // The onlooker: a dashed probe line, then only noise
                const eye = eyeRef.current
                const line = probeRef.current
                if (eye && line) {
                    const ex = eye.offsetLeft
                    const ey = eye.offsetTop + eye.offsetHeight / 2
                    const reach = ease((tp - 0.36) / 0.08)
                    const px = ex + (hx - ex) * reach
                    const py = ey + (hy - ey) * reach
                    line.setAttribute('x1', ex.toFixed(1))
                    line.setAttribute('y1', ey.toFixed(1))
                    line.setAttribute('x2', px.toFixed(1))
                    line.setAttribute('y2', py.toFixed(1))
                    line.style.opacity = (probe * 0.9).toFixed(2)
                    const tipEl = probeTipRef.current
                    if (tipEl) {
                        tipEl.setAttribute('cx', px.toFixed(1))
                        tipEl.setAttribute('cy', py.toFixed(1))
                        tipEl.style.opacity = probe.toFixed(2)
                    }
                    const probing = tp > 0.42 && tp < 0.7
                    const blocked = tp >= 0.7 && since < CYCLE - 0.4
                    setClass(eye, 'is-probing', probing)
                    setClass(eye, 'is-blocked', blocked)
                    if (probing) {
                        if (tick) setText(eyeTextRef.current, noise(6))
                    } else setText(eyeTextRef.current, blocked ? 'blocked' : 'watching')
                }

                // Them: the noise resolves back into the word, for their eyes only
                const recv = recvRef.current
                if (recv) {
                    const [rx, ry] = toScreen(mouthUp(1))
                    place(recv, rx, ry - 8)
                    const openP = ease((since - ARRIVE - 0.2) / 0.75)
                    setClass(recv, 'is-on', since > ARRIVE - 0.1 && since < CYCLE - 0.5)
                    setClass(recv, 'is-locked', openP < 1)
                    if (tick || openP >= 1) {
                        const k = Math.round(openP * word.length)
                        setText(recv.lastElementChild, word.slice(0, k) + noise(word.length - k))
                    }
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
                pulseStart = 3 - (TRAVEL_START + TRAVEL_TIME * 0.55)
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
            className="glass-hero relative h-full w-full select-none"
            role="img"
            aria-label="A glass sculpture of the Strangers Connect S. A hello is locked into scrambled code, travels through the glass past an intruder who sees only noise, and unlocks for the other person."
        >
            {fallback && (
                <div className="absolute inset-0 grid place-items-center">
                    <LogoMark className="h-40 w-40" />
                </div>
            )}
            <div ref={overlayRef} className="pointer-events-none absolute inset-0">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                <line ref={probeRef} className="probe-line" x1="0" y1="0" x2="0" y2="0" />
                <circle ref={probeTipRef} className="probe-tip" r="3" cx="0" cy="0" />
            </svg>
            <div ref={sendRef} className="msg-bubble">
                <LockIcon />
                <span>hi</span>
            </div>
            <div ref={recvRef} className="msg-bubble msg-recv">
                <LockIcon />
                <span>hi</span>
            </div>
            <div ref={eyeRef} className="glass-chip eye-chip">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="8" cy="8" r="2" fill="currentColor" />
                </svg>
                <b className="font-medium text-paper">Intruder</b>
                <span ref={eyeTextRef}>watching</span>
            </div>
            <div ref={chipRef} className="glass-chip chip-a">
                <span className="chip-dot" aria-hidden="true" />
                Nothing saved
            </div>
            </div>
        </div>
    )
}

function LockIcon() {
    return (
        <svg viewBox="0 0 16 16" className="msg-lock" aria-hidden="true">
            <rect x="3.5" y="7" width="9" height="6.5" rx="1.6" fill="currentColor" />
            <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    )
}
