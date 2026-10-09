// The hero scene: two people in video frames greet each other. Hand-drawn feel comes
// from the shapes alone (no raster filters on the strokes), so it stays crisp when the
// scroll animation zooms in.

const INK = '#ece9e2'
const BLUE = '#7cb4ff'
const PINK = '#ff8fc8'

function Person({ variant, color }: { variant: 'a' | 'b'; color: string }) {
    const hx = variant === 'a' ? 132 : 28
    const dir = variant === 'a' ? 1 : -1
    return (
        <g fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path className="draw" style={{ ['--len' as string]: 260, ['--delay' as string]: '0.5s' }} d="M18 150 C 26 118, 54 106, 80 104 C 108 106, 136 118, 144 150" />
            <path className="draw" style={{ ['--len' as string]: 220, ['--delay' as string]: '0.7s' }} d="M80 32 C 103 31, 112 50, 111 66 C 110 86, 97 98, 80 98 C 62 98, 49 86, 49 66 C 48 48, 59 33, 80 32 Z" />
            {variant === 'a' ? (
                <path className="draw" style={{ ['--len' as string]: 200, ['--delay' as string]: '0.9s' }} d="M50 62 C 46 38, 62 22, 82 24 C 100 25, 116 38, 112 60 C 104 46, 92 40, 80 44 C 68 40, 58 48, 50 62" />
            ) : (
                <path className="draw" style={{ ['--len' as string]: 200, ['--delay' as string]: '0.9s' }} d="M48 56 C 50 34, 64 22, 80 22 C 98 22, 112 34, 113 56 M46 56 C 66 50, 94 50, 115 56 M80 22 C 80 18, 82 15, 85 15" />
            )}
            {/* eyes, blush, open happy mouth */}
            <path d="M69 64 l0.01 0 M91 64 l0.01 0" strokeWidth="3.2" />
            <circle cx="62" cy="76" r="4.5" fill={color} fillOpacity="0.18" stroke="none" />
            <circle cx="98" cy="76" r="4.5" fill={color} fillOpacity="0.18" stroke="none" />
            <path d="M70 78 C 74 89, 86 89, 90 78 Z" fill={color} fillOpacity="0.28" />
            {/* waving hand toward the other frame */}
            <g className="wave" style={{ ['--delay' as string]: variant === 'a' ? '1.6s' : '2.5s' }}>
                <path d={`M${hx} 128 L ${hx} 98`} />
                <path d={`M${hx - 7} 99 C ${hx - 9} 85, ${hx - 6} 77, ${hx} 77 C ${hx + 6} 77, ${hx + 9} 85, ${hx + 7} 99 Z`} fill="#131316" />
                <path d={`M${hx - 4} 81 L ${hx - 4} 71 M${hx} 78 L ${hx} 67 M${hx + 4} 81 L ${hx + 4} 71`} />
                <path d={`M${hx + dir * 14} 74 q ${dir * 6} 6 0 12 M${hx + dir * 20} 70 q ${dir * 8} 10 0 20`} stroke={color} strokeOpacity="0.85" />
            </g>
        </g>
    )
}

const LINK = 'M150 220 C 160 300, 250 250, 290 300 C 320 338, 340 300, 372 262'

