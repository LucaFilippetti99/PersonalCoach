import { useMemo, useState } from 'react'
import { FRONTE, RETRO, SAGOMA, TESTA } from './corpo.js'
import { LABEL, SOGLIE_SETTIMANA, classifica, livelli as calcolaLivelli } from '../muscoli.js'

const SPECCHIO = 'matrix(-1 0 0 1 200 0)'
const fmtSerie = (v) => {
  const n = Math.round(v * 2) / 2
  return `${String(n).replace('.', ',')} serie`
}

/**
 * Figura del corpo (fronte e retro) con i muscoli colorati in base al lavoro.
 * - `carico`: { muscolo: serie pesate } (da caricoMuscoli in src/muscoli.js)
 * - `modo`: 'relativo' (una sessione / un giorno) o 'settimana' (soglie di serie settimanali)
 * - `elenco`: mostra accanto l'elenco dei muscoli con le serie
 * Tocca o passa sopra un muscolo per vederne nome e serie.
 */
export default function MappaMuscoli({ carico = {}, modo = 'relativo', elenco = false, compatta = false }) {
  const [attivo, setAttivo] = useState(null)
  const lv = useMemo(() => calcolaLivelli(carico, modo), [carico, modo])
  const ordine = useMemo(() => classifica(carico), [carico])

  const descrizione = ordine.length
    ? `Muscoli lavorati: ${ordine.slice(0, 5).map((m) => m.label.toLowerCase()).join(', ')}`
    : 'Nessun muscolo lavorato'

  const vista = (forme, nome) => {
    const meta = forme.map((f, i) => (
      <path
        key={i}
        d={f.d}
        className={`muscolo lv${lv[f.id] || 0} ${attivo === f.id ? 'attivo' : ''}`}
        onPointerEnter={() => setAttivo(f.id)}
        onClick={() => setAttivo(f.id)}
      >
        <title>
          {LABEL[f.id]}
          {carico[f.id] ? ` · ${fmtSerie(carico[f.id])}` : ''}
        </title>
      </path>
    ))
    return (
      <figure className="corpo-vista">
        <svg viewBox="0 0 200 440" aria-hidden="true" focusable="false">
          <g className="corpo-sagoma">
            <path d={SAGOMA} />
            <path d={SAGOMA} transform={SPECCHIO} />
            <ellipse cx={TESTA.cx} cy={TESTA.cy} rx={TESTA.rx} ry={TESTA.ry} />
          </g>
          <g>{meta}</g>
          <g transform={SPECCHIO}>{meta}</g>
        </svg>
        <figcaption>{nome}</figcaption>
      </figure>
    )
  }

  return (
    <div className={`mappa ${compatta ? 'mappa-compatta' : ''} ${elenco ? 'con-elenco' : ''}`}>
      <div className="mappa-figura" role="img" aria-label={descrizione} onPointerLeave={() => setAttivo(null)}>
        <div className="corpo-viste">
          {vista(FRONTE, 'Fronte')}
          {vista(RETRO, 'Retro')}
        </div>
        {!compatta && (
          <p className="mappa-info" aria-live="polite">
            {attivo ? (
              <>
                <strong>{LABEL[attivo]}</strong> ·{' '}
                {carico[attivo] ? fmtSerie(carico[attivo]) : 'non lavorato'}
              </>
            ) : (
              <span className="muted">Tocca un muscolo per i dettagli</span>
            )}
          </p>
        )}
        {!compatta && <Legenda modo={modo} />}
      </div>
      {elenco && (
        <ul className="mappa-elenco">
          {ordine.map((m) => (
            <li
              key={m.id}
              className={attivo === m.id ? 'attivo' : ''}
              onPointerEnter={() => setAttivo(m.id)}
              onPointerLeave={() => setAttivo(null)}
            >
              <span className={`swatch-m lv${lv[m.id]}`} aria-hidden />
              <span className="grow">{m.label}</span>
              <span className="num">{fmtSerie(m.serie)}</span>
            </li>
          ))}
          {!ordine.length && <li className="muted">Nessuna serie in questo periodo.</li>}
        </ul>
      )}
    </div>
  )
}

function Legenda({ modo }) {
  if (modo === 'settimana') {
    const [a, b, c, d] = SOGLIE_SETTIMANA
    const voci = [`${a}-${b - 1}`, `${b}-${c - 1}`, `${c}-${d - 1}`, `${d}+`]
    return (
      <div className="mappa-legenda">
        {voci.map((v, i) => (
          <span key={v}>
            <span className={`swatch-m lv${i + 1}`} aria-hidden /> {v}
          </span>
        ))}
        <span className="muted">serie</span>
      </div>
    )
  }
  return (
    <div className="mappa-legenda">
      <span className="muted">meno</span>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`swatch-m lv${i}`} aria-hidden />
      ))}
      <span className="muted">più lavoro</span>
    </div>
  )
}
