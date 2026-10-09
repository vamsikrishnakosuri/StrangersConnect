'use client'

import { FAQ } from '@/lib/site'
import { LineIcon, PrivacyDiagram } from './Illustrations'
import { HeroArt } from './HeroArt'
import ScrollScenes from './ScrollScenes'

type Props = {
    onStart: () => void
    isConnected: boolean
}

function Eyebrow({ children }: { children: React.ReactNode }) {
    return <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-paper-mute">{children}</p>
}

function StartButton({ onStart, isConnected, size = 'lg' }: Props & { size?: 'lg' | 'md' }) {
    return (
        <button
            onClick={onStart}
            disabled={!isConnected}
            className={`btn-primary ${size === 'lg' ? 'px-7 py-3.5 text-[15px]' : 'px-5 py-2.5 text-sm'}`}
        >
            <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-glow animate-ping opacity-60' : 'bg-paper-faint'}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-glow' : 'bg-paper-faint'}`} />
            </span>
            {isConnected ? 'Start a conversation' : 'Connecting…'}
        </button>
    )
}

// Handwritten ribbons of overheard small talk, in the spirit of Wispr's flowing text
function Ribbons() {
    const lines = [
        { d: 'M-40 520 C 120 380, 220 300, 330 120', text: 'hey! where are you from? · just moved to Lisbon · no way, me too · what are you listening to lately? · ' },
        { d: 'M1240 120 C 1080 260, 1020 420, 860 560', text: 'okay this is random but hi · it is 3am here · good morning from Seoul · you have a cool room · ' },
    ]
    return (
        <svg className="pointer-events-none absolute inset-0 w-full h-full hidden md:block" viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {lines.map((l, i) => (
                <g key={i}>
                    <path id={`ribbon-${i}`} d={l.d} fill="none" />
                    <text fontFamily="var(--font-serif)" fontStyle="italic" fontSize="17" fill="#ece9e2" fillOpacity="0.22" letterSpacing="0.5">
                        <textPath href={`#ribbon-${i}`}>
                            {l.text.repeat(2)}
                            <animate attributeName="startOffset" from="0%" to="-50%" dur="40s" repeatCount="indefinite" />
                        </textPath>
                    </text>
                </g>
            ))}
        </svg>
    )
}

