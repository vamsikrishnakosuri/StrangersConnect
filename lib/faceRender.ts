// GPU face effects, all on the user's device:
// - smooth warps (big eyes, alien head) done in a fragment shader on the video
// - face paints wrapped onto MediaPipe's 3D face mesh, so they follow head turns
// Built on three.js (MIT) and MediaPipe's canonical face mesh (Apache 2.0).

import * as THREE from 'three'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FACE_TRIANGLES, FACE_UVS } from './faceMesh'
import { paintFaceTexture, type PaintName } from './faceTextures'

export type WarpName = 'bigeyes' | 'alien' | 'bignose'

const MAX_BULGES = 4

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Each bulge pulls samples toward its centre (strength > 1 magnifies, < 1 pinches),
// easing back to normal at the rim so there is no visible edge.
const fragmentShader = /* glsl */ `
uniform sampler2D map;
uniform vec2 size;
uniform vec4 bulges[${MAX_BULGES}];
varying vec2 vUv;
void main() {
    vec2 p = vUv * size;
    for (int i = 0; i < ${MAX_BULGES}; i++) {
        vec4 b = bulges[i];
        if (b.z <= 0.0) continue;
        vec2 d = p - b.xy;
        float r = length(d);
        if (r > 0.0 && r < b.z) {
            float t = r / b.z;
            float nt = mix(pow(t, b.w), t, smoothstep(0.65, 1.0, t));
            p = b.xy + d * (nt / t);
        }
    }
    gl_FragColor = texture2D(map, p / size);
}
`

type P = { x: number; y: number }
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)

export class FaceRenderer {
    readonly canvas: HTMLCanvasElement
    private renderer: THREE.WebGLRenderer
    private scene = new THREE.Scene()
    private camera: THREE.OrthographicCamera
    private videoTex: THREE.CanvasTexture
    private bgMat: THREE.ShaderMaterial
    private geo: THREE.BufferGeometry
    private positions: Float32Array
    private faceMesh: THREE.Mesh
    private paints = new Map<PaintName, THREE.CanvasTexture>()

    constructor(frame: HTMLCanvasElement) {
        const w = frame.width
        const h = frame.height
        this.canvas = document.createElement('canvas')
        this.canvas.width = w
        this.canvas.height = h
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false })
        this.renderer.setSize(w, h, false)
        // Pass colours straight through: the input is already display-ready video
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace

        this.camera = new THREE.OrthographicCamera(0, w, h, 0, 0.1, 10000)
        this.camera.position.z = 5000

        this.videoTex = new THREE.CanvasTexture(frame)
        this.videoTex.colorSpace = THREE.NoColorSpace
        this.videoTex.minFilter = THREE.LinearFilter

        const bulges = Array.from({ length: MAX_BULGES }, () => new THREE.Vector4(0, 0, 0, 1))
        this.bgMat = new THREE.ShaderMaterial({
            uniforms: { map: { value: this.videoTex }, size: { value: new THREE.Vector2(w, h) }, bulges: { value: bulges } },
            vertexShader,
            fragmentShader,
            depthTest: false,
            depthWrite: false,
        })
        const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.bgMat)
        bg.position.set(w / 2, h / 2, 0)
        bg.renderOrder = 0
        this.scene.add(bg)

        this.positions = new Float32Array(468 * 3)
        this.geo = new THREE.BufferGeometry()
        this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
        this.geo.setAttribute('uv', new THREE.BufferAttribute(FACE_UVS, 2))
        this.geo.setIndex(new THREE.BufferAttribute(FACE_TRIANGLES, 1))
        const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: true, side: THREE.DoubleSide })
        this.faceMesh = new THREE.Mesh(this.geo, mat)
        this.faceMesh.renderOrder = 1
        this.faceMesh.frustumCulled = false
        this.scene.add(this.faceMesh)
    }

    private paint(name: PaintName) {
        let tex = this.paints.get(name)
        if (!tex) {
            tex = new THREE.CanvasTexture(paintFaceTexture(name))
            tex.colorSpace = THREE.NoColorSpace
            tex.anisotropy = 4
            this.paints.set(name, tex)
        }
        return tex
    }

    /** Renders one frame. lm may be null when no face is visible. */
    render(lm: NormalizedLandmark[] | null, effect: { warp?: WarpName; paint?: PaintName }): HTMLCanvasElement {
        const w = this.canvas.width
        const h = this.canvas.height
        this.videoTex.needsUpdate = true

        const bulges = this.bgMat.uniforms.bulges.value as THREE.Vector4[]
        bulges.forEach((b) => b.set(0, 0, 0, 1))
        const mat = this.faceMesh.material as THREE.MeshBasicMaterial
        this.faceMesh.visible = false

        if (lm) {
            // Shader space has y going up
            const pt = (i: number): P => ({ x: lm[i].x * w, y: (1 - lm[i].y) * h })
            const faceW = dist(pt(234), pt(454))
            const eyeW = (dist(pt(33), pt(133)) + dist(pt(362), pt(263))) / 2
            const iris = lm.length > 477
            const eyeA = iris ? pt(468) : pt(159)
            const eyeB = iris ? pt(473) : pt(386)

            if (effect.warp === 'bigeyes') {
                bulges[0].set(eyeA.x, eyeA.y, eyeW * 1.35, 1.7)
                bulges[1].set(eyeB.x, eyeB.y, eyeW * 1.35, 1.7)
            } else if (effect.warp === 'alien') {
                const top = pt(10)
                const chin = pt(152)
                const head = { x: top.x + (top.x - chin.x) * 0.15, y: top.y + (top.y - chin.y) * 0.15 }
                bulges[0].set(head.x, head.y, faceW * 0.85, 1.45)
                bulges[1].set(eyeA.x, eyeA.y, eyeW * 1.5, 1.6)
                bulges[2].set(eyeB.x, eyeB.y, eyeW * 1.5, 1.6)
                const mouth = pt(13)
                bulges[3].set(mouth.x, mouth.y, faceW * 0.32, 0.7)
            } else if (effect.warp === 'bignose') {
                const nose = pt(4)
                bulges[0].set(nose.x, nose.y, dist(pt(98), pt(327)) * 1.5, 1.9)
            }

            if (effect.paint) {
                for (let i = 0; i < 468; i++) {
                    this.positions[i * 3] = lm[i].x * w
                    this.positions[i * 3 + 1] = (1 - lm[i].y) * h
                    // MediaPipe z is negative toward the camera; nearer points draw on top
                    this.positions[i * 3 + 2] = -lm[i].z * w
                }
                this.geo.attributes.position.needsUpdate = true
                mat.map = this.paint(effect.paint)
                mat.needsUpdate = true
                this.faceMesh.visible = true
            }
        }

        this.renderer.render(this.scene, this.camera)
        return this.canvas
    }

    dispose() {
        this.paints.forEach((t) => t.dispose())
        this.videoTex.dispose()
        this.geo.dispose()
        this.bgMat.dispose()
        ;(this.faceMesh.material as THREE.Material).dispose()
        this.renderer.dispose()
        this.renderer.forceContextLoss()
    }
}
