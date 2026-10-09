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

            const lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: { offset: -80 } })
            lenis.on('scroll', ScrollTrigger.update)
            const tick = (time: number) => lenis.raf(time * 1000)
            gsap.ticker.add(tick)
            gsap.ticker.lagSmoothing(0)

            const ctx = gsap.context(() => {
                const mm = gsap.matchMedia()

                // Hero: on larger screens the scene pins while the drawing zooms toward you
                mm.add('(min-width: 768px)', () => {
                    const tl = gsap.timeline({
                        defaults: { ease: 'none' },
                        scrollTrigger: { trigger: '[data-scene="hero"]', start: 'top top', end: '+=120%', scrub: 0.8, pin: true },
                    })
                    // 1. Text drifts away while the scene zooms toward you
                    tl.to('[data-anim="hero-text"]', { y: -90, opacity: 0, duration: 0.35 }, 0)
                        .to('[data-anim="hero-art"]', { scale: 1.55, y: -60, force3D: false, duration: 1 }, 0)
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

                // Statement: each word brightens in turn while the section is held in place
                const words = gsap.utils.toArray<HTMLElement>('[data-anim="word"]')
                gsap.to(words, {
                    color: '#ece9e2',
                    stagger: 0.12,
                    ease: 'none',
                    scrollTrigger: { trigger: '[data-scene="statement"]', start: 'top top', end: '+=110%', scrub: 0.6, pin: true },
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
                        scrollTrigger: { trigger: '[data-scene="features"]', start: 'top top', end: '+=140%', scrub: 0.9, pin: true },
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

            // Fonts and images can shift layout after load
            const refresh = () => ScrollTrigger.refresh()
            window.addEventListener('load', refresh)
            document.fonts?.ready.then(refresh)

            cleanup = () => {
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
