'use client'

import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './Logo'

// A floating 3D composition: the S from the logo as a frosted-glass ribbon with a light
// running through it, surrounded by chunky 3D objects for what the site is about:
// a video camera, a chat bubble that is typing, and a glass shield whose lock snaps shut.
// Everything springs in, drifts with depth, pops when hovered and flips when clicked.

type Obj = {
    group: import('three').Group
    home: import('three').Vector3
    depth: number
    phase: number
    delay: number
    pop: number
    popTarget: number
    flip: number
    flipStart: number
    baseRot: import('three').Euler
}

export function Hero3D() {
    const wrapRef = useRef<HTMLDivElement>(null)
    const [fallback, setFallback] = useState(false)

    useEffect(() => {
        const wrap = wrapRef.current
        if (!wrap) return
        let disposed = false
        let cleanup = () => {}

        ;(async () => {
            const [THREE, { RoomEnvironment }, { RoundedBoxGeometry }] = await Promise.all([
                import('three'),
                import('three/examples/jsm/environments/RoomEnvironment.js'),
                import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
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
            const canvas = renderer.domElement
            canvas.className = 'absolute inset-0 h-full w-full'
            wrap.prepend(canvas)

            const disposables: { dispose: () => void }[] = []
            const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x)

            const scene = new THREE.Scene()
            const pmrem = keep(new THREE.PMREMGenerator(renderer))
            scene.environment = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture)
            scene.environmentIntensity = 0.85
            const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
            const key = new THREE.DirectionalLight(0xfff1dc, 1.6)
            key.position.set(-3, 4, 5)
            scene.add(key)
            const rim = new THREE.DirectionalLight(0x6fe3ea, 1.8)
            rim.position.set(4, -1, -3)
            scene.add(rim)
            const warm = new THREE.PointLight(0xffb84a, 6, 6, 2)
            warm.position.set(0.4, -0.6, 1.8)
            scene.add(warm)

            const AMBER = 0xf2b84a
            const PAPER = 0xf1ede4
            const TEAL = 0x5fd6dc
            const glossy = (color: number, extra: Partial<import('three').MeshPhysicalMaterialParameters> = {}) =>
                keep(new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.3, ...extra }))
            const frosted = (tint: number, rough = 0.2) =>
                keep(
                    new THREE.MeshPhysicalMaterial({
                        color: 0xffffff,
                        roughness: rough,
                        transmission: 1,
                        thickness: 0.6,
                        ior: 1.45,
                        iridescence: 0.5,
                        iridescenceThicknessRange: [150, 500],
                        attenuationColor: new THREE.Color(tint),
                        attenuationDistance: 1.4,
                        clearcoat: 1,
                        clearcoatRoughness: 0.1,
                    }),
                )

            const root = new THREE.Group()
            scene.add(root)
            const objs: Obj[] = []
            const add = (group: InstanceType<typeof THREE.Group>, pos: [number, number, number], depth: number, delay: number) => {
                group.position.set(...pos)
                group.scale.setScalar(0.0001)
                root.add(group)
                const o: Obj = { group, home: new THREE.Vector3(...pos), depth, phase: Math.random() * 6.28, delay, pop: 0, popTarget: 0, flip: 0, flipStart: -10, baseRot: group.rotation.clone() }
                group.userData.obj = o
                objs.push(o)
                return o
            }

            // 1. The S ribbon: the logo path swept with a flat, twisting cross-section
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
                    return new THREE.Vector3(sx * 0.9, sy * 0.9, Math.sin((i / (pts2.length - 1)) * Math.PI * 2) * 0.3)
                }),
                false,
                'centripetal',
            )
            const ribbonGeo = (() => {
                const N = 360
                const K = 20
                const pos: number[] = []
                const uv: number[] = []
                const idx: number[] = []
                const P = new THREE.Vector3()
                const T = new THREE.Vector3()
                const side = new THREE.Vector3()
                const up = new THREE.Vector3()
                const Z = new THREE.Vector3(0, 0, 1)
                for (let i = 0; i <= N; i++) {
                    const u = i / N
                    curve.getPointAt(u, P)
                    curve.getTangentAt(u, T)
                    side.crossVectors(T, Z).normalize()
                    up.crossVectors(side, T).normalize()
                    const twist = Math.sin(u * Math.PI * 2) * 0.9 + u * 0.6
                    const c = Math.cos(twist)
                    const s = Math.sin(twist)
                    const sd = side.clone().multiplyScalar(c).addScaledVector(up, s)
                    const ud = up.clone().multiplyScalar(c).addScaledVector(side, -s)
                    const taper = Math.min(1, u / 0.07, (1 - u) / 0.07)
                    const w = 0.25 * (0.25 + 0.75 * Math.sqrt(Math.max(taper, 0)))
                    const th = 0.06 * (0.4 + 0.6 * Math.max(taper, 0))
                    for (let k = 0; k < K; k++) {
                        const a = (k / K) * Math.PI * 2
                        const ca = Math.cos(a)
                        const sa = Math.sin(a)
                        const x = Math.sign(ca) * Math.pow(Math.abs(ca), 0.35) * w
                        const y = Math.sign(sa) * Math.pow(Math.abs(sa), 0.35) * th
                        pos.push(P.x + sd.x * x + ud.x * y, P.y + sd.y * x + ud.y * y, P.z + sd.z * x + ud.z * y)
                        uv.push(u, k / K)
                    }
                }
                for (let i = 0; i < N; i++) {
                    for (let k = 0; k < K; k++) {
                        const a = i * K + k
                        const b = i * K + ((k + 1) % K)
                        const c = (i + 1) * K + k
                        const d = (i + 1) * K + ((k + 1) % K)
                        idx.push(a, c, b, b, c, d)
                    }
                }
                const g = new THREE.BufferGeometry()
                g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
                g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
                g.setIndex(idx)
                g.computeVertexNormals()
                return keep(g)
            })()
            const ribbon = new THREE.Group()
            ribbon.add(new THREE.Mesh(ribbonGeo, frosted(TEAL, 0.16)))
            // The light that runs through the ribbon: a message on its way
            const coreMat = keep(
                new THREE.ShaderMaterial({
                    uniforms: { progress: { value: -1 }, on: { value: 0 } },
                    vertexShader: `varying float vU; void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                    fragmentShader: `
                        uniform float progress, on;
                        varying float vU;
                        void main() {
                            float d = vU - progress;
                            float head = exp(-d * d * 700.0);
                            float trail = d < 0.0 ? exp(d * 8.0) : 0.0;
                            vec3 c = mix(vec3(0.37, 0.84, 0.86), vec3(0.95, 0.72, 0.29), vU) * 0.18;
                            c += vec3(0.75, 1.0, 1.0) * head * 4.0 * on + vec3(0.37, 0.84, 0.86) * trail * 0.9 * on;
                            gl_FragColor = vec4(c, 1.0);
                        }`,
                }),
            )
            ribbon.add(new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 360, 0.018, 8, false)), coreMat))
            const ribbonObj = add(ribbon, [0, 0.02, 0], 0.15, 0)

            // 2. Video camera: rounded body, a flared hood, a glass lens and a recording light
            const cam = new THREE.Group()
            const camBody = new THREE.Mesh(keep(new RoundedBoxGeometry(0.62, 0.44, 0.34, 5, 0.12)), glossy(AMBER))
            cam.add(camBody)
            const hood = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.24, 0.12, 0.24, 4, 1)), glossy(AMBER))
            hood.rotation.set(0, Math.PI / 4, -Math.PI / 2)
            hood.rotation.order = 'ZYX'
            hood.position.x = 0.4
            cam.add(hood)
            const lens = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 32)), keep(new THREE.MeshPhysicalMaterial({ color: 0x14181c, roughness: 0.05, clearcoat: 1 })))
            lens.rotation.x = Math.PI / 2
            lens.position.set(-0.08, 0.02, 0.18)
            cam.add(lens)
            const recMat = keep(new THREE.MeshStandardMaterial({ color: 0x2a0d08, emissive: 0xff5a3c, emissiveIntensity: 1.5 }))
            const rec = new THREE.Mesh(keep(new THREE.SphereGeometry(0.03, 16, 12)), recMat)
            rec.position.set(0.19, 0.13, 0.17)
            cam.add(rec)
            cam.rotation.set(0.25, 0.55, 0.12)
            add(cam, [-1.78, 0.72, 0.35], 0.5, 0.12)

            // 3. Chat bubble with three typing dots
            const chat = new THREE.Group()
            chat.add(new THREE.Mesh(keep(new RoundedBoxGeometry(0.78, 0.52, 0.22, 5, 0.16)), glossy(PAPER)))
            const tail = new THREE.Mesh(keep(new THREE.ConeGeometry(0.1, 0.2, 24)), glossy(PAPER))
            tail.position.set(-0.24, -0.3, 0)
            tail.rotation.z = Math.PI * 0.82
            chat.add(tail)
            const dotMat = glossy(AMBER, { emissive: new THREE.Color(AMBER), emissiveIntensity: 0.15 })
            const dots = [-0.17, 0, 0.17].map((x) => {
                const d = new THREE.Mesh(keep(new THREE.SphereGeometry(0.052, 24, 16)), dotMat)
                d.position.set(x, 0, 0.12)
                chat.add(d)
                return d
            })
            chat.rotation.set(-0.15, -0.5, -0.06)
            add(chat, [1.68, 0.22, 0.45], 0.55, 0.24)

            // 4. Glass shield with a lock whose shackle snaps shut every few seconds
            const shield = new THREE.Group()
            const shape = new THREE.Shape()
            shape.moveTo(0, 0.42)
            shape.quadraticCurveTo(0.22, 0.4, 0.34, 0.3)
            shape.lineTo(0.34, 0.02)
            shape.quadraticCurveTo(0.3, -0.28, 0, -0.45)
            shape.quadraticCurveTo(-0.3, -0.28, -0.34, 0.02)
            shape.lineTo(-0.34, 0.3)
            shape.quadraticCurveTo(-0.22, 0.4, 0, 0.42)
            const shieldGeo = keep(new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 6, curveSegments: 24 }))
            shieldGeo.center()
            shield.add(new THREE.Mesh(shieldGeo, frosted(TEAL, 0.12)))
            const lockBody = new THREE.Mesh(keep(new RoundedBoxGeometry(0.22, 0.17, 0.1, 4, 0.035)), glossy(AMBER))
            lockBody.position.set(0, -0.05, 0.13)
            shield.add(lockBody)
            const shackle = new THREE.Mesh(keep(new THREE.TorusGeometry(0.065, 0.02, 12, 32, Math.PI)), glossy(PAPER, { metalness: 0.6, roughness: 0.15 }))
            shackle.position.set(0, 0.04, 0.13)
            shield.add(shackle)
            shield.rotation.set(0.1, 0.35, 0)
            const shieldObj = add(shield, [1.05, -0.74, 0.75], 0.75, 0.36)

            // 5. Glass and gloss spheres, and a thin ring, for rhythm and depth
            const sphere = (r: number, mat: import('three').Material, pos: [number, number, number], depth: number, delay: number) => {
                const g = new THREE.Group()
                g.add(new THREE.Mesh(keep(new THREE.SphereGeometry(r, 48, 32)), mat))
                return add(g, pos, depth, delay)
            }
            sphere(0.2, frosted(0xbfefff, 0.05), [-1.05, -0.82, 0.2], 0.4, 0.45)
            sphere(0.11, glossy(AMBER), [1.15, 1.0, -0.2], 0.25, 0.52)
            sphere(0.07, glossy(PAPER), [-0.55, 1.12, 0.5], 0.6, 0.58)
            sphere(0.09, frosted(TEAL, 0.05), [1.95, -0.55, 0.1], 0.35, 0.62)
            const ringG = new THREE.Group()
            ringG.add(new THREE.Mesh(keep(new THREE.TorusGeometry(0.16, 0.035, 20, 64)), glossy(PAPER, { metalness: 0.4, roughness: 0.18 })))
            ringG.rotation.set(1.1, 0.3, 0)
            add(ringG, [-1.75, -0.25, -0.1], 0.3, 0.66)

            // Faint drifting dust behind everything
            const dustCount = coarse ? 60 : 120
            const dustPos = new Float32Array(dustCount * 3)
            for (let i = 0; i < dustCount; i++) dustPos.set([(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3.6, -1 - Math.random() * 1.5], i * 3)
            const dustGeo = keep(new THREE.BufferGeometry())
            dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
            const dust = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ size: 0.02, color: 0xcfeff2, transparent: true, opacity: 0.5, depthWrite: false })))
            scene.add(dust)

            const fit = () => {
                const w = wrap.clientWidth
                const h = wrap.clientHeight
                if (!w || !h) return
                renderer.setSize(w, h, false)
                camera.aspect = w / h
                const vFov = (camera.fov * Math.PI) / 180
                const needW = w < 520 ? 4.9 : 4.6
                const needH = 3.2
                camera.position.set(0, 0.05, Math.max(needH / 2 / Math.tan(vFov / 2), needW / 2 / (Math.tan(vFov / 2) * camera.aspect)))
                camera.lookAt(0, -0.08, 0)
                camera.updateProjectionMatrix()
                render(performance.now())
            }

            // Pointer: depth parallax, hover to pop, click to flip, click empty space to send a message
            const target = { x: 0, y: 0 }
            const lean = { x: 0, y: 0 }
            const ray = new THREE.Raycaster()
            const ndc = new THREE.Vector2(9, 9)
            let hovered: Obj | null = null
            const startTime = performance.now()
            const clock = () => (performance.now() - startTime) / 1000
            let pulseStart = 1.2
            const onPointer = (e: PointerEvent) => {
                target.x = e.clientX / window.innerWidth - 0.5
                target.y = e.clientY / window.innerHeight - 0.5
                const r = wrap.getBoundingClientRect()
                ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
            }
            const pick = () => {
                ray.setFromCamera(ndc, camera)
                const hit = ray.intersectObjects(root.children, true)[0]
                let o = hit?.object as import('three').Object3D | undefined
                while (o && !o.userData.obj) o = o.parent ?? undefined
                return (o?.userData.obj as Obj | undefined) ?? null
            }
            const onClick = () => {
                const o = pick()
                if (o) o.flipStart = clock()
                else pulseStart = clock()
            }
            const onLeave = () => ndc.set(9, 9)
            window.addEventListener('pointermove', onPointer, { passive: true })
            wrap.addEventListener('click', onClick)
            wrap.addEventListener('pointerleave', onLeave)

            const spring = (t: number) => (t <= 0 ? 0 : 1 - Math.exp(-7 * t) * Math.cos(11 * t))
            const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
            let frame = 0
            const render = (now: number) => {
                const t = reduced ? 6 : (now - startTime) / 1000
                lean.x += (target.x - lean.x) * 0.06
                lean.y += (target.y - lean.y) * 0.06

                // Hover check a few times a second is plenty
                if (!coarse && frame++ % 3 === 0) {
                    const h = pick()
                    if (h !== hovered) {
                        if (hovered) hovered.popTarget = 0
                        hovered = h
                        if (h) h.popTarget = 1
                        wrap.style.cursor = h ? 'pointer' : ''
                    }
                }

                for (const o of objs) {
                    const g = o.group
                    const appear = reduced ? 1 : spring(t - 0.3 - o.delay)
                    o.pop += (o.popTarget - o.pop) * 0.15
                    const s = appear * (1 + o.pop * 0.12)
                    g.scale.setScalar(Math.max(s, 0.0001))
                    const bob = reduced ? 0 : Math.sin(t * 0.9 + o.phase) * 0.05
                    g.position.set(
                        o.home.x - lean.x * o.depth * 0.5,
                        o.home.y + bob + lean.y * o.depth * 0.3,
                        o.home.z,
                    )
                    const flipP = ease((t - o.flipStart) / 0.9)
                    const wob = reduced ? 0 : Math.sin(t * 0.6 + o.phase) * 0.08
                    g.rotation.set(
                        o.baseRot.x + wob * 0.6 + lean.y * 0.2,
                        o.baseRot.y + wob + lean.x * 0.35 + flipP * Math.PI * 2 + o.pop * Math.sin(t * 6) * 0.08,
                        o.baseRot.z,
                    )
                }
                ribbonObj.group.rotation.y = Math.sin(t * 0.25) * 0.25 + lean.x * 0.3

                // The message light, the typing dots, the recording light, the lock
                const since = (t - pulseStart) % 5.5
                const prog = ease(since / 2.4)
                coreMat.uniforms.progress.value = since < 2.8 ? prog : -1
                coreMat.uniforms.on.value = since < 2.4 ? 1 : 1 - ease((since - 2.4) / 0.4)
                dots.forEach((d, i) => (d.position.y = Math.max(0, Math.sin(t * 6 - i * 0.7)) * 0.06))
                recMat.emissiveIntensity = Math.sin(t * 3) > 0 ? 1.8 : 0.3
                const lockCycle = t % 4
                const open = lockCycle < 1.2 ? ease(lockCycle / 0.3) * (1 - ease((lockCycle - 0.9) / 0.15)) : 0
                shackle.position.y = 0.04 + open * 0.06
                const snap = lockCycle > 1.05 && lockCycle < 1.6 ? 1 - ease((lockCycle - 1.05) / 0.55) : 0
                ;(lockBody.material as import('three').MeshPhysicalMaterial).emissive.setHex(AMBER)
                ;(lockBody.material as import('three').MeshPhysicalMaterial).emissiveIntensity = snap * 0.8
                shieldObj.group.scale.multiplyScalar(1 + snap * 0.05)
                dust.rotation.z = t * 0.01

                renderer.render(scene, camera)
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
                wrap.removeEventListener('click', onClick)
                wrap.removeEventListener('pointerleave', onLeave)
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
            className="relative w-full aspect-[5/4] sm:aspect-[16/11] select-none"
            role="img"
            aria-label="Floating 3D objects: the Strangers Connect S as a glass ribbon, a video camera, a chat bubble that is typing, and a glass shield with a lock"
        >
            {fallback && (
                <div className="absolute inset-0 grid place-items-center">
                    <LogoMark className="h-40 w-40" />
                </div>
            )}
        </div>
    )
}
