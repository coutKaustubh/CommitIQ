import { useEffect, useRef } from 'react'

/**
 * Scroll pe section fade + slide up — Intersection Observer se trigger hota hai.
 * Framer Motion nahi hai toh yeh lightweight alternative hai.
 */
function RevealOnScroll({ children, className = '', delay = 0 }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`
          el.classList.add('is-visible')
          observer.unobserve(el)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div ref={ref} className={`reveal-on-scroll ${className}`.trim()}>
      {children}
    </div>
  )
}

export default RevealOnScroll
