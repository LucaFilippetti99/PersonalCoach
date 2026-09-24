import { useEffect, useState } from 'react'

/*
 * Audio: iOS permette di suonare solo se l'AudioContext è stato creato (o "sbloccato")
 * durante un tocco dell'utente. Per questo `sbloccaAudio()` va chiamato nel click che avvia
 * il recupero; a fine recupero il beep usa lo stesso contesto già sbloccato.
 */
let audioCtx = null

export function sbloccaAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    // Un suono muto di un istante completa lo sblocco su iOS
    const g = audioCtx.createGain()
    g.gain.value = 0
    const o = audioCtx.createOscillator()
    o.connect(g).connect(audioCtx.destination)
    o.start()
    o.stop(audioCtx.currentTime + 0.01)
  } catch {
    /* audio non disponibile */
  }
}

function beep() {
  if (!audioCtx) return
  try {
    const t = audioCtx.currentTime
    for (const [i, f] of [880, 1175].entries()) {
      const o = audioCtx.createOscillator()
      const g = audioCtx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.25, t + i * 0.3)
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.3 + 0.25)
      o.connect(g).connect(audioCtx.destination)
      o.start(t + i * 0.3)
      o.stop(t + i * 0.3 + 0.26)
    }
  } catch {
    /* audio non disponibile */
  }
}

/** Timer di recupero fisso in basso: a fine recupero suona (e vibra su Android). */
export default function RestTimer({ secondi, nome, onClose }) {
  const [fine, setFine] = useState(() => Date.now() + secondi * 1000)
  const [ora, setOra] = useState(Date.now())

  const rimasti = Math.max(0, Math.round((fine - ora) / 1000))

  useEffect(() => {
    if (rimasti === 0) return
    const t = setInterval(() => setOra(Date.now()), 250)
    return () => clearInterval(t)
  }, [rimasti === 0]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rimasti !== 0) return
    navigator.vibrate?.([200, 100, 200])
    beep()
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
        <div className="row-gap">
          {rimasti > 0 && (
            <button className="btn btn-sm" onClick={() => setFine((f) => f + 30000)}>
              +30 s
            </button>
          )}
          <button className="btn btn-sm" onClick={onClose}>
            {rimasti === 0 ? 'Chiudi' : 'Salta'}
          </button>
        </div>
      </div>
    </div>
  )
}
