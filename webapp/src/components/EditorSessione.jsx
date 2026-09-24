import { useId, useState } from 'react'
import { Icon, Modal } from './ui.jsx'
import { formatDuration } from '../utils.js'
import { erroreSessione, pulisciSessione, sessioneForm, sposta } from '../editor.js'

let prossimoId = 1
const conId = (x) => ({ ...x, _id: prossimoId++ })

/**
 * Pop-up per modificare una sessione dello storico (importata da Hevy o inserita a mano).
 * onSave(nuova, originale) deve lanciare un Error con il messaggio da mostrare se non si può salvare.
 */
export default function EditorSessione({ sessione, giorniScheda = [], nomiEsercizi = [], onSave, onDelete, onClose }) {
  const [f, setF] = useState(() => {
    const b = sessioneForm(sessione)
    return { ...b, esercizi: b.esercizi.map((e) => conId({ ...e, serie: e.serie.map(conId) })) }
  })
  const [errore, setErrore] = useState(null)
  const [confermaElimina, setConfermaElimina] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const listaEs = useId()
  const listaGiorni = useId()

  const setCampo = (campo, v) => setF((x) => ({ ...x, [campo]: v }))
  const setEs = (i, fn) => setF((x) => ({ ...x, esercizi: x.esercizi.map((e, j) => (j === i ? fn(e) : e)) }))
  const setSerie = (i, k, campo, v) =>
    setEs(i, (e) => ({ ...e, serie: e.serie.map((s, j) => (j === k ? { ...s, [campo]: v } : s)) }))

  async function salva() {
    const nuova = pulisciSessione(f)
    const err = erroreSessione(nuova)
    if (err) return setErrore(err)
    setSalvando(true)
    try {
      await onSave(nuova, sessione)
      onClose()
    } catch (e) {
      setErrore(e.message || 'Salvataggio non riuscito: riprova.')
      setSalvando(false)
    }
  }

  return (
    <Modal
      titolo="Modifica allenamento"
      onClose={onClose}
      largo
      azioni={
        <>
          {errore && <p className="modal-errore">{errore}</p>}
          {confermaElimina ? (
            <button className="btn btn-danger" onClick={() => onDelete(sessione).then(onClose)}>
              Conferma eliminazione
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => setConfermaElimina(true)}>
              <Icon name="trash" size={16} /> Elimina
            </button>
          )}
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
      <datalist id={listaEs}>
        {nomiEsercizi.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id={listaGiorni}>
        {giorniScheda.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="ed-griglia ed-griglia-testa">
        <label className="field">
          <span>Data</span>
          <input type="date" value={f.data} onChange={(e) => setCampo('data', e.target.value)} />
        </label>
        <label className="field ed-span2">
          <span>Allenamento</span>
          <input value={f.giorno} list={listaGiorni} onChange={(e) => setCampo('giorno', e.target.value)} />
        </label>
        <label className="field">
          <span>Durata (min)</span>
          <input inputMode="numeric" value={f.durata_min} onChange={(e) => setCampo('durata_min', e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Note</span>
        <textarea rows={2} value={f.note} onChange={(e) => setCampo('note', e.target.value)} />
      </label>

      <ol className="ed-esercizi">
        {f.esercizi.map((e, i) => {
          const conTempo = e.serie.some((s) => s.secondi || s.km)
          return (
            <li key={e._id} className="ed-esercizio">
              <div className="ed-riga">
                <span className="ed-n">{i + 1}</span>
                <input
                  className="grow"
                  value={e.nome}
                  list={listaEs}
                  placeholder="Nome esercizio"
                  aria-label={`Esercizio ${i + 1}`}
                  onChange={(ev) => setEs(i, (x) => ({ ...x, nome: ev.target.value }))}
                />
                <button className="btn btn-icon" aria-label="Sposta su" disabled={i === 0} onClick={() => setF((x) => ({ ...x, esercizi: sposta(x.esercizi, i, -1) }))}>
                  <Icon name="up" size={16} />
                </button>
                <button
                  className="btn btn-icon"
                  aria-label="Sposta giù"
                  disabled={i === f.esercizi.length - 1}
                  onClick={() => setF((x) => ({ ...x, esercizi: sposta(x.esercizi, i, 1) }))}
                >
                  <Icon name="down" size={16} />
                </button>
                <button
                  className="btn btn-icon"
                  aria-label={`Rimuovi esercizio ${i + 1}`}
                  onClick={() => setF((x) => ({ ...x, esercizi: x.esercizi.filter((_, j) => j !== i) }))}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="ed-serie">
                <div className="ed-serie-riga ed-serie-testa">
                  <span>#</span>
                  <span>kg</span>
                  <span>reps</span>
                  <span>RIR</span>
                  <span />
                </div>
                {e.serie.map((s, k) => (
                  <div className="ed-serie-riga" key={s._id}>
                    <span className="ed-n">{k + 1}</span>
                    <input inputMode="decimal" value={s.kg} aria-label={`Serie ${k + 1} kg`} onChange={(ev) => setSerie(i, k, 'kg', ev.target.value)} />
                    <input
                      inputMode="numeric"
                      value={s.reps}
                      placeholder={s.secondi ? formatDuration(s.secondi) : s.km ? `${s.km} km` : ''}
                      aria-label={`Serie ${k + 1} ripetizioni`}
                      onChange={(ev) => setSerie(i, k, 'reps', ev.target.value)}
                    />
                    <input inputMode="numeric" value={s.rir} aria-label={`Serie ${k + 1} RIR`} onChange={(ev) => setSerie(i, k, 'rir', ev.target.value)} />
                    <button
                      className="btn btn-icon"
                      aria-label={`Rimuovi serie ${k + 1}`}
                      onClick={() => setEs(i, (x) => ({ ...x, serie: x.serie.filter((_, j) => j !== k) }))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
                {conTempo && <p className="muted small">Le serie a tempo o a distanza (plank, corsa) restano come importate.</p>}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setEs(i, (x) => ({
                      ...x,
                      serie: [...x.serie, conId({ kg: x.serie.at(-1)?.kg ?? '', reps: '', rir: x.serie.at(-1)?.rir ?? '' })],
                    }))
                  }
                >
                  <Icon name="plus" size={15} /> Serie
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <button
        className="btn"
        onClick={() => setF((x) => ({ ...x, esercizi: [...x.esercizi, conId({ nome: '', serie: [conId({ kg: '', reps: '', rir: '' })] })] }))}
      >
        <Icon name="plus" size={16} /> Aggiungi esercizio
      </button>
    </Modal>
  )
}
