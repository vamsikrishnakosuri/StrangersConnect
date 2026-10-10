'use client'

import type { ReactNode } from 'react'
import { FAQ } from '@/lib/site'
import { LineIcon } from './Illustrations'
import { MessageJourney, PrivacyDiagramV2 } from './PrivacyVisual'
import { GlassHero } from './GlassHero'
import { NoiseField } from './NoiseField'
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
            data-magnetic
            className={`btn-primary btn-sheen ${size === 'lg' ? 'px-7 py-3.5 text-[15px]' : 'px-5 py-2.5 text-sm'}`}
        >
            <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-glow animate-ping opacity-60' : 'bg-paper-faint'}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-glow' : 'bg-paper-faint'}`} />
            </span>
            {isConnected ? 'Start a conversation' : 'Connecting…'}
        </button>
    )
}

function GlanceIcon({ name }: { name: 'device' | 'gift' | 'globe' | 'lock' | 'vanish' | 'mask' | 'shield' }) {
    const paths: Record<typeof name, ReactNode> = {
        device: (<><rect x="6" y="3" width="12" height="18" rx="2.5" /><path d="M10.5 18h3" /></>),
        gift: (<><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zm0 0c1.5-3 5-4 5-1.5S14 9 12 9z" /></>),
        globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" /></>),
        lock: (<><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" /></>),
        vanish: (<><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></>),
        mask: (<><circle cx="12" cy="9" r="4" /><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /><path d="M3 3l18 18" /></>),
        shield: (<><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6L12 3z" /><path d="M8.8 12.2l2.2 2.2 4.4-4.6" /></>),
    }
    return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {paths[name]}
        </svg>
    )
}

export default function Landing({ onStart, isConnected }: Props) {
    return (
        <main>
            <ScrollScenes />
            {/* Hero: the stage stays on screen while the camera flies into the glass S */}
            <section className="relative h-[280svh]" data-scene="hero">
                <div className="sticky top-0 h-[100svh] overflow-hidden">
                    <div className="absolute inset-0" aria-hidden="true">
                        <div data-anim="field" className="absolute inset-0"><NoiseField /></div>
                        <div className="paper-grid absolute inset-0 opacity-60" />
                    </div>
                    <div className="rise absolute inset-0" style={{ ['--delay' as string]: '0.2s' }}>
                        <GlassHero />
                    </div>
                    <div className="pointer-events-none relative z-10 mx-auto max-w-page px-4 sm:px-6 pt-24 sm:pt-28 text-center">
                        <div data-anim="hero-text" className="pointer-events-auto">
                            <div className="rise"><Eyebrow>Free random video chat</Eyebrow></div>
                            <h1 className="rise mt-5 font-serif text-[clamp(2.8rem,8vw,6.25rem)] leading-[0.95] tracking-[-0.02em] text-paper" style={{ ['--delay' as string]: '0.08s' }}>
                                Talk to someone new.
                                <br />
                                <em className="text-glow-soft">Nothing in between.</em>
                            </h1>
                            <p className="rise mx-auto mt-6 max-w-xl text-[16px] sm:text-[17px] leading-relaxed text-paper-dim" style={{ ['--delay' as string]: '0.16s' }}>
                                One click puts you face to face with a stranger anywhere in the world. No sign-up, no app,
                                no feed. Just a private conversation, straight between you.
                            </p>
                            <div className="rise mt-8 flex flex-col sm:flex-row items-center justify-center gap-3" style={{ ['--delay' as string]: '0.24s' }}>
                                <StartButton onStart={onStart} isConnected={isConnected} />
                                <a href="#how" data-magnetic className="btn-ghost px-6 py-3.5 text-[15px]">See how it works</a>
                            </div>
                        </div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-ink-900" aria-hidden="true" />
                </div>
            </section>

            {/* Privacy: it rises out of the glass as the hero zoom ends */}
            <section id="privacy" data-scene="privacy" className="relative z-10 -mt-[70svh] scroll-mt-24">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[70svh] bg-gradient-to-b from-transparent to-ink-900" aria-hidden="true" />
                <div className="absolute inset-x-0 top-[70svh] bottom-0 bg-ink-900" aria-hidden="true" />
                <div data-anim="emerge" className="relative mx-auto max-w-[1320px] px-4 sm:px-6 pt-[30svh] pb-16">
                    <div className="grid lg:grid-cols-[0.75fr_1.4fr] gap-12 lg:gap-14 items-center" style={{ perspective: '1600px' }}>
                        <div>
                            <Eyebrow>Private by design</Eyebrow>
                            <h2 className="mt-4 font-serif text-4xl sm:text-5xl leading-[1.05] tracking-[-0.01em]">
                                Only the two of you <em className="text-glow-soft">can see the call.</em>
                            </h2>
                            <p className="mt-6 text-[17px] leading-relaxed text-paper-dim max-w-md">
                                Our server simply introduces you to someone new, then steps out of the way. Your video, voice
                                and words travel locked between the two of you.
                            </p>
                            <p className="mt-6 max-w-md border-l border-paper/15 pl-4 text-[14px] leading-relaxed text-paper-mute">
                                Want proof? Both of you see the same six-digit safety code. Read it aloud: if it matches,
                                nobody is in between.
                            </p>
                        </div>

                        {/* The diagram sits on the same flowing gradient as the hero */}
                        <div data-anim="diagram" className="relative overflow-hidden rounded-[32px] border border-paper/10 shadow-[0_60px_120px_-50px_rgba(242,193,78,0.25)]">
                            <div className="absolute inset-0" aria-hidden="true">
                                <NoiseField palette="warm" />
                                <div className="absolute inset-0 bg-ink-950/50" />
                            </div>
                            <div className="relative p-5 sm:p-8">
                                <PrivacyDiagramV2 />
                                <div className="mt-3 border-t border-paper/10 pt-4">
                                    <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.2em] text-paper-faint">What we see of your chat</p>
                                    <MessageJourney />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Four promises: cards lying in a row that slide sideways as you scroll down */}
                <div data-scene="pillars" className="relative h-[260svh]">
                    <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
                        <div className="mx-auto w-full max-w-page px-4 sm:px-6">
                            <Eyebrow>Four promises</Eyebrow>
                            <h3 className="mt-3 font-serif text-3xl sm:text-4xl tracking-[-0.01em] text-paper">What private means here.</h3>
                        </div>
                        <div data-anim="pillar-track" className="pillar-track mt-10 flex gap-5 sm:gap-7" style={{ perspective: '1400px' }}>
                            {[
                                { t: 'Locked', d: 'Video, voice and chat are locked on your device. Only the other person can open them.', icon: 'lock' as const },
                                { t: 'Unsaved', d: 'No recordings and no chat history. Close the tab and it is gone.', icon: 'vanish' as const },
                                { t: 'Anonymous', d: 'No account, email or profile. You start blurred until you choose.', icon: 'mask' as const },
                                { t: 'Protected', d: 'Links from strangers cannot be clicked, reporting takes one tap, repeat offenders are banned.', icon: 'shield' as const },
                            ].map((c, i) => (
                                <article key={c.t} data-anim="pillar" className="pillar-card">
                                    <div className="pillar-glow" aria-hidden="true" />
                                    <div className="relative flex items-start justify-between">
                                        <div className="glance-icon"><GlanceIcon name={c.icon} /></div>
                                        <span className="font-mono text-[12px] text-paper-faint">0{i + 1} / 04</span>
                                    </div>
                                    <h4 className="relative mt-auto font-serif text-[clamp(2.4rem,4.4vw,3.6rem)] leading-none tracking-[-0.015em] text-paper">{c.t}</h4>
                                    <p className="relative mt-4 max-w-[30ch] text-[15px] leading-relaxed text-paper-mute">{c.d}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* At a glance: three glass cards that flip up into place and tilt toward the pointer */}
            <section aria-label="At a glance" className="relative z-10 mx-auto max-w-page px-4 sm:px-6 pt-6 pb-10">
                <div className="grid gap-4 sm:grid-cols-3" style={{ perspective: '1400px' }}>
                    {[
                        { t: 'Works in your browser', d: 'iPhone, Android or laptop. Nothing to install and nothing to update.', icon: 'device' as const },
                        { t: 'Free, for real', d: 'No coins, no paywalls, no premium tier. Every feature for everyone.', icon: 'gift' as const },
                        { t: 'Meet the world', d: 'Someone new from anywhere, usually in a few seconds.', icon: 'globe' as const },
                    ].map((c) => (
                        <div key={c.t} data-anim="glance" className="glance-card">
                            <div data-tilt className="glance-inner">
                                <span className="glance-glare" aria-hidden="true" />
                                <div className="glance-icon"><GlanceIcon name={c.icon} /></div>
                                <h3 className="mt-6 text-[17px] font-medium text-paper">{c.t}</h3>
                                <p className="mt-2 text-[14.5px] leading-relaxed text-paper-mute">{c.d}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Statement: the line stays put while each word fills in as you scroll */}
            <section data-scene="statement" className="relative h-[240svh]">
                <div className="sticky top-0 flex h-[100svh] items-center">
                    <div className="mx-auto w-full max-w-page px-4 sm:px-6">
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
                            Before you <em className="text-glow-soft">say hello.</em>
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
