import type React from 'react'

// Hand-drawn line art. A small displacement filter wobbles the strokes so they
// read as pen on paper rather than vector-perfect geometry.

const INK = '#ece9e2'
const GLOW = '#f2c14e'

function Sketchy({ id, scale = 1.6 }: { id: string; scale?: number }) {
    return (
        <defs>
            <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
                <feDisplacementMap in="SourceGraphic" scale={scale} />
            </filter>
            <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
    )
}

// A person sketched inside a video frame
function Portrait({ variant }: { variant: 'a' | 'b' }) {
    return (
        <g fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {/* shoulders */}
            <path className="draw" style={{ ['--len' as string]: 260, ['--delay' as string]: '0.5s' }} d="M18 150 C 26 118, 54 106, 80 104 C 108 106, 136 118, 144 150" />
            {/* head */}
            <path className="draw" style={{ ['--len' as string]: 220, ['--delay' as string]: '0.7s' }} d="M80 32 C 103 31, 112 50, 111 66 C 110 86, 97 98, 80 98 C 62 98, 49 86, 49 66 C 48 48, 59 33, 80 32 Z" />
            {variant === 'a' ? (
                // loose wavy hair
                <path className="draw" style={{ ['--len' as string]: 200, ['--delay' as string]: '0.9s' }} d="M50 62 C 46 38, 62 22, 82 24 C 100 25, 116 38, 112 60 C 104 46, 92 40, 80 44 C 68 40, 58 48, 50 62" />
            ) : (
                // beanie
                <path className="draw" style={{ ['--len' as string]: 200, ['--delay' as string]: '0.9s' }} d="M48 56 C 50 34, 64 22, 80 22 C 98 22, 112 34, 113 56 M46 56 C 66 50, 94 50, 115 56 M80 22 C 80 18, 82 15, 85 15" />
            )}
            {/* eyes and smile */}
            <path d="M69 66 l0.01 0 M91 66 l0.01 0" strokeWidth="3" />
            <path d="M70 80 C 76 86, 85 86, 91 80" />
        </g>
    )
}

