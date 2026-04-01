import { useEffect, useRef } from 'react'

function clamp(s) { return Math.max(0.2, Math.min(8, s)) }

/**
 * Attaches pan/zoom gestures to `elRef`.
 * Transforms are stored normalized: x,y are fractions of the container size.
 * Rendered via CSS: translate(calc(x * 100%), calc(y * 100%)) scale(scale)
 */
export function useGestures(elRef, xformRef, onCommit) {
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const state = { g: null }

    function pinchDist(t) { return Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY) }
    function pinchMid(t) { return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 } }

    function mousedown(e) {
      if (e.button !== 0) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      state.g = { type: 'drag', sx: e.clientX, sy: e.clientY, stx: xformRef.current.x, sty: xformRef.current.y, w: r.width, h: r.height }
    }
    function mousemove(e) {
      const g = state.g
      if (!g || g.type !== 'drag') return
      commitRef.current({ ...xformRef.current, x: g.stx + (e.clientX - g.sx) / g.w, y: g.sty + (e.clientY - g.sy) / g.h })
    }
    function mouseup() { state.g = null }

    function wheel(e) {
      e.preventDefault()
      // deltaMode 0=px, 1=lines, 2=pages → normalize to px for smooth scaling
      const px = e.deltaMode === 0 ? e.deltaY : e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY * 300
      commitRef.current({ ...xformRef.current, scale: clamp(xformRef.current.scale * Math.pow(0.999, px)) })
    }

    function touchstart(e) {
      const t = e.touches
      const r = el.getBoundingClientRect()
      if (t.length === 1) {
        state.g = { type: 'drag', sx: t[0].clientX, sy: t[0].clientY, stx: xformRef.current.x, sty: xformRef.current.y, w: r.width, h: r.height }
      } else if (t.length === 2) {
        const m = pinchMid(t)
        state.g = { type: 'pinch', startDist: pinchDist(t), startScale: xformRef.current.scale, sx: m.x, sy: m.y, stx: xformRef.current.x, sty: xformRef.current.y, w: r.width, h: r.height }
      }
    }
    function touchmove(e) {
      e.preventDefault()
      const g = state.g
      if (!g) return
      const t = e.touches
      if (g.type === 'drag' && t.length === 1) {
        commitRef.current({ ...xformRef.current, x: g.stx + (t[0].clientX - g.sx) / g.w, y: g.sty + (t[0].clientY - g.sy) / g.h })
      } else if (g.type === 'pinch' && t.length === 2) {
        const m = pinchMid(t)
        commitRef.current({
          scale: clamp(g.startScale * pinchDist(t) / g.startDist),
          x: g.stx + (m.x - g.sx) / g.w,
          y: g.sty + (m.y - g.sy) / g.h,
        })
      }
    }
    function touchend() { state.g = null }

    el.addEventListener('mousedown', mousedown)
    window.addEventListener('mousemove', mousemove)
    window.addEventListener('mouseup', mouseup)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('touchstart', touchstart, { passive: true })
    el.addEventListener('touchmove', touchmove, { passive: false })
    el.addEventListener('touchend', touchend)

    return () => {
      el.removeEventListener('mousedown', mousedown)
      window.removeEventListener('mousemove', mousemove)
      window.removeEventListener('mouseup', mouseup)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('touchstart', touchstart)
      el.removeEventListener('touchmove', touchmove)
      el.removeEventListener('touchend', touchend)
    }
  }, [elRef, xformRef]) // both are stable refs — effect runs once per mount
}
