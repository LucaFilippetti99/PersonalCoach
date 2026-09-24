import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Empty, ErrorBanner, Icon, PageHeader, Tabs, useFlash } from '../components/ui.jsx'
import RestTimer, { sbloccaAudio } from '../components/RestTimer.jsx'
import { useWakeLock } from '../components/useWakeLock.js'
import { useImpostazioni, useLog, useScheda } from '../hooks.js'
import { navigate } from '../nav.js'
import { ChiediClaude } from './Claude.jsx'
import TrendChart from '../components/TrendChart.jsx'
import { hevyToSessions, mergeLog, parseCsv } from '../hevy.js'
import {
  TIPO_INFO,
  exerciseHistory,
  formatDate,
  giornoScheda,
  kgDaScheda,
  schedaAttiva,
  settimanaScheda,
  formatSet,
  formatSets,
  isExampleSession,
  isoDate,
  lastExercise,
  progressStatus,
  weekdayName,
} from '../utils.js'

export default function Allenamento({ params }) {
  const [tab, setTab] = useState(params.giorno || params.data ? 'registra' : params.tab || 'scheda')

  return (
    <div className="page">
      <PageHeader title="Allenamento" subtitle="Scheda, storico da Hevy e progressi" action={<ChiediClaude ids={['sessione', 'fermo', 'dolore', 'modifica-scheda']} />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'scheda', label: 'Scheda', icon: 'dumbbell' },
          { id: 'storico', label: 'Storico', icon: 'calendar' },
          { id: 'progressi', label: 'Progressi', icon: 'trend' },
          { id: 'registra', label: 'A mano', icon: 'plus' },
        ]}
      />
      {tab === 'scheda' && <SchedaView />}
      {tab === 'storico' && <Storico />}
      {tab === 'progressi' && <Progressi params={params} />}
      {tab === 'registra' && <Registra params={params} />}
    </div>
  )
}

/* ---------------- Registra ---------------- */

const draftKey = (data, giorno) => `coach-bozza:${data}:${giorno}`
const loadDraft = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k))
  } catch {
    return null
  }
}
const saveDraft = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage non disponibile */
  }
}
const clearDraft = (k) => {
  try {
    localStorage.removeItem(k)
  } catch {
    /* */
  }
}

function repsTop(reps) {
  const m = String(reps).match(/(\d+)\s*-\s*(\d+)/)
  return m ? Number(m[2]) : Number.isFinite(Number(reps)) ? Number(reps) : null
}

/** Suggerimento di progressione in base all'ultima sessione */
function suggerimento(target, last) {
  if (!last) return null
  const top = repsTop(target.reps)
  const serie = last.esercizio.serie
  if (!top || !serie.length) return null
  const tutteAlTop = serie.length >= target.serie && serie.every((s) => s.reps >= top)
  if (tutteAlTop) return { tipo: 'up', testo: `L'ultima volta hai chiuso ${top} reps in tutte le serie: aumenta il carico` }
  return null
}

function buildForm(scheda, log, giornoNome, data, esistente) {
  const giorno = scheda?.giorni?.find((g) => g.nome === giornoNome)
  if (esistente) {
    // Modifica di una sessione salvata: esercizi della sessione + eventuali esercizi di scheda mancanti
    const nomi = new Set(esistente.esercizi.map((e) => e.nome))
    const extra = (giorno?.esercizi || []).filter((e) => !nomi.has(e.nome))
    return {
      esercizi: [
        ...esistente.esercizi.map((e) => ({
          nome: e.nome,
          target: giorno?.esercizi.find((t) => t.nome === e.nome) || null,
          // secondi/km (plank, corsa importati da Hevy) non si modificano dal form ma vengono conservati
          serie: e.serie.map((s) => ({
            kg: String(s.kg),
            reps: s.reps ? String(s.reps) : '',
            rir: s.rir ?? '',
            ...(s.secondi ? { secondi: s.secondi } : {}),
            ...(s.km ? { km: s.km } : {}),
          })),
        })),
        ...extra.map((t) => ({ nome: t.nome, target: t, serie: emptySets(t, log, data, scheda) })),
      ],
      durata_min: esistente.durata_min ?? '',
      note: esistente.note ?? '',
    }
  }
  return {
    esercizi: (giorno?.esercizi || []).map((t) => ({ nome: t.nome, target: t, serie: emptySets(t, log, data, scheda) })),
    durata_min: '',
    note: '',
  }
}