export function HeroIllustration() {
    return (
        <svg viewBox="0 0 560 470" className="w-full h-auto" role="img" aria-label="Two people in video frames, connected by a glowing line">
            <Sketchy id="hero-sketch" />
            <g filter="url(#hero-sketch)">
                {/* left frame (you) */}
                <g transform="translate(36 40) rotate(-4)">
                    <rect x="0" y="0" width="200" height="168" rx="16" fill="#131316" stroke={INK} strokeOpacity="0.85" strokeWidth="1.6" className="draw" style={{ ['--len' as string]: 760 }} />
                    <rect x="3" y="4" width="200" height="168" rx="16" fill="none" stroke={INK} strokeOpacity="0.18" strokeWidth="1" />
                    <g transform="translate(20 16)"><Portrait variant="a" /></g>
                    <circle cx="20" cy="20" r="3.5" fill={GLOW} className="breathe" />
                    <text x="30" y="24" fill={INK} fillOpacity="0.55" fontSize="11" fontFamily="var(--font-mono)">you</text>
                </g>

                {/* right frame (stranger) */}
                <g transform="translate(318 238) rotate(3.5)">
                    <rect x="0" y="0" width="200" height="168" rx="16" fill="#131316" stroke={INK} strokeOpacity="0.85" strokeWidth="1.6" className="draw" style={{ ['--len' as string]: 760, ['--delay' as string]: '0.3s' }} />
                    <rect x="-3" y="4" width="200" height="168" rx="16" fill="none" stroke={INK} strokeOpacity="0.18" strokeWidth="1" />
                    <g transform="translate(20 16)"><Portrait variant="b" /></g>
                    <circle cx="20" cy="20" r="3.5" fill={GLOW} className="breathe" />
                    <text x="30" y="24" fill={INK} fillOpacity="0.55" fontSize="11" fontFamily="var(--font-mono)">someone new</text>
                </g>

                {/* speech bubble */}
                <g transform="translate(262 70)" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round">
                    <path className="draw" style={{ ['--len' as string]: 300, ['--delay' as string]: '1.4s' }} d="M10 6 C 40 0, 92 0, 112 8 C 124 14, 124 40, 110 46 C 90 52, 50 52, 34 48 L 16 62 L 22 46 C 6 42, 0 30, 2 20 C 3 12, 6 8, 10 6 Z" />
                    <text x="26" y="33" fill={INK} stroke="none" fontSize="20" fontStyle="italic" fontFamily="var(--font-serif)">hey, hi!</text>
                </g>

                {/* doodles */}
                <g fill="none" stroke={INK} strokeOpacity="0.6" strokeWidth="1.3" strokeLinecap="round">
                    <path d="M470 92 l0 18 M461 101 l18 0 M464 95 l12 12 M476 95 l-12 12" />
                    <path d="M70 330 C 80 320, 92 340, 102 330 C 112 320, 124 340, 134 330" />
                    <path d="M500 190 C 506 186, 512 192, 508 198" />
                    <circle cx="150" cy="420" r="2" />
                    <circle cx="430" cy="40" r="2" />
                </g>
            </g>

            {/* connection, drawn without the wobble so the motion reads smooth */}
            <path id="hero-link" d="M150 220 C 160 300, 250 250, 290 300 C 320 338, 340 300, 372 262" fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="1.4" className="signal" />
            <path d="M150 220 C 160 300, 250 250, 290 300 C 320 338, 340 300, 372 262" fill="none" stroke={GLOW} strokeOpacity="0.5" strokeWidth="1" filter="url(#hero-sketch-glow)" className="draw" style={{ ['--len' as string]: 400, ['--delay' as string]: '1.2s' }} />
            <circle r="4.5" fill={GLOW} filter="url(#hero-sketch-glow)">
                <animateMotion dur="3.6s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                    <mpath href="#hero-link" />
                </animateMotion>
            </circle>

            {/* lock on the line */}
            <g transform="translate(276 286)" fill="#0e0e10" stroke={INK} strokeWidth="1.4" strokeLinecap="round">
                <rect x="0" y="10" width="26" height="20" rx="4" />
                <path d="M6 10 V 6 C 6 -1, 20 -1, 20 6 V 10" fill="none" />
                <circle cx="13" cy="20" r="2" fill={GLOW} stroke="none" />
            </g>
        </svg>
    )
}

export function PrivacyDiagram() {
    return (
        <svg viewBox="0 0 640 300" className="w-full h-auto" role="img" aria-label="Video flows directly between you and the stranger. The server only handles the handshake.">
            <Sketchy id="priv-sketch" scale={1.3} />
            <g filter="url(#priv-sketch)" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {/* laptop: you */}
                <g transform="translate(40 150)">
                    <rect x="10" y="0" width="110" height="72" rx="8" />
                    <path d="M0 84 L 130 84 L 120 72 L 10 72 Z" />
                    <circle cx="65" cy="30" r="12" />
                    <path d="M45 62 C 50 48, 80 48, 85 62" />
                </g>
                {/* phone: stranger */}
                <g transform="translate(518 132)">
                    <rect x="0" y="0" width="66" height="112" rx="12" />
                    <path d="M26 8 L 40 8" />
                    <circle cx="33" cy="48" r="11" />
                    <path d="M15 80 C 20 66, 46 66, 51 80" />
                </g>
                {/* signaling server */}
                <g transform="translate(278 18)" strokeOpacity="0.7">
                    <rect x="0" y="0" width="84" height="26" rx="5" />
                    <rect x="0" y="32" width="84" height="26" rx="5" />
                    <path d="M12 13 l0.01 0 M12 45 l0.01 0" strokeWidth="3" />
                    <path d="M58 13 L 72 13 M58 45 L 72 45" />
                </g>
            </g>

            {/* handshake only: dotted */}
            <g fill="none" stroke={INK} strokeOpacity="0.4" strokeWidth="1.2" strokeDasharray="1 6" strokeLinecap="round">
                <path d="M110 148 C 150 80, 220 50, 274 46" />
                <path d="M366 46 C 430 50, 500 80, 548 128" />
            </g>

            {/* the media path: direct and glowing */}
            <path id="priv-link" d="M174 200 C 280 214, 380 214, 514 190" fill="none" stroke={GLOW} strokeWidth="1.6" filter="url(#priv-sketch-glow)" />
            <path d="M174 200 C 280 214, 380 214, 514 190" fill="none" stroke={INK} strokeOpacity="0.5" strokeWidth="1" className="signal" />
            <circle r="4" fill={GLOW} filter="url(#priv-sketch-glow)">
                <animateMotion dur="2.8s" repeatCount="indefinite"><mpath href="#priv-link" /></animateMotion>
            </circle>
            <circle r="4" fill={GLOW} filter="url(#priv-sketch-glow)">
                <animateMotion dur="2.8s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#priv-link" /></animateMotion>
            </circle>

            <g fontFamily="var(--font-mono)" fontSize="11" fill={INK}>
                <text x="105" y="258" fillOpacity="0.6">you</text>
                <text x="526" y="266" fillOpacity="0.6">stranger</text>
                <text x="320" y="96" fillOpacity="0.5" textAnchor="middle">signaling · handshake only</text>
                <text x="344" y="240" fill={GLOW} textAnchor="middle">video + audio · peer-to-peer · DTLS-SRTP</text>
            </g>
        </svg>
    )
}