export function HeroArt() {
    return (
        <svg viewBox="0 0 560 470" className="w-full h-auto overflow-visible" role="img" aria-label="Two people in video frames say hey and hi, connected by a glowing line">
            <defs>
                <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="b" />
                    <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <linearGradient id="hero-link-grad" x1="150" y1="220" x2="372" y2="262" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={BLUE} />
                    <stop offset="1" stopColor={PINK} />
                </linearGradient>
                <linearGradient id="hero-heart" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={BLUE} />
                    <stop offset="1" stopColor={PINK} />
                </linearGradient>
            </defs>

            {/* you */}
            <g transform="translate(36 40) rotate(-4)">
                <rect x="0" y="0" width="200" height="168" rx="16" fill="#131316" stroke={INK} strokeOpacity="0.85" strokeWidth="1.6" className="draw" style={{ ['--len' as string]: 760 }} />
                <rect data-anim="frame-a" x="0" y="0" width="200" height="168" rx="16" fill="none" stroke={BLUE} strokeWidth="2.4" opacity="0" filter="url(#hero-glow)" />
                <rect x="3" y="4" width="200" height="168" rx="16" fill="none" stroke={INK} strokeOpacity="0.18" strokeWidth="1" />
                <g transform="translate(20 16)"><Person variant="a" color={BLUE} /></g>
                <circle cx="20" cy="20" r="3.5" fill={BLUE} className="breathe" />
                <text x="30" y="24" fill={INK} fillOpacity="0.55" fontSize="11" fontFamily="var(--font-mono)">you</text>
            </g>

            {/* someone new */}
            <g transform="translate(318 238) rotate(3.5)">
                <rect x="0" y="0" width="200" height="168" rx="16" fill="#131316" stroke={INK} strokeOpacity="0.85" strokeWidth="1.6" className="draw" style={{ ['--len' as string]: 760, ['--delay' as string]: '0.3s' }} />
                <rect data-anim="frame-b" x="0" y="0" width="200" height="168" rx="16" fill="none" stroke={PINK} strokeWidth="2.4" opacity="0" filter="url(#hero-glow)" />
                <rect x="-3" y="4" width="200" height="168" rx="16" fill="none" stroke={INK} strokeOpacity="0.18" strokeWidth="1" />
                <g transform="translate(20 16)"><Person variant="b" color={PINK} /></g>
                <circle cx="20" cy="20" r="3.5" fill={PINK} className="breathe" />
                <text x="30" y="24" fill={INK} fillOpacity="0.55" fontSize="11" fontFamily="var(--font-mono)">someone new</text>
            </g>

            {/* "hey!" */}
            <g transform="translate(246 46)">
                <g data-anim="bubble-a" style={{ transformBox: 'fill-box', transformOrigin: '10% 100%' }}>
                    <g className="pop" style={{ ['--delay' as string]: '1.8s', transformOrigin: '10% 100%' }}>
                        <path d="M8 4 C 34 -2, 82 -2, 98 6 C 110 12, 110 38, 96 44 C 78 50, 44 50, 30 46 L 10 60 L 18 44 C 4 40, -2 28, 0 18 C 1 10, 4 6, 8 4 Z" fill="#131316" stroke={BLUE} strokeWidth="1.8" strokeLinejoin="round" />
                        <text x="26" y="32" fill={BLUE} fontSize="22" fontStyle="italic" fontFamily="var(--font-serif)">hey!</text>
                    </g>
                </g>
            </g>

            {/* "hi!" */}
            <g transform="translate(200 172)">
                <g data-anim="bubble-b" style={{ transformBox: 'fill-box', transformOrigin: '95% 100%' }}>
                    <g className="pop" style={{ ['--delay' as string]: '2.7s', transformOrigin: '95% 100%' }}>
                        <path d="M8 4 C 30 -2, 72 -2, 88 6 C 100 12, 100 38, 86 44 L 96 60 L 70 47 C 50 49, 22 48, 12 44 C 0 38, -2 26, 0 18 C 1 10, 4 6, 8 4 Z" fill="#131316" stroke={PINK} strokeWidth="1.8" strokeLinejoin="round" />
                        <text x="30" y="32" fill={PINK} fontSize="22" fontStyle="italic" fontFamily="var(--font-serif)">hi!</text>
                    </g>
                </g>
            </g>

            {/* doodles */}
            <g fill="none" strokeWidth="1.3" strokeLinecap="round">
                <path d="M470 92 l0 18 M461 101 l18 0 M464 95 l12 12 M476 95 l-12 12" stroke={PINK} strokeOpacity="0.7" />
                <path d="M70 330 C 80 320, 92 340, 102 330 C 112 320, 124 340, 134 330" stroke={BLUE} strokeOpacity="0.7" />
                <path d="M500 190 C 506 186, 512 192, 508 198" stroke={INK} strokeOpacity="0.5" />
                <circle cx="150" cy="420" r="2" stroke={INK} strokeOpacity="0.5" />
                <circle cx="430" cy="40" r="2" stroke={INK} strokeOpacity="0.5" />
            </g>

            {/* the connection, blue to pink, with a light travelling each way */}
            <path id="hero-link" d={LINK} fill="none" stroke={INK} strokeOpacity="0.28" strokeWidth="1.4" className="signal" />
            <path data-anim="link" d={LINK} fill="none" stroke="url(#hero-link-grad)" strokeOpacity="0.75" strokeWidth="1.8" filter="url(#hero-glow)" className="draw" style={{ ['--len' as string]: 400, ['--delay' as string]: '1.2s' }} />
            <circle r="4.5" fill={BLUE} filter="url(#hero-glow)">
                <animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                    <mpath href="#hero-link" />
                </animateMotion>
            </circle>
            <circle r="4.5" fill={PINK} filter="url(#hero-glow)">
                <animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                    <mpath href="#hero-link" />
                </animateMotion>
            </circle>

            {/* privacy lock on the line */}
            <g transform="translate(276 286)" fill="#0e0e10" stroke={INK} strokeWidth="1.4" strokeLinecap="round">
                <rect x="0" y="10" width="26" height="20" rx="4" />
                <path d="M6 10 V 6 C 6 -1, 20 -1, 20 6 V 10" fill="none" />
                <circle cx="13" cy="20" r="2" fill={PINK} stroke="none" />
            </g>

        </svg>
    )
}