/**
 * Serie vuote per un esercizio di scheda, con i kg precompilati:
 * - prima sessione della scheda (o esercizio mai fatto) → carico indicato dalla scheda, se c'è;
 * - altrimenti → i kg dell'ultima sessione.
 */
function emptySets(t, log, data, scheda) {
  const last = lastExercise(log, t.nome, data)
  const primaVoltaInScheda = scheda?.inizio && (!last || last.data < scheda.inizio)
  const kgScheda = primaVoltaInScheda ? kgDaScheda(t, settimanaScheda(scheda, data)) : null
  return Array.from({ length: t.serie }, (_, i) => {
    const prev = last?.esercizio.serie[i] || last?.esercizio.serie.at(-1)
    const kg = kgScheda ?? prev?.kg
    return { kg: kg != null ? String(kg) : '', reps: '', rir: t.rir ?? '' }
  })
}

/** La sessione `s` è quella del giorno di scheda `giornoNome`? (anche se importata da Hevy con un altro titolo) */
const stessoGiorno = (s, giornoNome, scheda, aliasGiorni) =>
  s.giorno === giornoNome || giornoScheda(s.giorno, scheda, aliasGiorni) === giornoNome

function Registra({ params }) {
  const { data: scheda } = useScheda()
  const { data: logRaw, save, error } = useLog()
  const { data: imp } = useImpostazioni()
  const [flash, doFlash] = useFlash()
  const [timer, setTimer] = useState(null)
  useWakeLock(true) // in palestra lo schermo resta acceso mentre registri

  const [data, setData] = useState(params.data || isoDate())
  const [giornoNome, setGiornoNome] = useState(params.giorno || '')
  const [form, setForm] = useState(null)
  const [nuovoEs, setNuovoEs] = useState('')

  const log = useMemo(() => (logRaw || []).filter((s) => !isExampleSession(s)), [logRaw])

  // Giorno di default: dal calendario, altrimenti il primo della scheda
  useEffect(() => {
    if (giornoNome || !scheda) return
    const cal = imp?.calendario?.[weekdayName()]
    setGiornoNome(cal || scheda.giorni[0]?.nome || '')
  }, [scheda, imp, giornoNome])

  useEffect(() => {
    if (params.giorno) setGiornoNome(params.giorno)
    if (params.data) setData(params.data)
  }, [params.giorno, params.data])

  const esistente = log.find((s) => s.data === data && stessoGiorno(s, giornoNome, scheda, imp?.hevy_giorni))
  const key = draftKey(data, giornoNome)

  // (Ri)costruisce il form quando cambiano data/giorno o arrivano i dati
  useEffect(() => {
    if (!scheda || !logRaw || !giornoNome) return
    setForm(loadDraft(key) || buildForm(scheda, log, giornoNome, data, esistente))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheda, logRaw, giornoNome, data])

  function update(next) {
    setForm(next)
    saveDraft(key, next)
  }

  function setSerie(ei, si, field, value) {
    const next = structuredClone(form)
    next.esercizi[ei].serie[si][field] = value
    update(next)
  }
  function addSerie(ei) {
    const next = structuredClone(form)
    const s = next.esercizi[ei].serie
    s.push({ ...(s.at(-1) || { kg: '', rir: '' }), reps: '' })
    update(next)
  }
  function removeSerie(ei, si) {
    const next = structuredClone(form)
    next.esercizi[ei].serie.splice(si, 1)
    update(next)
  }
  function avviaRecupero(e) {
    if (!(e.target?.recupero_s > 0)) return
    sbloccaAudio() // va fatto nel tocco, altrimenti su iPhone il beep finale non suona
    setTimer({ secondi: e.target.recupero_s, nome: e.nome, id: Date.now() })
  }

  /**
   * ✓ serie fatta: se le ripetizioni sono vuote le prende dalla volta scorsa (o dal minimo del range
   * della scheda) e fa partire il recupero. Se la serie era già segnata, la riapre.
   */
  function serieFatta(ei, si, prev) {
    const e = form.esercizi[ei]
    const s = e.serie[si]
    if (s.reps !== '') return setSerie(ei, si, 'reps', '')
    const reps = prev?.reps || Number(String(e.target?.reps ?? '').match(/\d+/)?.[0]) || null
    if (!reps) return document.getElementById(`reps-${ei}-${si}`)?.focus() // es. "max": scrivile tu
    setSerie(ei, si, 'reps', String(reps))
    const ultimaSerie = ei === form.esercizi.length - 1 && si === e.serie.length - 1
    if (!ultimaSerie) avviaRecupero(e)
  }

  function addEsercizio() {
    if (!nuovoEs.trim()) return
    const next = structuredClone(form)
    next.esercizi.push({ nome: nuovoEs.trim(), target: null, serie: [{ kg: '', reps: '', rir: '' }] })
    update(next)
    setNuovoEs('')
  }
  function removeEsercizio(ei) {
    const next = structuredClone(form)
    next.esercizi.splice(ei, 1)
    update(next)
  }

  async function salva() {
    const esercizi = form.esercizi
      .map((e) => ({
        nome: e.nome,
        serie: e.serie
          .filter((s) => (s.reps !== '' && Number(s.reps) > 0) || s.secondi || s.km)
          .map((s) => ({
            kg: Number(String(s.kg).replace(',', '.')) || 0,
            reps: Number(s.reps) || 0,
            rir: s.rir === '' ? null : Number(s.rir),
            ...(s.secondi ? { secondi: s.secondi } : {}),
            ...(s.km ? { km: s.km } : {}),
          })),
      }))
      .filter((e) => e.serie.length)
    if (!esercizi.length) return doFlash('Inserisci almeno una serie con le ripetizioni', true)

    const sessione = {
      data,
      scheda: scheda?.nome ?? '',
      giorno: giornoNome,
      esercizi,
      durata_min: form.durata_min === '' ? null : Number(form.durata_min),
      note: form.note || '',
    }
    // Il primo salvataggio reale rimuove la sessione di esempio
    const altri = (logRaw || []).filter(
      (s) => !isExampleSession(s) && !(s.data === data && stessoGiorno(s, giornoNome, scheda, imp?.hevy_giorni)),
    )
    const next = [...altri, sessione].sort((a, b) => a.data.localeCompare(b.data))
    try {
      await save(next)
      clearDraft(key)
      doFlash(esistente ? 'Sessione aggiornata' : 'Sessione salvata')
    } catch {
      doFlash('Salvataggio non riuscito', true)
    }
  }

  function annullaModifiche() {
    clearDraft(key)
    setForm(buildForm(scheda, log, giornoNome, data, esistente))
  }

  if (!scheda) return <Empty>Carico la scheda…</Empty>

  const compilate = form?.esercizi.reduce((n, e) => n + e.serie.filter((s) => s.reps !== '').length, 0) ?? 0

  return (
    <>
      <ErrorBanner error={error} />
      <Card>
        <div className="form-row">
          <label className="field">
            <span>Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="field grow">
            <span>Giorno della scheda</span>
            <select value={giornoNome} onChange={(e) => setGiornoNome(e.target.value)}>
              {scheda.giorni.map((g) => (
                <option key={g.nome}>{g.nome}</option>
              ))}
            </select>
          </label>
        </div>
        {esistente && (
          <p className="info-box">Stai modificando la sessione già salvata del {formatDate(data)}.</p>
        )}
      </Card>

      {form?.esercizi.map((e, ei) => {
        const last = lastExercise(log, e.nome, data)
        const sug = e.target && suggerimento(e.target, last)
        return (
          <Card key={e.nome + ei} className="exercise">
            <div className="ex-head">
              <div>
                <h3>{e.nome}</h3>
                {e.target && (
                  <p className="muted small">
                    Obiettivo {e.target.serie}×{e.target.reps}
                    {e.target.rir != null && ` · RIR ${e.target.rir}`}
                    {e.target.recupero_s ? ` · recupero ${e.target.recupero_s}s` : ''}
                  </p>
                )}
              </div>
              <div className="ex-actions">
                {e.target?.recupero_s > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => avviaRecupero(e)}
                  >
                    Recupero {e.target.recupero_s}s
                  </button>
                )}
                {!e.target && (
                  <button className="btn btn-icon" aria-label="Rimuovi esercizio" onClick={() => removeEsercizio(ei)}>
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
            </div>
            {e.target?.note && <p className="note">{e.target.note}</p>}
            {last && (
              <p className="last">
                Ultima volta ({formatDate(last.data)}): <strong>{formatSets(last.esercizio.serie)}</strong>
              </p>
            )}
            {sug && <p className="hint-up">{sug.testo}</p>}

            <div className="sets">
              <div className="set-row set-head">
                <span>#</span>
                <span>kg</span>
                <span>reps</span>
                <span>RIR</span>
                <span />
                <span />
              </div>
              {e.serie.map((s, si) => {
                // Le serie della volta scorsa servono da suggerimento solo se sono della scheda in corso
                const prev = last && (!scheda.inizio || last.data >= scheda.inizio) ? last.esercizio.serie[si] : null
                const fatta = s.reps !== ''
                return (
                  <div className={`set-row ${s.reps !== '' ? 'filled' : ''}`} key={si}>
                    <span className="set-n">{si + 1}</span>
                    <input
                      inputMode="decimal"
                      value={s.kg}
                      placeholder={prev ? String(prev.kg) : 'kg'}
                      aria-label={`Serie ${si + 1} kg`}
                      onChange={(ev) => setSerie(ei, si, 'kg', ev.target.value)}
                    />
                    <input
                      id={`reps-${ei}-${si}`}
                      inputMode="numeric"
                      value={s.reps}
                      placeholder={prev ? String(prev.reps) : String(e.target?.reps ?? 'reps')}
                      aria-label={`Serie ${si + 1} ripetizioni`}
                      onChange={(ev) => setSerie(ei, si, 'reps', ev.target.value)}
                    />
                    <input
                      inputMode="numeric"
                      value={s.rir}
                      placeholder="RIR"
                      aria-label={`Serie ${si + 1} RIR`}
                      onChange={(ev) => setSerie(ei, si, 'rir', ev.target.value)}
                    />
                    <button
                      className={`set-done ${fatta ? 'on' : ''}`}
                      aria-pressed={fatta}
                      aria-label={fatta ? `Riapri serie ${si + 1}` : `Serie ${si + 1} fatta`}
                      title={fatta ? 'Riapri la serie' : 'Serie fatta: compila le reps e avvia il recupero'}
                      onClick={() => serieFatta(ei, si, prev)}
                    >
                      <Icon name="check" size={18} />
                    </button>
                    <button
                      className="btn btn-icon"
                      aria-label={`Rimuovi serie ${si + 1}`}
                      onClick={() => removeSerie(ei, si)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                )
              })}
              <button className="btn btn-ghost btn-sm" onClick={() => addSerie(ei)}>
                <Icon name="plus" size={15} /> Serie
              </button>
            </div>
          </Card>
        )
      })}

      <Card>
        <div className="form-row">
          <label className="field grow">
            <span>Esercizio extra</span>
            <input
              value={nuovoEs}
              placeholder="Es. Crunch al cavo"
              onChange={(e) => setNuovoEs(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEsercizio()}
            />
          </label>
          <button className="btn" onClick={addEsercizio}>
            <Icon name="plus" size={16} /> Aggiungi
          </button>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Durata (min)</span>
            <input
              inputMode="numeric"
              value={form?.durata_min ?? ''}
              onChange={(e) => update({ ...form, durata_min: e.target.value })}
            />
          </label>
          <label className="field grow">
            <span>Note (sensazioni, fastidi, corsa: km e ritmo…)</span>
            <input value={form?.note ?? ''} onChange={(e) => update({ ...form, note: e.target.value })} />
          </label>
        </div>
      </Card>

      <div className="save-bar">
        <span className="muted small">{compilate} serie compilate · la bozza si salva da sola</span>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={annullaModifiche}>
            Ripristina
          </button>
          <button className="btn btn-primary" onClick={salva}>
            <Icon name="check" size={16} /> {esistente ? 'Aggiorna sessione' : 'Salva sessione'}
          </button>
        </div>
      </div>
      {timer && <RestTimer key={timer.id} secondi={timer.secondi} nome={timer.nome} onClose={() => setTimer(null)} />}
      {flash}
    </>
  )
}

/* ---------------- Storico ---------------- */

function Storico() {
  const { data: logRaw, save, error } = useLog()
  const [aperta, setAperta] = useState(null)
  const [daEliminare, setDaEliminare] = useState(null)
  const [flash, doFlash] = useFlash()
  const log = (logRaw || []).filter((s) => !isExampleSession(s)).sort((a, b) => b.data.localeCompare(a.data))

  async function elimina(s) {
    await save(logRaw.filter((x) => !(x.data === s.data && x.giorno === s.giorno)))
    setDaEliminare(null)
    doFlash('Sessione eliminata')
  }

  if (!logRaw) return <Empty>Carico…</Empty>

  return (
    <>
      <ImportHevy />
      <ErrorBanner error={error} />
      {!log.length && <Empty>Nessuna sessione ancora. Importa l'export di Hevy qui sopra.</Empty>}
      <div className="history">
        {log.map((s) => {
          const id = `${s.data}|${s.giorno}`
          const open = aperta === id
          const serie = s.esercizi.reduce((n, e) => n + e.serie.length, 0)
          return (
            <Card key={id} className="history-item">
              <button className="history-head" onClick={() => setAperta(open ? null : id)} aria-expanded={open}>
                <div>
                  <strong>{formatDate(s.data, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                  <div className="muted small">
                    {s.giorno} · {s.esercizi.length} esercizi · {serie} serie
                    {s.durata_min ? ` · ${s.durata_min} min` : ''}
                  </div>
                </div>
                <span className={`chev ${open ? 'open' : ''}`}>
                  <Icon name="chevron" />
                </span>
              </button>
              {open && (
                <div className="history-body">
                  <table className="table">
                    <tbody>
                      {s.esercizi.map((e) => (
                        <tr key={e.nome}>
                          <td>{e.nome}</td>
                          <td className="num">{formatSets(e.serie)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {s.note && <p className="note">{s.note}</p>}
                  <div className="row-gap">
                    <button className="btn" onClick={() => navigate('allenamento', { data: s.data, giorno: s.giorno })}>
                      <Icon name="edit" size={16} /> Modifica
                    </button>
                    {daEliminare === id ? (
                      <>
                        <button className="btn btn-danger" onClick={() => elimina(s)}>
                          Conferma eliminazione
                        </button>
                        <button className="btn btn-ghost" onClick={() => setDaEliminare(null)}>
                          Annulla
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => setDaEliminare(id)}>
                        <Icon name="trash" size={16} /> Elimina
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
      {flash}
    </>
  )
}

/* ---------------- Scheda ---------------- */

function SchedaView() {
  const { data: scheda } = useScheda()
  if (!scheda) return <Empty>Carico la scheda…</Empty>
  return (
    <>
      <Card>
        <h2 className="scheda-title">{scheda.nome}</h2>
        <p className="muted">
          Dal {formatDate(scheda.inizio, { day: 'numeric', month: 'long', year: 'numeric' })} · {scheda.settimane}{' '}
          settimane. Per modificarla chiedi a Claude: aggiorna <code>schede/attuale.json</code>.
        </p>
      </Card>
      {scheda.giorni.map((g) => (
        <Card key={g.nome} title={g.nome}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Esercizio</th>
                  <th className="num">Serie</th>
                  <th className="num">Reps</th>
                  <th className="num">RIR</th>
                  <th className="num">Rec.</th>
                </tr>
              </thead>
              <tbody>
                {g.esercizi.map((e) => (
                  <tr key={e.nome}>
                    <td>
                      {e.nome}
                      {e.note && <div className="muted small">{e.note}</div>}
                    </td>
                    <td className="num">{e.serie}</td>
                    <td className="num">{e.reps}</td>
                    <td className="num">{e.rir ?? '—'}</td>
                    <td className="num">{e.recupero_s ? `${e.recupero_s}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </>
  )
}

/* ---------------- Import da Hevy ---------------- */

function ImportHevy() {
  const { data: logRaw, save } = useLog()
  const { data: scheda } = useScheda()
  const { data: imp } = useImpostazioni()
  const [anteprima, setAnteprima] = useState(null)
  const [errore, setErrore] = useState(null)
  const [flash, doFlash] = useFlash()

  async function leggi(file) {
    setErrore(null)
    setAnteprima(null)
    try {
      const rows = parseCsv(await file.text())
      if (!rows.length || !('exercise_title' in rows[0])) throw new Error('Non sembra un export allenamenti di Hevy')
      const nomeScheda = (d) => (scheda?.inizio && d >= scheda.inizio ? scheda.nome : 'Storico Hevy')
      // Dall'inizio della scheda il titolo dell'allenamento diventa il giorno di scheda ("Push" → "Giorno A — Push")
      const giorno = (titolo, d) => (schedaAttiva(scheda, d) ? giornoScheda(titolo, scheda, imp?.hevy_giorni) : null)
      const { sessioni, saltate } = hevyToSessions(rows, { alias: imp?.hevy_alias || {}, nomeScheda, giorno })
      const { aggiunte, aggiornate } = mergeLog(logRaw || [], sessioni, isExampleSession)
      const nomiScheda = new Set((scheda?.giorni || []).flatMap((g) => g.esercizi.map((e) => e.nome)))
      const recenti = sessioni.filter((s) => !scheda?.inizio || s.data >= scheda.inizio)
      const nonInScheda = [...new Set(recenti.flatMap((s) => s.esercizi.map((e) => e.nome)))].filter(
        (n) => !nomiScheda.has(n),
      )
      const giorniScheda = new Set((scheda?.giorni || []).map((g) => g.nome))
      const titoliNonCollegati = [...new Set(recenti.map((s) => s.giorno).filter((g) => !giorniScheda.has(g)))]
      setAnteprima({ file: file.name, sessioni, saltate, aggiunte, aggiornate, nonInScheda, titoliNonCollegati })
    } catch (e) {
      setErrore(e.message)
    }
  }

  async function conferma() {
    const { log } = mergeLog(logRaw || [], anteprima.sessioni, isExampleSession)
    await save(log)
    doFlash(`Importate ${anteprima.aggiunte} nuove sessioni`)
    setAnteprima(null)
  }

  const primo = anteprima?.sessioni[0]?.data
  const ultimo = anteprima?.sessioni.at(-1)?.data

  return (
    <Card title="Importa da Hevy" className="card-accent">
      <p className="muted small">
        In Hevy: Profilo → Impostazioni → Export &amp; Import Data → Export Data → allenamenti. Puoi reimportare
        tutto lo storico ogni volta: le sessioni già presenti vengono aggiornate, non duplicate.
      </p>
      <label className="btn file-btn">
        <Icon name="plus" size={16} /> Scegli il file CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files[0] && leggi(e.target.files[0])}
          hidden
        />
      </label>
      {errore && <div className="banner-error">{errore}</div>}
      {anteprima && (
        <div className="import-preview">
          <p>
            <strong>{anteprima.sessioni.length} sessioni</strong> dal {formatDate(primo)} al {formatDate(ultimo)}:{' '}
            {anteprima.aggiunte} nuove, {anteprima.aggiornate} già presenti (verranno aggiornate).
          </p>
          <p className="muted small">
            Saltate {anteprima.saltate} serie di riscaldamento o vuote.
          </p>
          {anteprima.titoliNonCollegati.length > 0 && (
            <p className="muted small">
              Allenamenti non collegati a un giorno di scheda: {anteprima.titoliNonCollegati.join(', ')}. Collegali in
              Salute → Impostazioni → Giorni Hevy.
            </p>
          )}
          {anteprima.nonInScheda.length > 0 && (
            <p className="muted small">
              Esercizi recenti non presenti in scheda: {anteprima.nonInScheda.join(', ')}. Se sono gli stessi con un
              nome diverso, collegali in Salute → Impostazioni → Nomi Hevy.
            </p>
          )}
          <div className="row-gap">
            <button className="btn btn-primary" onClick={conferma}>
              <Icon name="check" size={16} /> Importa
            </button>
            <button className="btn btn-ghost" onClick={() => setAnteprima(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}
      {flash}
    </Card>
  )
}

/* ---------------- Progressi ---------------- */

const STATO = {
  su: { label: 'in crescita', tone: 'good' },
  ok: { label: 'regolare', tone: 'neutral' },
  fermo: { label: 'fermo', tone: 'warn' },
  pochi: { label: 'pochi dati', tone: 'neutral' },
  vecchio: { label: 'non recente', tone: 'neutral' },
  nessuno: { label: 'mai fatto', tone: 'neutral' },
}

function Progressi({ params }) {
  const { data: logRaw } = useLog()
  const { data: scheda } = useScheda()
  const [scelto, setScelto] = useState(params.esercizio || null)
  const [soloScheda, setSoloScheda] = useState(true)
  const dettaglio = useRef(null)

  const log = useMemo(() => (logRaw || []).filter((s) => !isExampleSession(s)), [logRaw])
  const nomiScheda = useMemo(
    () => [...new Set((scheda?.giorni || []).flatMap((g) => g.esercizi.map((e) => e.nome)))],
    [scheda],
  )
  const tutti = useMemo(() => {
    const cont = new Map()
    for (const s of log) for (const e of s.esercizi) cont.set(e.nome, (cont.get(e.nome) || 0) + 1)
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
  }, [log])

  if (!logRaw || !scheda) return <Empty>Carico…</Empty>
  if (!log.length) return <Empty>Importa gli allenamenti da Hevy (scheda Storico) per vedere i progressi.</Empty>

  // Scheda in corso: "fermo / in crescita" si valuta solo sulle sessioni di questa scheda
  const dalScheda = schedaAttiva(scheda) ? scheda.inizio : null
  const elenco = soloScheda ? nomiScheda : tutti
  const righe = elenco
    .map((nome) => {
      const storia = exerciseHistory(log, nome)
      return { nome, storia, stato: progressStatus(storia, new Date(), dalScheda) }
    })
  const attivo = scelto && (elenco.includes(scelto) || tutti.includes(scelto)) ? scelto : righe.find((r) => r.storia.length)?.nome
  const storia = attivo ? exerciseHistory(log, attivo) : []
  const fermi = righe.filter((r) => r.stato === 'fermo')

  return (
    <>
      {fermi.length > 0 && (
        <div className="warn-box">
          Fermi nelle ultime 3 sessioni{dalScheda ? ' della scheda' : ''}: {fermi.map((f) => f.nome).join(', ')}. Chiedi a Claude un aggiustamento
          (variante, scarico o cambio di ripetizioni).
        </div>
      )}
      <div className="grid-progress">
        <Card
          title="Esercizi"
          action={
            <select className="select-sm" value={soloScheda ? 'scheda' : 'tutti'} onChange={(e) => setSoloScheda(e.target.value === 'scheda')}>
              <option value="scheda">In scheda</option>
              <option value="tutti">Tutti</option>
            </select>
          }
        >
          <ul className="prog-list">
            {righe.map((r) => {
              const last = r.storia.at(-1)
              const st = STATO[r.stato]
              return (
                <li key={r.nome}>
                  <button
                    className={`prog-item ${attivo === r.nome ? 'active' : ''}`}
                    onClick={() => {
                      setScelto(r.nome)
                      if (window.innerWidth < 860)
                        setTimeout(() => {
                          const top = dettaglio.current.getBoundingClientRect().top + window.scrollY - 70
                          window.scrollTo({ top, behavior: 'smooth' })
                        }, 50)
                    }}
                    disabled={!r.storia.length}
                  >
                    <span className="grow">
                      <span className="prog-name">{r.nome}</span>
                      <span className="muted small">
                        {last ? `${formatSet(last.top)} · ${formatDate(last.data)}` : 'nessuna sessione'}
                      </span>
                    </span>
                    <span className={`tag tag-${st.tone}`}>{st.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>

        <div ref={dettaglio} className="prog-detail">
        <Card title={attivo ? `${attivo}: ${TIPO_INFO[storia.at(-1)?.tipo || 'carico'].label}` : 'Dettaglio'}>
          {attivo && storia.length ? (
            <>
              <div className="stats">
                <div className="stat">
                  <div className="stat-label">Serie migliore ultima volta</div>
                  <div className="stat-value stat-value-sm">{formatSet(storia.at(-1).top)}</div>
                </div>
                <div className="stat">
                  <div className="stat-label cap">{TIPO_INFO[storia.at(-1).tipo].label}</div>
                  <div className="stat-value">
                    {storia.at(-1).valore}
                    <span className="stat-unit">{TIPO_INFO[storia.at(-1).tipo].unita}</span>
                  </div>
                  {storia.length > 1 && (
                    <div className="stat-hint">
                      {(() => {
                        const d = Math.round((storia.at(-1).valore - storia[0].valore) * 10) / 10
                        return `${d > 0 ? '+' : ''}${d} ${TIPO_INFO[storia.at(-1).tipo].unita} dal ${formatDate(storia[0].data)}`
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <TrendChart
                punti={storia.map((h) => ({
                  data: h.data,
                  valore: h.valore,
                  dettaglio: `migliore ${formatSet(h.top)}`,
                }))}
                unita={TIPO_INFO[storia.at(-1).tipo].unita}
              />
              {storia.at(-1).tipo === 'carico' && (
                <p className="muted small">
                  Il 1RM stimato mette insieme carico e ripetizioni: sale sia se aumenti i kg sia se fai più reps.
                </p>
              )}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Serie</th>
                      <th className="num">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...storia].reverse().slice(0, 12).map((h) => (
                      <tr key={h.data}>
                        <td>{formatDate(h.data)}</td>
                        <td className="num-left">{formatSets(h.serie)}</td>
                        <td className="num">{h.tipo === 'carico' ? `${Math.round(h.volume)} kg` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <Empty>Nessuna sessione per questo esercizio.</Empty>
          )}
        </Card>
        </div>
      </div>
    </>
  )
}
