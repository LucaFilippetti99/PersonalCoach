import { useId, useState } from 'react'
import { Icon, Modal } from './ui.jsx'
import { ChipMuscoli } from './EserciziMappa.jsx'
import { MUSCOLI, muscoliEsercizio } from '../muscoli.js'
import { formatRecupero } from '../utils.js'
import {
  ciclaMuscolo,
  erroreGiorno,
  esercizioSchedaForm,
  esercizioSchedaVuoto,
  pulisciEsercizioScheda,
  sposta,
} from '../editor.js'

let prossimoId = 1
const conId = (e) => ({ ...e, _id: prossimoId++ })

/**
 * Pop-up per modificare (o creare) un giorno della scheda.
 * onSave(giorno, vecchioNome) — vecchioNome è null per un giorno nuovo.
 */
export default function EditorGiorno({ giorno, altriNomi = [], nomiEsercizi = [], override = {}, onSave, onDelete, onClose }) {
  const nuovo = !giorno
  const [nome, setNome] = useState(giorno?.nome ?? '')
  const [esercizi, setEsercizi] = useState(() =>
    (giorno?.esercizi?.length ? giorno.esercizi.map(esercizioSchedaForm) : [esercizioSchedaVuoto()]).map(conId),
  )
  const [errore, setErrore] = useState(null)
  const [confermaElimina, setConfermaElimina] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const lista = useId()

  const set = (i, campo, valore) => setEsercizi((l) => l.map((e, j) => (j === i ? { ...e, [campo]: valore } : e)))

  async function salva() {
    const puliti = esercizi.map(pulisciEsercizioScheda).filter(Boolean)
    const g = { ...(giorno || {}), nome: nome.trim(), esercizi: puliti }
    const err = erroreGiorno(g, altriNomi)
    if (err) return setErrore(err)
    setSalvando(true)
    try {
      await onSave(g, giorno?.nome ?? null)
      onClose()
    } catch {
      setErrore('Salvataggio non riuscito: riprova.')
      setSalvando(false)
    }
  }

  return (
    <Modal
      titolo={nuovo ? 'Nuovo giorno' : `Modifica ${giorno.nome}`}
      onClose={onClose}
      largo
      azioni={
        <>
          {errore && <p className="modal-errore">{errore}</p>}
          {!nuovo &&
            (confermaElimina ? (
              <button className="btn btn-danger" onClick={() => onDelete(giorno.nome).then(onClose)}>
                Conferma eliminazione
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => setConfermaElimina(true)}>
                <Icon name="trash" size={16} /> Elimina
              </button>
            ))}
          <span className="grow" />
          <button className="btn btn-ghost" onClick={onClose}>
            Annulla
          </button>
          <button className="btn btn-primary" onClick={salva} disabled={salvando}>
            <Icon name="check" size={16} /> Salva
          </button>
        </>
      }
    >
      <label className="field">
        <span>Nome del giorno</span>
        <input value={nome} placeholder="Es. Giorno A — Push" onChange={(e) => setNome(e.target.value)} />
      </label>
      <p className="muted small">
        Usa la forma «Giorno A — Push»: la lettera finisce nella Home e la descrizione serve a riconoscere gli
        allenamenti di Hevy.
      </p>

      <datalist id={lista}>
        {nomiEsercizi.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <ol className="ed-esercizi">
        {esercizi.map((e, i) => (
          <EsercizioForm
            key={e._id}
            e={e}
            i={i}
            totale={esercizi.length}
            lista={lista}
            override={override}
            set={(campo, v) => set(i, campo, v)}
            sposta={(d) => setEsercizi((l) => sposta(l, i, d))}
            elimina={() => setEsercizi((l) => l.filter((_, j) => j !== i))}
          />
        ))}
      </ol>
      <button className="btn" onClick={() => setEsercizi((l) => [...l, conId(esercizioSchedaVuoto())])}>
        <Icon name="plus" size={16} /> Aggiungi esercizio
      </button>
    </Modal>
  )
}

function EsercizioForm({ e, i, totale, lista, override, set, sposta, elimina }) {
  const [muscoliAperti, setMuscoliAperti] = useState(false)
  const personalizzati = !!(e.muscoli && (e.muscoli.primari?.length || e.muscoli.secondari?.length))
  const auto = muscoliEsercizio(e.nome, personalizzati ? e.muscoli : override[e.nome])
  const rec = Number(e.recupero_s)

  return (
    <li className="ed-esercizio">
      <div className="ed-riga">
        <span className="ed-n">{i + 1}</span>
        <input
          className="grow"
          value={e.nome}
          list={lista}
          placeholder="Nome esercizio (come in Hevy)"
          aria-label={`Esercizio ${i + 1}`}
          onChange={(ev) => set('nome', ev.target.value)}
        />
        <button className="btn btn-icon" aria-label="Sposta su" disabled={i === 0} onClick={() => sposta(-1)}>
          <Icon name="up" size={16} />
        </button>
        <button className="btn btn-icon" aria-label="Sposta giù" disabled={i === totale - 1} onClick={() => sposta(1)}>
          <Icon name="down" size={16} />
        </button>
        <button className="btn btn-icon" aria-label={`Rimuovi esercizio ${i + 1}`} onClick={elimina}>
          <Icon name="trash" size={16} />
        </button>
      </div>
      <div className="ed-griglia">
        <label className="field">
          <span>Serie</span>
          <input inputMode="numeric" value={e.serie} onChange={(ev) => set('serie', ev.target.value)} />
        </label>
        <label className="field">
          <span>Reps</span>
          <input value={e.reps} placeholder="8-12" onChange={(ev) => set('reps', ev.target.value)} />
        </label>
        <label className="field">
          <span>RIR</span>
          <input inputMode="numeric" value={e.rir} onChange={(ev) => set('rir', ev.target.value)} />
        </label>
        <label className="field">
          <span>Recupero (s){rec > 0 ? ` · ${formatRecupero(rec)}` : ''}</span>
          <input inputMode="numeric" value={e.recupero_s} onChange={(ev) => set('recupero_s', ev.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Note</span>
        <input value={e.note} placeholder="Es. Sett. 1: 40 kg" onChange={(ev) => set('note', ev.target.value)} />
      </label>
      <div className="ed-muscoli">
        <span className="muted small">{personalizzati ? 'Muscoli (scelti da te):' : 'Muscoli:'}</span>
        <ChipMuscoli muscoli={auto} />
        {!auto.primari.length && !auto.secondari.length && <span className="muted small">non riconosciuti</span>}
        <button className="btn btn-link" onClick={() => setMuscoliAperti(!muscoliAperti)} aria-expanded={muscoliAperti}>
          {muscoliAperti ? 'Chiudi' : 'Cambia'}
        </button>
      </div>
      {muscoliAperti && (
        <div className="ed-scelta-muscoli">
          <p className="muted small">Tocca un muscolo: principale → aiuta → nessuno.</p>
          <div className="chips-m">
            {MUSCOLI.map((m) => {
              const stato = auto.primari.includes(m.id) ? 'pri' : auto.secondari.includes(m.id) ? 'sec' : ''
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`chip-m ${stato || 'off'}`}
                  aria-pressed={!!stato}
                  onClick={() => set('muscoli', ciclaMuscolo(personalizzati ? e.muscoli : auto, m.id))}
                >
                  {m.breve}
                </button>
              )
            })}
          </div>
          {personalizzati && (
            <button className="btn btn-link" onClick={() => set('muscoli', undefined)}>
              Torna al riconoscimento automatico
            </button>
          )}
        </div>
      )}
    </li>
  )
}
