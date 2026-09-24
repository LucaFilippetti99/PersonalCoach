import { useMemo, useRef, useState } from 'react'
import { useDeseleziona } from './useDeseleziona.js'
import MappaMuscoli from './MappaMuscoli.jsx'
import { BREVE, LABEL, caricoMuscoli, livelliEsercizio, muscoliEsercizio } from '../muscoli.js'

/** Chip dei muscoli di un esercizio: pieni i principali, contornati quelli che aiutano */
export function ChipMuscoli({ muscoli, onMuscolo, selezionato }) {
  if (!muscoli.primari.length && !muscoli.secondari.length) return null
  const chip = (id, tipo) => {
    const cls = `chip-m ${tipo} ${selezionato === id ? 'sel' : ''}`
    const testo = BREVE[id]
    return onMuscolo ? (
      <button
        key={tipo + id}
        type="button"
        className={cls}
        title={`${LABEL[id]}: ${tipo === 'pri' ? 'muscolo principale' : 'aiuta'}`}
        onClick={(e) => {
          e.stopPropagation()
          onMuscolo(id)
        }}
      >
        {testo}
      </button>
    ) : (
      <span key={tipo + id} className={cls}>
        {testo}
      </span>
    )
  }
  return (
    <span className="chips-m">
      {muscoli.primari.map((id) => chip(id, 'pri'))}
      {muscoli.secondari.filter((id) => !muscoli.primari.includes(id)).map((id) => chip(id, 'sec'))}
    </span>
  )
}

/**
 * Elenco di esercizi con accanto la mappa dei muscoli, collegati tra loro:
 * - tocca un esercizio → la mappa mostra solo i suoi muscoli (pieni i principali, chiari quelli che aiutano);
 * - tocca un muscolo (sulla mappa o su un chip) → restano evidenziati gli esercizi che lo lavorano.
 * `esercizi` = [{ key, nome, serie (numero o array), dettaglio, note, muscoli? }]
 */
export default function EserciziMappa({ esercizi, override = {} }) {
  const [esSel, setEsSel] = useState(null)
  const [muscSel, setMuscSel] = useState(null)
  const radice = useRef(null)
  // Tocco fuori (sul nulla) o Esc: si torna alla vista completa
  useDeseleziona(radice, !!(esSel || muscSel), () => {
    setEsSel(null)
    setMuscSel(null)
  })

  const conMuscoli = useMemo(
    () => esercizi.map((e) => ({ ...e, m: muscoliEsercizio(e.nome, override[e.nome] || e.muscoli) })),
    [esercizi, override],
  )
  const { carico } = useMemo(() => caricoMuscoli(esercizi, override), [esercizi, override])
  const eserSel = conMuscoli.find((e) => e.key === esSel)

  const scegliMuscolo = (id) => {
    setEsSel(null)
    setMuscSel((x) => (x === id ? null : id))
  }
  const quanti = muscSel ? conMuscoli.filter((e) => e.m.primari.includes(muscSel) || e.m.secondari.includes(muscSel)) : []

  return (
    <div ref={radice} className={`es-mappa ${esSel || muscSel ? 'filtrato' : ''}`}>
      <ul className="es-lista">
        {conMuscoli.map((e) => {
          let stato = ''
          if (esSel) stato = e.key === esSel ? 'sel' : 'spenta'
          else if (muscSel)
            stato = e.m.primari.includes(muscSel) ? 'lavora-pri' : e.m.secondari.includes(muscSel) ? 'lavora-sec' : 'spenta'
          return (
            <li key={e.key} className={`es-riga ${stato}`}>
              <button
                type="button"
                className="es-riga-btn"
                aria-pressed={e.key === esSel}
                onClick={() => {
                  setMuscSel(null)
                  setEsSel((x) => (x === e.key ? null : e.key))
                }}
              >
                <span className="es-nome">{e.nome}</span>
                {e.dettaglio && <span className="es-dettaglio">{e.dettaglio}</span>}
              </button>
              <ChipMuscoli muscoli={e.m} onMuscolo={scegliMuscolo} selezionato={muscSel} />
              {e.note && <p className="es-note">{e.note}</p>}
            </li>
          )
        })}
      </ul>
      <div className="es-mappa-lato">
        <MappaMuscoli
          carico={carico}
          compatta
          focus={eserSel ? livelliEsercizio(eserSel.m) : null}
          selezionato={muscSel}
          onSeleziona={scegliMuscolo}
        />
        <p className="es-mappa-info" aria-live="polite">
          {eserSel ? (
            <>
              <strong>{eserSel.nome}</strong>
              {eserSel.m.primari.length > 0 && <> · {eserSel.m.primari.map((id) => BREVE[id]).join(', ')}</>}
              {eserSel.m.secondari.length > 0 && (
                <span className="muted"> · aiutano {eserSel.m.secondari.map((id) => BREVE[id].toLowerCase()).join(', ')}</span>
              )}
              {!eserSel.m.primari.length && !eserSel.m.secondari.length && <span className="muted"> · nessun muscolo</span>}
            </>
          ) : muscSel ? (
            <>
              <strong>{LABEL[muscSel]}</strong> ·{' '}
              {quanti.length ? `${quanti.length} ${quanti.length === 1 ? 'esercizio' : 'esercizi'}` : 'nessun esercizio'}
            </>
          ) : (
            <span className="muted">Tocca un esercizio o un muscolo</span>
          )}
        </p>
      </div>
    </div>
  )
}
