import { useMemo, useState } from 'react'
import { useWidth } from './useWidth.js'
import { addDays, formatDate, parseDate, round1, validWeights, weeklyAvg } from '../utils.js'

/**
 * Peso giornaliero (punti) + media mobile 7 giorni (linea) + fascia obiettivo.
 * Hover/touch: linea verticale con tooltip sul giorno più vicino.
 */
export default function WeightChart({ misure, target, height = 240 }) {
  const [wrap, width] = useWidth(240)
  const [hover, setHover] = useState(null)

  const pts = useMemo(() => {
    const w = validWeights(misure)
    return w.map((m) => ({ ...m, t: parseDate(m.data).getTime(), avg: weeklyAvg(misure, m.data) }))
  }, [misure])

  if (pts.length < 2) {
    return (
      <div className="chart-empty">
        Servono almeno 2 pesate per vedere il grafico. Pesati al mattino, a digiuno, 3-4 volte a settimana.
      </div>
    )
  }

  // Prima misura la larghezza disponibile, poi disegna
  if (width == null) return <div className="chart" ref={wrap} style={{ height }} />

  const pad = { l: 40, r: 12, t: 12, b: 28 }
  const iw = width - pad.l - pad.r
  const ih = height - pad.t - pad.b

  const t0 = pts[0].t
  const t1 = Math.max(pts[pts.length - 1].t, t0 + 86400000 * 6)
  const vals = pts.flatMap((p) => [p.peso_kg, p.avg])
  if (target) vals.push(target.min, target.max)
  let y0 = Math.floor(Math.min(...vals) - 0.5)
  let y1 = Math.ceil(Math.max(...vals) + 0.5)
  if (y1 - y0 < 3) y1 = y0 + 3

  const x = (t) => pad.l + ((t - t0) / (t1 - t0)) * iw
  const y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * ih

  const step = y1 - y0 > 8 ? 2 : 1
  const yTicks = []
  for (let v = y0; v <= y1; v += step) yTicks.push(v)

  // Tick sull'asse x: ~5 date
  const days = Math.round((t1 - t0) / 86400000)
  const every = Math.max(1, Math.ceil(days / 5))
  const xTicks = []
  for (let d = 0; d <= days; d += every) xTicks.push(addDays(new Date(t0), d).getTime())

  const avgPath = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.avg).toFixed(1)}`).join(' ')

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    let best = pts[0]
    for (const p of pts) if (Math.abs(x(p.t) - cx) < Math.abs(x(best.t) - cx)) best = p
    setHover(best)
  }

  return (
    <div className="chart" ref={wrap}>
      <div className="legend">
        <span className="legend-item">
          <span className="swatch swatch-dot" /> Peso del giorno
        </span>
        <span className="legend-item">
          <span className="swatch swatch-line" /> Media 7 giorni
        </span>
        {target && (
          <span className="legend-item">
            <span className="swatch swatch-band" /> Obiettivo {target.min}-{target.max} kg
          </span>
        )}
      </div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Andamento del peso"
        onMouseMove={onMove}
        onTouchStart={onMove}
        onTouchMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {target && (
          <rect
            className="band"
            x={pad.l}
            width={iw}
            y={y(Math.min(target.max, y1))}
            height={Math.max(0, y(Math.max(target.min, y0)) - y(Math.min(target.max, y1)))}
          />
        )}
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid" x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} />
            <text className="axis" x={pad.l - 8} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} className="axis" x={x(t)} y={height - 8} textAnchor="middle">
            {new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          </text>
        ))}
        <path className="avg-line" d={avgPath} />
        {pts.map((p) => (
          <circle key={p.data} className="dot" cx={x(p.t)} cy={y(p.peso_kg)} r={4} />
        ))}
        {hover && (
          <g>
            <line className="crosshair" x1={x(hover.t)} x2={x(hover.t)} y1={pad.t} y2={pad.t + ih} />
            <circle className="dot-hover" cx={x(hover.t)} cy={y(hover.avg)} r={5} />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="tooltip"
          style={{ left: Math.min(Math.max(x(hover.t), 80), width - 80), top: 30 }}
        >
          <strong>{formatDate(hover.data)}</strong>
          <div>Peso: {hover.peso_kg} kg</div>
          <div>Media 7 gg: {round1(hover.avg)} kg</div>
          {hover.vita_cm && <div>Vita: {hover.vita_cm} cm</div>}
        </div>
      )}
    </div>
  )
}
