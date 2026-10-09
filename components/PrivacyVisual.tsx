'use client'

import { useEffect, useState } from 'react'
import type React from 'react'

// The "Private by design" visual: two people joined by a locked tunnel, a server that
// can only introduce them, and a live demo of a message scrambling in transit.

const INK = '#ece9e2'
const BLUE = '#7cb4ff'
const TEAL = '#5eead4'
const CYAN = '#67e8f9'

const PATH = 'M150 232 C 250 272, 390 272, 490 232'

function Person({ x, y, color }: { x: number; y: number; color: string }) {
    return (
        <g transform={`translate(${x} ${y})`}>
            <circle cx="0" cy="-10" r="9" fill={color} fillOpacity="0.9" />
            <path d="M-17 18 C -15 4, 15 4, 17 18 Z" fill={color} fillOpacity="0.9" />
        </g>
    )
}

function Packet({ begin, reverse }: { begin: string; reverse?: boolean }) {
    return (
        <g>
            <rect x="-9" y="-7" width="18" height="14" rx="3.5" fill="#0b1118" stroke={CYAN} strokeWidth="1.3" />
            <path d="M-4 -7 V -10 C -4 -14, 4 -14, 4 -10 V -7" fill="none" stroke={CYAN} strokeWidth="1.3" />
            <circle cx="0" cy="0" r="1.6" fill={CYAN} />
            <animateMotion dur="3.6s" begin={begin} repeatCount="indefinite" keyPoints={reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" path={PATH} />
        </g>
    )
}

export function PrivacyDiagramV2() {
    return (
        <svg viewBox="0 0 640 330" className="w-full h-auto" role="img" aria-label="You and the other person are joined by a locked tunnel. Our server only introduces you and cannot see the call.">
            <defs>
                <linearGradient id="pv-tunnel" x1="150" y1="0" x2="490" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={BLUE} />
                    <stop offset="1" stopColor={TEAL} />
                </linearGradient>
                <filter id="pv-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="5" result="b" />
                    <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <radialGradient id="pv-spot" cx="50%" cy="60%" r="60%">
                    <stop offset="0" stopColor={TEAL} stopOpacity="0.12" />
                    <stop offset="1" stopColor={TEAL} stopOpacity="0" />
                </radialGradient>
            </defs>
            <rect x="0" y="0" width="640" height="330" fill="url(#pv-spot)" />

            {/* Server: introduces you, then cannot see anything */}
            <g transform="translate(240 22)">
                <rect x="0" y="0" width="160" height="52" rx="12" fill="#0d1219" stroke={INK} strokeOpacity="0.25" />
                <g transform="translate(22 26)" fill="none" stroke={INK} strokeOpacity="0.75" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M-12 0 C -7 -8, 7 -8, 12 0 C 7 8, -7 8, -12 0 Z" />
                    <circle cx="0" cy="0" r="3" />
                    <path d="M-12 -9 L 12 9" stroke="#e5735f" strokeOpacity="0.9" />
                </g>
                <text x="46" y="23" fill={INK} fillOpacity="0.85" fontSize="12" fontFamily="var(--font-sans)">our server</text>
                <text x="46" y="39" fill={INK} fillOpacity="0.5" fontSize="10" fontFamily="var(--font-mono)">can&apos;t see calls</text>
            </g>
            <g fill="none" stroke={INK} strokeOpacity="0.28" strokeWidth="1.2" strokeDasharray="2 6" strokeLinecap="round">
                <path d="M240 50 C 190 60, 140 110, 112 160" />
                <path d="M400 50 C 450 60, 500 110, 528 158" />
            </g>
            <text x="320" y="100" textAnchor="middle" fill={INK} fillOpacity="0.4" fontSize="10.5" fontFamily="var(--font-mono)">only introduces you</text>

            {/* You: phone */}
            <g transform="translate(70 150)">
                <rect x="0" y="0" width="84" height="150" rx="18" fill="#0d1219" stroke={BLUE} strokeOpacity="0.7" strokeWidth="1.5" />
                <rect x="32" y="9" width="20" height="4" rx="2" fill={INK} fillOpacity="0.25" />
                <Person x={42} y={78} color={BLUE} />
                <text x="42" y="132" textAnchor="middle" fill={INK} fillOpacity="0.6" fontSize="11" fontFamily="var(--font-mono)">you</text>
            </g>

            {/* Them: laptop */}
            <g transform="translate(478 156)">
                <rect x="6" y="0" width="128" height="86" rx="10" fill="#0d1219" stroke={TEAL} strokeOpacity="0.7" strokeWidth="1.5" />
                <path d="M-6 98 L 146 98 L 134 86 L 6 86 Z" fill="#0d1219" stroke={TEAL} strokeOpacity="0.5" strokeWidth="1.3" />
                <Person x={70} y={50} color={TEAL} />
                <text x="70" y="122" textAnchor="middle" fill={INK} fillOpacity="0.6" fontSize="11" fontFamily="var(--font-mono)">them</text>
            </g>

            {/* The locked tunnel */}
            <path d={PATH} fill="none" stroke="url(#pv-tunnel)" strokeOpacity="0.12" strokeWidth="22" strokeLinecap="round" />
            <path d={PATH} fill="none" stroke="url(#pv-tunnel)" strokeWidth="1.8" filter="url(#pv-glow)" className="draw" style={{ ['--len' as string]: 400 }} />
            <path d={PATH} fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="1" className="signal" />
            {/* A steady stream of light particles flowing both ways */}
            {Array.from({ length: 14 }, (_, k) => (
                <circle key={k} r={k % 3 === 0 ? 1.8 : 1.1} fill={k % 2 ? CYAN : BLUE} opacity={0.75}>
                    <animateMotion
                        dur={`${2.2 + (k % 4) * 0.35}s`}
                        begin={`${-(k * 0.31).toFixed(2)}s`}
                        repeatCount="indefinite"
                        keyPoints={k % 2 ? '1;0' : '0;1'}
                        keyTimes="0;1"
                        calcMode="linear"
                        path={PATH}
                    />
                </circle>
            ))}

            {/* Shield at the middle of the tunnel, sending out slow pulses */}
            <g transform="translate(320 262)">
                {[0, 1.2, 2.4].map((d) => (
                    <circle key={d} r="14" fill="none" stroke={CYAN} strokeWidth="1" opacity="0">
                        <animate attributeName="r" values="12;40" dur="3.6s" begin={`${d}s`} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.55;0" dur="3.6s" begin={`${d}s`} repeatCount="indefinite" />
                    </circle>
                ))}
                <path d="M0 -13 L 11 -8.5 V 0 C 11 7, 6 11.5, 0 14 C -6 11.5, -11 7, -11 0 V -8.5 Z" fill="#0b1118" stroke={CYAN} strokeWidth="1.4" filter="url(#pv-glow)" />
                <path d="M-4.5 0.5 L -1 4 L 5 -3" fill="none" stroke={CYAN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <Packet begin="0s" />
            <Packet begin="1.2s" reverse />
            <Packet begin="2.4s" />
            <text x="320" y="306" textAnchor="middle" fill={CYAN} fillOpacity="0.85" fontSize="11" fontFamily="var(--font-mono)">
                locked end to end
            </text>
        </svg>
    )
}

const PHRASES = ['hey, where are you from?', 'nice to meet you!', 'what music are you into?', 'love your room setup']
const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789#$%&*+=?@'

function scramble(text: string) {
    return Array.from(text, (ch) => (ch === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('')
}

/** A sentence types out on your side, travels scrambled, and is read clearly on theirs. */
export function MessageJourney() {
    const [phrase, setPhrase] = useState(0)
    const [typed, setTyped] = useState('')
    const [noise, setNoise] = useState('')
    const [delivered, setDelivered] = useState(false)

    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const text = PHRASES[phrase]
        if (reduced) {
            setTyped(text)
            setNoise(scramble(text))
            setDelivered(true)
            return
        }
        let i = 0
        setTyped('')
        setDelivered(false)
        const typer = setInterval(() => {
            i++
            setTyped(text.slice(0, i))
            if (i >= text.length) clearInterval(typer)
        }, 55)
        const scrambler = setInterval(() => setNoise(scramble(text)), 90)
        const deliver = setTimeout(() => setDelivered(true), text.length * 55 + 900)
        const next = setTimeout(() => setPhrase((p) => (p + 1) % PHRASES.length), text.length * 55 + 3400)
        return () => {
            clearInterval(typer)
            clearInterval(scrambler)
            clearTimeout(deliver)
            clearTimeout(next)
        }
    }, [phrase])

    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <div className="rounded-2xl border border-[#7cb4ff]/30 bg-[#7cb4ff]/[0.06] px-3.5 py-2.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#7cb4ff]/80">You type</p>
                <p className="mt-1 min-h-[1.25rem] text-[13px] text-paper">
                    {typed}
                    <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-paper/70" />
                </p>
            </div>
            <span className="hidden text-paper-faint sm:block" aria-hidden="true">→</span>
            <div className="rounded-2xl border border-paper/10 bg-ink-950/60 px-3.5 py-2.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-paper-faint">On the way</p>
                <p className="mt-1 min-h-[1.25rem] truncate font-mono text-[12.5px] text-[#67e8f9]/80">{noise}</p>
            </div>
            <span className="hidden text-paper-faint sm:block" aria-hidden="true">→</span>
            <div className="rounded-2xl border border-[#5eead4]/30 bg-[#5eead4]/[0.06] px-3.5 py-2.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#5eead4]/80">They read</p>
                <p className={`mt-1 min-h-[1.25rem] text-[13px] text-paper transition-opacity duration-500 ${delivered ? 'opacity-100' : 'opacity-0'}`}>
                    {PHRASES[phrase]}
                </p>
            </div>
        </div>
    )
}

// Small icons for the privacy tiles
export function PrivacyIcon({ name }: { name: 'lock' | 'chat' | 'code' | 'trash' | 'mask' | 'shield' }) {
    const paths: Record<typeof name, React.ReactElement> = {
        lock: <><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
        chat: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5Z" /><path d="M9 10h.01M12 10h.01M15 10h.01" /></>,
        code: <><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 12h2M12 12h4" /></>,
        trash: <><path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" /></>,
        mask: <><circle cx="12" cy="9" r="4" /><path d="M5 20c1-4 13-4 14 0M4 4l16 16" /></>,
        shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" /><path d="M9 12l2 2 4-4" /></>,
    }
    return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {paths[name]}
        </svg>
    )
}
