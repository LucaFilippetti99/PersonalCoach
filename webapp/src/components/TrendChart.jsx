import { useEffect, useRef, useState } from 'react'
import { formatDate, parseDate } from '../utils.js'

/**
 * Serie singola nel tempo: punti [{ data, valore, dettaglio }].
 * Linea + punti, crosshair con tooltip. Il titolo della card nomina la serie (niente legenda).
 */
export default function TrendChart({ punti, unita = 'kg', height = 220 }) {
  const wrap = useRef(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, e.contentRect.width)))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  if (punti.length < 2) {
    return (
      <div className="chart" ref={wrap}>
        <div className="chart-empty">Servono almeno 2 sessioni per vedere l'andamento.</div>
      </div>
    )
  }

  const pts = punti.map((p) => ({ ...p, t: parseDate(p.data).getTime() }))
  const pad = { l: 40, r: 14, t: 12, b: 28 }
  const iw = width - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const t0 = pts[0].t
  const t1 = Math.max(pts.at(-1).t, t0 + 86400000 * 6)
  const vals = pts.map((p) => p.valore)
  const span = Math.max(...vals) - Math.min(...vals)
  const stepRaw = Math.max(1, span / 4)
  const step = [1, 2, 2.5, 5, 10, 20, 25, 50].find((s) => s >= stepRaw) || 50
  const y0 = Math.floor((Math.min(...vals) - step * 0.5) / step) * step
  const y1 = Math.ceil((Math.max(...vals) + step * 0.5) / step) * step
  const x = (t) => pad.l + ((t - t0) / (t1 - t0)) * iw
  const y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * ih

  const yTicks = []
  for (let v = y0; v <= y1 + 1e-9; v += step) yTicks.push(Math.round(v * 100) / 100)
  const n = Math.min(5, pts.length)
  const xTicks = Array.from({ length: n }, (_, i) => t0 + ((t1 - t0) * i) / (n - 1))

  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.valore).toFixed(1)}`).join(' ')

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    let best = pts[0]
    for (const p of pts) if (Math.abs(x(p.t) - cx) < Math.abs(x(best.t) - cx)) best = p
    setHover(best)
  }

  return (
    <div className="chart" ref={wrap}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Andamento"
        onMouseMove={onMove}
        onTouchStart={onMove}
        onTouchMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid" x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} />
            <text className="axis" x={pad.l - 8} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={i}
            className="axis"
            x={x(t)}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
          >
            {new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          </text>
        ))}
        <path className="avg-line" d={path} />
        {pts.map((p) => (
          <circle key={p.data} className="dot-hover" cx={x(p.t)} cy={y(p.valore)} r={4} />
        ))}
        {hover && <line className="crosshair" x1={x(hover.t)} x2={x(hover.t)} y1={pad.t} y2={pad.t + ih} />}
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(hover.t), 90), width - 90), top: 8 }}>
          <strong>{formatDate(hover.data)}</strong>
          <div>
            {hover.valore} {unita}
          </div>
          {hover.dettaglio && <div className="muted">{hover.dettaglio}</div>}
        </div>
      )}
    </div>
  )
}
