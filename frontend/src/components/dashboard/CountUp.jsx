import { useEffect, useRef, useState } from 'react'

/**
 * Number ko 0 se final value tak count-up karta hai (ease-out, ~800ms).
 * Sirf mount pe ek baar chalta hai. Non-numeric value (jaise '—', 'RAG')
 * ko as-is dikha deta hai — koi animation nahi.
 */
function CountUp({ value, duration = 800 }) {
  const target = typeof value === 'number' ? value : Number(value)
  const isNumeric = Number.isFinite(target)
  const [display, setDisplay] = useState(isNumeric ? 0 : value)
  const started = useRef(false)

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(value)
      return
    }
    if (started.current) return
    started.current = true

    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      // ease-out cubic — shuru me fast, end me slow
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{display}</>
}

export default CountUp
