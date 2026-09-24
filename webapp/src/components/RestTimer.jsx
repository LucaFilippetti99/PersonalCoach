import { useEffect, useState } from 'react'

/** Timer di recupero fisso in basso; vibra/suona a fine recupero se possibile. */
export default function RestTimer({ secondi, nome, onClose }) {
  const [fine] = useState(() => Date.now() + secondi * 1000)
  const [ora, setOra] = useState(Date.now())

  const rimasti = Math.max(0, Math.round((fine - ora) / 1000))

  useEffect(() => {
    const t = setInterval(() => setOra(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (rimasti !== 0) return
    try {
      navigator.vibrate?.([200, 100, 200])
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const o = ctx.createOscillator()
      o.frequency.value = 880
      o.connect(ctx.destination)
      o.start()
      o.stop(ctx.currentTime + 0.25)
    } catch {
      /* audio non disponibile */
    }
  }, [rimasti])

  const mm = Math.floor(rimasti / 60)
  const ss = String(rimasti % 60).padStart(2, '0')
  const pct = 100 - (rimasti / secondi) * 100

  return (
    <div className={`rest-timer ${rimasti === 0 ? 'done' : ''}`} role="timer" aria-live="polite">
      <div className="rest-progress" style={{ width: `${pct}%` }} />
      <div className="rest-inner">
        <div>
          <div className="small muted">Recupero · {nome}</div>
          <div className="rest-time">{rimasti === 0 ? 'Vai!' : `${mm}:${ss}`}</div>
        </div>
        <button className="btn" onClick={onClose}>
          Chiudi
        </button>
      </div>
    </div>
  )
}
