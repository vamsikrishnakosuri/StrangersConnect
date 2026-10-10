'use client'

import { useEffect } from 'react'

// Scroll-driven scenes for the landing page, in the spirit of Apple and Wispr Flow:
// smooth scrolling (Lenis, MIT) plus scrubbed animations (GSAP ScrollTrigger, free license).
// Nothing is pinned by JavaScript: sections that hold still use CSS position: sticky inside
// a tall section, so they can never land on top of each other when the layout shifts.
// Everything is skipped for people who ask their device for reduced motion.
export default function ScrollScenes() {
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        let cleanup = () => {}
        let cancelled = false

        ;(async () => {
            const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
                import('gsap'),
                import('gsap/ScrollTrigger'),
                import('lenis'),
            ])
            if (cancelled) return
            gsap.registerPlugin(ScrollTrigger)
            document.documentElement.classList.add('js-scroll')

            const lenis = new Lenis({ duration: 0.9, smoothWheel: true, anchors: { offset: -80 } })
            lenis.on('scroll', ScrollTrigger.update)
            const tick = (time: number) => lenis.raf(time * 1000)
            gsap.ticker.add(tick)
            gsap.ticker.lagSmoothing(0)

            const ctx = gsap.context(() => {
                const mm = gsap.matchMedia()

                // Hero: the headline drifts up and away while the 3D scene zooms (the scene
                // reads its own scroll position, so only the text and the field are animated here)
                gsap.timeline({
                    defaults: { ease: 'none' },
                    scrollTrigger: { trigger: '[data-scene="hero"]', start: 'top top', end: 'bottom bottom', scrub: 0.6 },
                })
                    .to('[data-anim="hero-text"]', { y: -140, opacity: 0, duration: 0.3 }, 0)
                    .to('[data-anim="field"]', { scale: 1.3, yPercent: -6, duration: 1 }, 0)

                // At a glance: the cards flip up from lying flat, one after another
                gsap.from('[data-anim="glance"]', {
                    rotateX: 55,
                    y: 90,
                    opacity: 0,
                    transformOrigin: '50% 100%',
                    duration: 1.1,
                    stagger: 0.12,
                    ease: 'power3.out',
                    scrollTrigger: { trigger: '[data-anim="glance"]', start: 'top 92%' },
                })

                // Statement: the line holds still (sticky) while each word fills in turn
                const words = gsap.utils.toArray<HTMLElement>('[data-anim="word"]')
                gsap.to(words, {
                    color: '#ece9e2',
                    stagger: 0.12,
                    ease: 'none',
                    scrollTrigger: { trigger: '[data-scene="statement"]', start: 'top top', end: 'bottom bottom', scrub: 0.5 },
                })

                // How it works: a glowing line sweeps across, then each step rises
                gsap.fromTo('[data-anim="how-line"]', { scaleX: 0 }, {
                    scaleX: 1,
                    ease: 'none',
                    scrollTrigger: { trigger: '[data-scene="how"]', start: 'top 70%', end: 'center 50%', scrub: true },
                })
                gsap.from('[data-anim="step"]', {
                    y: 50,
                    opacity: 0,
                    duration: 1,
                    stagger: 0.18,
                    ease: 'power3.out',
                    scrollTrigger: { trigger: '[data-scene="how"]', start: 'top 60%' },
                })

                // Privacy rises out of the glass: it starts large and blurred, then settles into focus
                gsap.fromTo('[data-anim="emerge"]', { opacity: 0, scale: 1.18, filter: 'blur(16px)' }, {
                    opacity: 1,
                    scale: 1,
                    filter: 'blur(0px)',
                    ease: 'none',
                    scrollTrigger: { trigger: '[data-anim="emerge"]', start: 'top 95%', end: 'top 30%', scrub: 0.8 },
                })
                // ...and the diagram tilts up from lying back as it comes into view
                gsap.fromTo('[data-anim="diagram"]', { rotateX: 32, scale: 0.86, y: 70, transformOrigin: '50% 100%' }, {
                    rotateX: 0,
                    scale: 1,
                    y: 0,
                    ease: 'none',
                    scrollTrigger: { trigger: '[data-anim="diagram"]', start: 'top 100%', end: 'top 35%', scrub: 0.8 },
                })

                // Promises: the row of cards slides sideways while the section holds still;
                // each card turns in 3D as it passes the middle of the screen
                const track = document.querySelector<HTMLElement>('[data-anim="pillar-track"]')
                const pillars = gsap.utils.toArray<HTMLElement>('[data-anim="pillar"]')
                if (track && pillars.length) {
                    const shift = () => Math.max(0, track.scrollWidth - window.innerWidth)
                    const turn = () => {
                        const mid = window.innerWidth / 2
                        pillars.forEach((card) => {
                            const r = card.getBoundingClientRect()
                            const off = (r.left + r.width / 2 - mid) / window.innerWidth
                            const a = Math.max(-1, Math.min(1, off * 1.6))
                            gsap.set(card, { rotateY: -a * 28, z: -Math.abs(a) * 120, opacity: 1 - Math.abs(a) * 0.35 })
                        })
                    }
                    gsap.to(track, {
                        x: () => -shift(),
                        ease: 'none',
                        scrollTrigger: {
                            trigger: '[data-scene="pillars"]',
                            start: 'top top',
                            end: 'bottom bottom',
                            scrub: 0.6,
                            invalidateOnRefresh: true,
                            onUpdate: turn,
                            onRefresh: turn,
                        },
                    })
                    turn()
                }

                // Features: the cards start as a stacked deck, then deal out into the grid
                // as the section scrolls into view (no pinning)
                mm.add('(min-width: 640px)', () => {
                    const deck = document.querySelector<HTMLElement>('[data-anim="deck"]')
                    const cards = gsap.utils.toArray<HTMLElement>('[data-anim="card"]')
                    if (!deck || !cards.length) return
                    const box = deck.getBoundingClientRect()
                    const cx = box.left + box.width / 2
                    const cy = box.top + box.height / 2
                    const offsets = cards.map((c) => {
                        const r = c.getBoundingClientRect()
                        return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) }
                    })
                    const tl = gsap.timeline({
                        scrollTrigger: { trigger: deck, start: 'top 85%', end: 'top 15%', scrub: 0.9 },
                    })
                    cards
                        .map((card, i) => ({ card, i }))
                        .reverse()
                        .forEach(({ card, i }, order) => {
                            tl.fromTo(
                                card,
                                { x: offsets[i].x, y: offsets[i].y + i * -4, rotation: (i - 2.5) * 3.2, scale: 0.92 },
                                { x: 0, y: 0, rotation: 0, scale: 1, ease: 'power2.inOut', duration: 1 },
                                order * 0.45,
                            )
                        })
                })
                mm.add('(max-width: 639px)', () => {
                    gsap.utils.toArray<HTMLElement>('[data-anim="card"]').forEach((card, i) => {
                        gsap.from(card, {
                            y: 60,
                            rotation: i % 2 ? 3 : -3,
                            opacity: 0,
                            duration: 0.9,
                            ease: 'power3.out',
                            scrollTrigger: { trigger: card, start: 'top 88%' },
                        })
                    })
                })

                // Closing line grows into place
                gsap.fromTo('[data-anim="closing"]', { scale: 0.86, opacity: 0.3, letterSpacing: '-0.04em' }, {
                    scale: 1,
                    opacity: 1,
                    letterSpacing: '-0.02em',
                    ease: 'none',
                    scrollTrigger: { trigger: '[data-scene="closing"]', start: 'top 90%', end: 'center 55%', scrub: 0.8 },
                })
            })

            // Magnetic buttons: they lean a little toward the pointer, then spring back
            const fine = window.matchMedia('(pointer: fine)').matches
            const offs: (() => void)[] = []
            if (fine) {
                gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((el) => {
                    const move = (e: PointerEvent) => {
                        const r = el.getBoundingClientRect()
                        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4, ease: 'power3.out' })
                    }
                    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
                    el.addEventListener('pointermove', move)
                    el.addEventListener('pointerleave', leave)
                    offs.push(() => {
                        el.removeEventListener('pointermove', move)
                        el.removeEventListener('pointerleave', leave)
                    })
                })

                // Tilt cards: they turn toward the pointer with a moving glare
                gsap.utils.toArray<HTMLElement>('[data-tilt]').forEach((el) => {
                    const move = (e: PointerEvent) => {
                        const r = el.getBoundingClientRect()
                        const px = (e.clientX - r.left) / r.width
                        const py = (e.clientY - r.top) / r.height
                        el.style.setProperty('--rx', `${((0.5 - py) * 14).toFixed(2)}deg`)
                        el.style.setProperty('--ry', `${((px - 0.5) * 16).toFixed(2)}deg`)
                        el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
                        el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
                    }
                    const leave = () => {
                        el.style.setProperty('--rx', '0deg')
                        el.style.setProperty('--ry', '0deg')
                    }
                    el.addEventListener('pointermove', move)
                    el.addEventListener('pointerleave', leave)
                    offs.push(() => {
                        el.removeEventListener('pointermove', move)
                        el.removeEventListener('pointerleave', leave)
                    })
                })
            }

            // Fonts, images and live content can shift layout: keep scroll positions in sync
            let refreshTimer: ReturnType<typeof setTimeout> | null = null
            const refresh = () => {
                if (refreshTimer) clearTimeout(refreshTimer)
                refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150)
            }
            const sizes = new Map<Element, number>()
            const heightWatch = new ResizeObserver((entries) => {
                let changed = false
                for (const e of entries) {
                    const h = Math.round(e.contentRect.height)
                    if (Math.abs((sizes.get(e.target) ?? -99) - h) > 2) {
                        sizes.set(e.target, h)
                        changed = true
                    }
                }
                if (changed) refresh()
            })
            heightWatch.observe(document.body)
            document.querySelectorAll('[data-scene]').forEach((el) => heightWatch.observe(el))
            window.addEventListener('load', refresh)
            document.fonts?.ready.then(refresh)

            cleanup = () => {
                offs.forEach((off) => off())
                heightWatch.disconnect()
                if (refreshTimer) clearTimeout(refreshTimer)
                window.removeEventListener('load', refresh)
                ctx.revert()
                gsap.ticker.remove(tick)
                lenis.destroy()
                document.documentElement.classList.remove('js-scroll')
            }
        })()

        return () => {
            cancelled = true
            cleanup()
        }
    }, [])

    return null
}