// Small line icons, 32px, same pen
export function LineIcon({ name }: { name: 'camera' | 'shuffle' | 'next' | 'chat' | 'swap' | 'flag' | 'phone' | 'code' | 'nokey' }) {
    const paths: Record<typeof name, React.ReactElement> = {
        camera: <><rect x="4" y="9" width="17" height="14" rx="3" /><path d="M21 14 L 28 10 L 28 22 L 21 18" /><circle cx="9" cy="14" r="1" /></>,
        shuffle: <><path d="M4 10 C 12 10, 16 22, 26 22 M4 22 C 12 22, 16 10, 26 10" /><path d="M23 7 L 27 10 L 23 13 M23 19 L 27 22 L 23 25" /></>,
        next: <><path d="M6 8 L 18 16 L 6 24 Z" /><path d="M24 8 L 24 24" /></>,
        chat: <><path d="M5 8 C 5 6, 6 5, 8 5 L 24 5 C 26 5, 27 6, 27 8 L 27 18 C 27 20, 26 21, 24 21 L 13 21 L 7 26 L 8 21 C 6 21, 5 20, 5 18 Z" /><path d="M10 11 L 22 11 M10 15 L 18 15" /></>,
        swap: <><rect x="4" y="6" width="16" height="12" rx="2" /><rect x="14" y="14" width="14" height="12" rx="2" /></>,
        flag: <><path d="M7 28 L 7 5" /><path d="M7 6 C 12 3, 16 9, 25 6 L 25 17 C 16 20, 12 14, 7 17" /></>,
        phone: <><rect x="9" y="3" width="14" height="26" rx="3" /><path d="M14 7 L 18 7" /><circle cx="16" cy="24" r="1" /></>,
        code: <><path d="M11 9 L 4 16 L 11 23 M21 9 L 28 16 L 21 23 M18 6 L 14 26" /></>,
        nokey: <><circle cx="16" cy="12" r="5" /><path d="M7 27 C 8 20, 24 20, 25 27" /><path d="M5 5 L 27 27" /></>,
    }
    return (
        <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {paths[name]}
        </svg>
    )
}

export function SearchRings() {
    return (
        <svg viewBox="0 0 200 200" className="w-40 h-40" aria-hidden="true">
            <defs>
                <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" />
                </filter>
            </defs>
            {[0, 0.9, 1.8].map((d) => (
                <circle key={d} cx="100" cy="100" r="56" fill="none" stroke={INK} strokeOpacity="0.5" strokeWidth="1" className="ring" style={{ animationDelay: `${d}s` }} />
            ))}
            <circle cx="100" cy="100" r="7" fill={GLOW} filter="url(#ring-glow)" className="breathe" />
            <circle cx="100" cy="100" r="4" fill={GLOW} />
        </svg>
    )
}
