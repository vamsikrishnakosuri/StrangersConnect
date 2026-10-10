'use client'

import { useEffect } from 'react'

// Scroll-driven scenes for the landing page, in the spirit of Apple and Wispr Flow:
// smooth scrolling (Lenis, MIT) plus scrubbed animations (GSAP ScrollTrigger, free license).
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

                // Hero: on larger screens the scene zooms toward you as you scroll past (no pin, so nothing can overlap)
                mm.add('(min-width: 768px)', () => {
                    const tl = gsap.timeline({
                        defaults: { ease: 'none' },
                        scrollTrigger: { trigger: '[data-scene="hero"]', start: 'top top', end: 'bottom top', scrub: 0.8 },
                    })
                    // 1. Text drifts away while the scene zooms toward you
                    tl.to('[data-anim="hero-text"]', { y: -90, opacity: 0, duration: 0.35 }, 0)
                        .to('[data-anim="hero-art"]', { scale: 1.3, y: -40, force3D: false, duration: 1 }, 0)
                        // 2. The gradient field drifts up and opens out
                        .to('[data-anim="field"]', { scale: 1.25, yPercent: -8, duration: 1 }, 0)
                })
                mm.add('(max-width: 767px)', () => {
                    gsap.to('[data-anim="hero-art"]', {
                        force3D: false,
                        scale: 1.12,
                        y: -30,
                        ease: 'none',
                        scrollTrigger: { trigger: '[data-scene="hero"]', start: 'center center', end: 'bottom top', scrub: true },
                    })
                })

                gsap.from('[data-anim="stat"]', {
                    y: 24,
                    opacity: 0,
                    duration: 0.9,
                    stagger: 0.1,
                    ease: 'power3.out',
                    scrollTrigger: { trigger: '[data-anim="stat"]', start: 'top 85%' },
                })

                // Statement: each word brightens in turn as the line scrolls into view
                const words = gsap.utils.toArray<HTMLElement>('[data-anim="word"]')
                gsap.to(words, {
                    color: '#ece9e2',
                    stagger: 0.12,
                    ease: 'none',
                    scrollTrigger: { trigger: '[data-scene="statement"]', start: 'top 80%', end: 'center 45%', scrub: 0.6 },
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

                // Privacy: the diagram glides in and settles while the points appear
                gsap.from('[data-anim="diagram"]', {
                    scale: 0.88,
                    y: 60,
                    opacity: 0,
                    ease: 'none',
                    scrollTrigger: { trigger: '[data-scene="privacy"]', start: 'top 85%', end: 'center 60%', scrub: 0.8 },
                })
                // Privacy promises: on wide screens each one in turn zooms to the centre,
                // sits on a soft card, then settles back into its place in the row
                mm.add('(min-width: 1024px)', () => {
                    const items = gsap.utils.toArray<HTMLElement>('[data-anim="pillar"]')
                    const row = document.querySelector<HTMLElement>('[data-scene="pillars"]')
                    if (!row || !items.length) return
                    const tl = gsap.timeline({
                        defaults: { ease: 'power2.inOut' },
                        scrollTrigger: {
                            trigger: row,
                            start: 'center 55%',
                            end: '+=' + items.length * 38 + '%',
                            scrub: 0.7,
                            pin: true,
                            invalidateOnRefresh: true,
                        },
                    })
                    items.forEach((el, i) => {
                        const card = el.querySelector('[data-anim="pillar-card"]')
                        const others = items.filter((o) => o !== el)
                        const toCentre = () => {
                            const r = el.getBoundingClientRect()
                            const rr = row.getBoundingClientRect()
                            return rr.left + rr.width / 2 - (r.left + r.width / 2)
                        }
                        tl.to(el, { x: toCentre, y: -30, scale: 1.45, zIndex: 5, duration: 1 }, i * 2)
                            .to(card, { opacity: 1, duration: 0.6 }, i * 2 + 0.2)
                            .to(others, { opacity: 0.18, duration: 0.6 }, i * 2)
                            .to(el, { x: 0, y: 0, scale: 1, duration: 1 }, i * 2 + 1.3)
                            .to(card, { opacity: 0, duration: 0.5 }, i * 2 + 1.3)
                            .to(others, { opacity: 1, duration: 0.6 }, i * 2 + 1.4)
                            .set(el, { zIndex: 0 }, i * 2 + 2.3)
                    })
                })
                mm.add('(max-width: 1023px)', () => {
                    gsap.utils.toArray<HTMLElement>('[data-anim="pillar"]').forEach((el) => {
                        gsap.from(el, { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } })
                    })
                })

                // Privacy tiles fade in as they enter the screen (simple and robust)
                const tiles = gsap.utils.toArray<HTMLElement>('[data-anim="bullet"]')
                tiles.forEach((el, i) => {
                    el.classList.add('reveal-item')
                    el.style.transitionDelay = `${(i % 2) * 80 + Math.floor(i / 2) * 90}ms`
                })
                const tileObserver = new IntersectionObserver(
                    (entries) =>
                        entries.forEach((e) => {
                            if (e.isIntersecting) {
                                e.target.classList.add('is-in')
                                tileObserver.unobserve(e.target)
                            }
                        }),
                    { threshold: 0.2 },
                )
                tiles.forEach((el) => tileObserver.observe(el))

                // Features: the cards start as a stacked deck in the middle, then deal out
                // one after another into the grid while the section is held in place
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
                        scrollTrigger: { trigger: '[data-scene="features"]', start: 'top top', end: '+=95%', scrub: 0.9, pin: true },
                    })
                    // Deal from the top of the stack (the last card) downward
                    cards
                        .map((card, i) => ({ card, i }))
                        .reverse()
                        .forEach(({ card, i }, order) => {
                            tl.fromTo(
                                card,
                                { x: offsets[i].x, y: offsets[i].y + i * -4, rotation: (i - 2.5) * 3.2, scale: 0.92 },
                                { x: 0, y: 0, rotation: 0, scale: 1, ease: 'power2.inOut', duration: 1 },
                                order * 0.55,
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
            const magnets = gsap.utils.toArray<HTMLElement>('[data-magnetic]')
            const fine = window.matchMedia('(pointer: fine)').matches
            const magnetOff: (() => void)[] = []
            if (fine) {
                magnets.forEach((el) => {
                    const move = (e: PointerEvent) => {
                        const r = el.getBoundingClientRect()
                        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4, ease: 'power3.out' })
                    }
                    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
                    el.addEventListener('pointermove', move)
                    el.addEventListener('pointerleave', leave)
                    magnetOff.push(() => {
                        el.removeEventListener('pointermove', move)
                        el.removeEventListener('pointerleave', leave)
                    })
                })
            }

            // Spotlight cards: a soft light follows the pointer across them
            const lit = gsap.utils.toArray<HTMLElement>('[data-spotlight]')
            const spot = (e: PointerEvent) => {
                const el = e.currentTarget as HTMLElement
                const r = el.getBoundingClientRect()
                el.style.setProperty('--mx', `${e.clientX - r.left}px`)
                el.style.setProperty('--my', `${e.clientY - r.top}px`)
            }
            lit.forEach((el) => el.addEventListener('pointermove', spot))

            // Fonts, images and live content can shift layout: keep scroll positions in sync
            let refreshTimer: ReturnType<typeof setTimeout> | null = null
            const refresh = () => {
                if (refreshTimer) clearTimeout(refreshTimer)
                refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150)
            }
            // Pinned sections get fixed-height spacers, so watch each section too, not just the page
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
            document.querySelectorAll('[data-scene], [data-scene] > *').forEach((el) => heightWatch.observe(el))
            window.addEventListener('load', refresh)
            document.fonts?.ready.then(refresh)

            cleanup = () => {
                magnetOff.forEach((off) => off())
                lit.forEach((el) => el.removeEventListener('pointermove', spot))
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
