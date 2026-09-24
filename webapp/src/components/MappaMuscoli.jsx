import { useMemo, useRef, useState } from 'react'
import { useDeseleziona } from './useDeseleziona.js'
import { FRONTE, PROPORZIONI, RETRO, SAGOMA, TESTA, VIEWBOX_H } from './corpo.js'
import { LABEL, SOGLIE_SETTIMANA, classifica, livelli as calcolaLivelli } from '../muscoli.js'

const SPECCHIO = 'matrix(-1 0 0 1 200 0)'
export const fmtSerie = (v) => {
  const n = Math.round(v * 2) / 2
  return `${String(n).replace('.', ',')} serie`
}

/**
 * Figura del corpo (fronte e retro) con i muscoli colorati in base al lavoro.
 * - `carico`: { muscolo: serie pesate } (da caricoMuscoli in src/muscoli.js)
 * - `modo`: 'relativo' (una sessione / un giorno) o 'settimana' (soglie di serie settimanali)
 * - `focus`: livelli da mostrare al posto di quelli calcolati (es. un solo esercizio evidenziato)
 * - `selezionato` / `onSeleziona(id | null)`: muscolo scelto, controllato da fuori (collega mappa ed esercizi)
 * - `elenco` + `contributi`: elenco dei muscoli; toccandone uno si vedono gli esercizi che lo hanno lavorato
 * - `compatta`: senza legenda né didascalia (per le card piccole)
 */
export default function MappaMuscoli({
  carico = {},
  modo = 'relativo',
  focus = null,
  selezionato,
  onSeleziona,
  elenco = false,
  contributi = null,
  compatta = false,
}) {
  const [interno, setInterno] = useState(null)
  const [hover, setHover] = useState(null)
  const controllato = onSeleziona !== undefined
  const scelto = controllato ? selezionato : interno
  const scegli = (id) => {
    const nuovo = scelto === id ? null : id
    if (controllato) onSeleziona(nuovo)
    else setInterno(nuovo)
  }
  const attivo = hover || scelto
  // Se la selezione è gestita qui dentro (es. Progressi), un tocco sul nulla o Esc la toglie.
  // Quando la gestisce il componente padre (EserciziMappa), ci pensa lui.
  const radice = useRef(null)
  useDeseleziona(radice, !controllato && !!interno, () => setInterno(null))

  const lvCalcolati = useMemo(() => calcolaLivelli(carico, modo), [carico, modo])
  const lv = focus || lvCalcolati
  const ordine = useMemo(() => classifica(carico), [carico])

  const descrizione = ordine.length
    ? `Muscoli lavorati: ${ordine.slice(0, 5).map((m) => m.label.toLowerCase()).join(', ')}`
    : 'Nessun muscolo lavorato'

  const vista = (forme, nome) => {
    const meta = forme.map((f, i) => (
      <path
        key={i}
        d={f.d}
        className={`muscolo lv${lv[f.id] || 0} ${attivo === f.id ? 'attivo' : ''} ${
          scelto && scelto !== f.id ? 'sfondo' : ''
        }`}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(f.id)}
        onPointerLeave={() => setHover(null)}
        onClick={() => scegli(f.id)}
      >
        <title>
          {LABEL[f.id]}
          {carico[f.id] ? ` · ${fmtSerie(carico[f.id])}` : ''}
        </title>
      </path>
    ))
    return (
      <figure className="corpo-vista">
        <svg viewBox={`0 0 200 ${VIEWBOX_H}`} aria-hidden="true" focusable="false">
          <g transform={PROPORZIONI}>
            <g className="corpo-sagoma">
              <path d={SAGOMA} />
              <path d={SAGOMA} transform={SPECCHIO} />
              <ellipse cx={TESTA.cx} cy={TESTA.cy} rx={TESTA.rx} ry={TESTA.ry} />
            </g>
            <g>{meta}</g>
            <g transform={SPECCHIO}>{meta}</g>
          </g>
        </svg>
        <figcaption>{nome}</figcaption>
      </figure>
    )
  }

  return (
    <div ref={radice} className={`mappa ${compatta ? 'mappa-compatta' : ''} ${elenco ? 'con-elenco' : ''}`}>
      <div className="mappa-figura" role="img" aria-label={descrizione}>
        <div className="corpo-viste">
          {vista(FRONTE, 'Fronte')}
          {vista(RETRO, 'Retro')}
        </div>
        {!compatta && (
          <p className="mappa-info" aria-live="polite">
            {attivo ? (
              <>
                <strong>{LABEL[attivo]}</strong> · {carico[attivo] ? fmtSerie(carico[attivo]) : 'non lavorato'}
              </>
            ) : (
              <span className="muted">Tocca un muscolo per vedere gli esercizi</span>
            )}
          </p>
        )}
        {!compatta && !focus && <Legenda modo={modo} />}
      </div>
      {elenco && (
        <ul className="mappa-elenco">
          {ordine.map((m) => {
            const aperto = scelto === m.id
            const esercizi = contributi?.[m.id] || []
            return (
              <li key={m.id} className={`${aperto ? 'aperto' : ''} ${hover === m.id ? 'attivo' : ''}`}>
                <button
                  className="mappa-riga"
                  aria-expanded={contributi ? aperto : undefined}
                  onClick={() => scegli(m.id)}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(m.id)}
                  onPointerLeave={() => setHover(null)}
                >
                  <span className={`swatch-m lv${lvCalcolati[m.id]}`} aria-hidden />
                  <span className="grow">{m.label}</span>
                  <span className="num">{fmtSerie(m.serie)}</span>
                </button>
                {aperto && esercizi.length > 0 && (
                  <ul className="mappa-contributi">
                    {esercizi.map((x) => (
                      <li key={x.nome}>
                        <span className={`chip-m ${x.primario ? 'pri' : 'sec'}`}>
                          {x.primario ? 'principale' : 'aiuta'}
                        </span>
                        <span className="grow">{x.nome}</span>
                        <span className="num muted">{fmtSerie(x.serie)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
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