export default function Landing({ onStart, isConnected }: Props) {
    return (
        <main>
            <ScrollScenes />
            {/* Hero */}
            <section className="relative" data-scene="hero">
                <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                    <div data-anim="blob-a" className="absolute inset-0"><div className="hero-blob hero-blob-a" /></div>
                    <div data-anim="blob-b" className="absolute inset-0"><div className="hero-blob hero-blob-b" /></div>
                    <div className="paper-grid absolute inset-0" />
                    <div data-anim="ribbons" className="absolute inset-0"><Ribbons /></div>
                </div>
                <div className="relative mx-auto max-w-page px-4 sm:px-6 pt-16 sm:pt-24 text-center">
                    <div data-anim="hero-text">
                    <div className="rise"><Eyebrow>Free random video chat</Eyebrow></div>
                    <h1 className="rise mt-6 font-serif text-[clamp(3rem,9vw,6.75rem)] leading-[0.95] tracking-[-0.02em] text-paper" style={{ ['--delay' as string]: '0.08s' }}>
                        Talk to someone new.
                        <br />
                        <em className="text-glow-soft">Nothing in between.</em>
                    </h1>
                    <p className="rise mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-paper-dim" style={{ ['--delay' as string]: '0.16s' }}>
                        One click puts you face to face with a stranger anywhere in the world. No sign-up, no app,
                        no feed. Just a conversation, sent peer-to-peer. The Omegle alternative, rebuilt with care.
                    </p>
                    <div className="rise mt-9 flex flex-col sm:flex-row items-center justify-center gap-3" style={{ ['--delay' as string]: '0.24s' }}>
                        <StartButton onStart={onStart} isConnected={isConnected} />
                        <a href="#how" className="btn-ghost px-6 py-3.5 text-[15px]">See how it works</a>
                    </div>
                    <p className="rise mt-5 font-mono text-[11px] text-paper-faint" style={{ ['--delay' as string]: '0.3s' }}>
                        Works in any browser on desktop, iPhone and Android · 18+
                    </p>
                    </div>
                    <div className="rise mx-auto mt-10 sm:mt-6 max-w-[620px]" style={{ ['--delay' as string]: '0.2s' }}>
                        <div data-anim="hero-art" className="origin-center">
                            <HeroArt />
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust strip */}
            <section aria-label="At a glance" className="border-y border-paper/10">
                <ul className="mx-auto max-w-page px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4">
                    {[
                        ['P2P', 'Video goes direct, browser to browser'],
                        ['No', 'Account, email or phone number'],
                        ['1 click', 'To skip to the next person'],
                        ['0', 'Messages or calls stored, ever'],
                    ].map(([k, v], i) => (
                        <li key={k} data-anim="stat" className={`py-7 px-4 sm:px-6 ${i > 0 ? 'md:border-l' : ''} ${i % 2 === 1 ? 'border-l' : ''} ${i > 1 ? 'border-t md:border-t-0' : ''} border-paper/10`}>
                            <p className="font-serif text-3xl text-paper">{k}</p>
                            <p className="mt-1 text-sm text-paper-mute">{v}</p>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Statement: words light up as you scroll */}
            <section data-scene="statement" className="relative flex min-h-[100svh] items-center">
                <div className="mx-auto w-full max-w-page px-4 sm:px-6 py-24">
                    <p className="font-serif text-[clamp(2.1rem,5.6vw,4.6rem)] leading-[1.06] tracking-[-0.015em] max-w-5xl">
                        {'Two strangers. One click. A real conversation, sent straight between you. Nothing stored. Nothing sold. Nothing in between.'
                            .split(' ')
                            .map((word, i) => (
                                <span key={i} data-anim="word" className="statement-word">
                                    {word}{' '}
                                </span>
                            ))}
                    </p>
                </div>
            </section>

            {/* How it works */}
            <section id="how" data-scene="how" className="mx-auto max-w-page px-4 sm:px-6 py-24 sm:py-32 scroll-mt-24">
                <div className="max-w-2xl">
                    <Eyebrow>How it works</Eyebrow>
                    <h2 className="mt-4 font-serif text-4xl sm:text-5xl leading-[1.05] tracking-[-0.01em]">
                        Three steps. <em className="text-paper-dim">No onboarding.</em>
                    </h2>
                </div>
                <div className="relative mt-14">
                <span data-anim="how-line" className="absolute left-0 top-0 h-px w-full origin-left bg-gradient-to-r from-glow/0 via-glow to-glow/0" aria-hidden="true" />
                <ol className="grid md:grid-cols-3 border-t border-paper/10">
                    {[
                        { n: '01', icon: 'camera' as const, t: 'Allow your camera', d: 'Your browser asks once. Nothing is installed and nothing is uploaded to us.' },
                        { n: '02', icon: 'shuffle' as const, t: 'Get matched', d: 'We pair you with the next person who is waiting, usually in a few seconds.' },
                        { n: '03', icon: 'next' as const, t: 'Talk, or move on', d: 'Chat as long as you like. Not a fit? Press Next and meet someone else.' },
                    ].map((s, i) => (
                        <li key={s.n} data-anim="step" className={`pt-8 pb-4 md:pr-10 ${i > 0 ? 'md:pl-10 md:border-l border-t md:border-t-0' : ''} border-paper/10`}>
                            <div className="flex items-center justify-between text-paper-dim">
                                <LineIcon name={s.icon} />
                                <span className="font-mono text-xs text-paper-faint">{s.n}</span>
                            </div>
                            <h3 className="mt-8 text-lg font-medium text-paper">{s.t}</h3>
                            <p className="mt-2 text-[15px] leading-relaxed text-paper-mute">{s.d}</p>
                        </li>
                    ))}
                </ol>
                </div>
            </section>

            {/* Privacy */}
            <section id="privacy" data-scene="privacy" className="border-y border-paper/10 bg-ink-850/60 scroll-mt-24">
                <div className="mx-auto max-w-page px-4 sm:px-6 py-24 sm:py-32 grid lg:grid-cols-[1fr_1.15fr] gap-14 items-center">
                    <div>
                        <Eyebrow>Privacy by architecture</Eyebrow>
                        <h2 className="mt-4 font-serif text-4xl sm:text-5xl leading-[1.05] tracking-[-0.01em]">
                            Your face never <em className="text-glow-soft">touches our server.</em>
                        </h2>
                        <p className="mt-6 text-[17px] leading-relaxed text-paper-dim max-w-lg">
                            Strangers Connect is built on WebRTC. Our server introduces two browsers, then steps out of the way.
                            Video and audio flow directly between you, encrypted in transit.
                        </p>
                        <ul className="mt-8 space-y-4 text-[15px]">
                            {[
                                ['Encrypted media', 'Every call uses DTLS-SRTP, the encryption standard built into every WebRTC call.'],
                                ['Encrypted chat', 'Messages are encrypted in your browser with a fresh key for every match. The server only ever sees scrambled text.'],
                                ['Safety code', 'Both of you see the same six digits. Read them aloud: if they match, nobody is in the middle.'],
                                ['Nothing saved', 'No recordings, no chat history, no database. Close the tab and it is gone.'],
                                ['No identity', 'No account, no email, no profile. IP addresses are never stored, only a one-way hash if someone is banned.'],
                                ['Community safety', 'One-tap reporting. Repeated reports trigger an automatic ban.'],
                            ].map(([t, d]) => (
                                <li key={t} data-anim="bullet" className="flex gap-4">
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-glow breathe" />
                                    <span><span className="text-paper">{t}.</span> <span className="text-paper-mute">{d}</span></span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div data-anim="diagram" className="rounded-2xl border border-paper/10 bg-ink-900 p-4 sm:p-8">
                        <PrivacyDiagram />
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" data-scene="features" className="mx-auto max-w-page px-4 sm:px-6 py-24 sm:py-32 scroll-mt-24">
                <div className="max-w-2xl">
                    <Eyebrow>Inside the call</Eyebrow>
                    <h2 className="mt-4 font-serif text-4xl sm:text-5xl leading-[1.05] tracking-[-0.01em]">
                        Small details, <em className="text-paper-dim">done right.</em>
                    </h2>
                </div>
                {/* A stacked deck that deals itself out as you scroll */}
                <div data-anim="deck" className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[
                        { icon: 'camera' as const, t: 'HD video', d: 'Adaptive quality that stays smooth on Wi-Fi or mobile data.', from: '#7cb4ff', to: '#a78bfa' },
                        { icon: 'chat' as const, t: 'Chat and emoji', d: 'Type, react with floating emoji, and break the ice. All end-to-end encrypted.', from: '#ff8fc8', to: '#ffb36b' },
                        { icon: 'next' as const, t: 'Next in one tap', d: 'Skip instantly and you are already searching for the next person.', from: '#5eead4', to: '#7cb4ff' },
                        { icon: 'swap' as const, t: 'Face filters', d: 'Bunny ears, big eyes, neon and more, or blur yourself for privacy. All on your device.', from: '#f2c14e', to: '#ff8fc8' },
                        { icon: 'flag' as const, t: 'Report and ban', d: 'Bad actors are removed automatically after reports from several people.', from: '#a78bfa', to: '#ff8fc8' },
                        { icon: 'nokey' as const, t: 'No account', d: 'No email, no phone number, no profile. Nothing to sign up for and nothing to leak.', from: '#86efac', to: '#5eead4' },
                    ].map((f, i) => (
                        <div key={f.t} data-anim="card" className="relative" style={{ zIndex: 10 + i }}>
                            <div
                                className="feature-card group h-full rounded-[22px] p-px transition-transform duration-500 hover:-translate-y-1.5"
                                style={{ ['--from' as string]: f.from, ['--to' as string]: f.to }}
                            >
                                <div className="relative h-full overflow-hidden rounded-[21px] bg-ink-900 p-7 sm:p-8">
                                    <div className="feature-card-glow" aria-hidden="true" />
                                    <div className="relative flex items-center justify-between">
                                        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-paper/10 bg-ink-850" style={{ color: f.from }}>
                                            <LineIcon name={f.icon} />
                                        </div>
                                        <span className="font-mono text-[11px] text-paper-faint">0{i + 1}</span>
                                    </div>
                                    <h3 className="relative mt-7 text-[18px] font-medium text-paper">{f.t}</h3>
                                    <p className="relative mt-2 text-[15px] leading-relaxed text-paper-mute">{f.d}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="border-t border-paper/10 scroll-mt-24">
                <div className="mx-auto max-w-page px-4 sm:px-6 py-24 sm:py-32 grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
                    <div>
                        <Eyebrow>Questions</Eyebrow>
                        <h2 className="mt-4 font-serif text-4xl sm:text-5xl leading-[1.05] tracking-[-0.01em]">
                            Looking for an <em className="text-glow-soft">Omegle alternative?</em>
                        </h2>
                        <p className="mt-6 text-paper-mute max-w-sm">
                            Everything you might want to know before you say hello to a stranger.
                        </p>
                    </div>
                    <div className="border-t border-paper/10">
                        {FAQ.map(({ q, a }) => (
                            <details key={q} className="group border-b border-paper/10">
                                <summary className="flex cursor-pointer items-center justify-between gap-6 py-6 text-[17px] text-paper hover:text-white">
                                    <h3 className="font-normal">{q}</h3>
                                    <span className="faq-plus font-mono text-xl text-paper-mute transition-transform duration-300">+</span>
                                </summary>
                                <p className="pb-6 pr-10 text-[15px] leading-relaxed text-paper-mute">{a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Closing CTA */}
            <section data-scene="closing" className="relative overflow-hidden border-t border-paper/10">
                <div className="paper-grid absolute inset-0 rotate-180" aria-hidden="true" />
                <div className="relative mx-auto max-w-page px-4 sm:px-6 py-28 sm:py-36 text-center">
                    <h2 data-anim="closing" className="font-serif text-[clamp(2.5rem,7vw,5rem)] leading-[1] tracking-[-0.02em]">
                        Someone is waiting
                        <br />
                        <em className="text-glow-soft">to say hello.</em>
                    </h2>
                    <div className="mt-10 flex justify-center">
                        <StartButton onStart={onStart} isConnected={isConnected} />
                    </div>
                </div>
            </section>
        </main>
    )
}
