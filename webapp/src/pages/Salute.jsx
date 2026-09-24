import { useEffect, useRef, useState } from 'react'
import { Card, Empty, ErrorBanner, Icon, PageHeader, Stat, Tabs, useFlash } from '../components/ui.jsx'
import WeightChart from '../components/WeightChart.jsx'
import { useImpostazioni, useMisure, useScheda } from '../hooks.js'
import { ChiediClaude } from './Claude.jsx'
import { GIORNI_SETTIMANA, addDays, formatDate, isoDate, round1, validWeights, weeklyAvg } from '../utils.js'

export default function Salute({ params }) {
  const [tab, setTab] = useState(params.tab || 'peso')
  return (
    <div className="page">
      <PageHeader title="Salute" subtitle="Peso, misure e impostazioni" action={<ChiediClaude ids={['progressi', 'profilo']} />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'peso', label: 'Peso e misure', icon: 'trend' },
          { id: 'impostazioni', label: 'Impostazioni', icon: 'gear' },
        ]}
      />
      {tab === 'peso' ? <Peso /> : <Impostazioni />}
    </div>
  )
}

/* ---------------- Peso ---------------- */

function Peso() {
  const { data: misure, save, error } = useMisure()
  const { data: imp } = useImpostazioni()
  const [flash, doFlash] = useFlash()
  const [form, setForm] = useState({ data: isoDate(), peso_kg: '', vita_cm: '', note: '' })
  const [daEliminare, setDaEliminare] = useState(null)
  const [tutte, setTutte] = useState(false)

  const esistente = misure?.find((m) => m.data === form.data && m.peso_kg != null)

  // Quando cambi data (o arrivano i dati la prima volta) il form mostra la misura di quel giorno,
  // oppure si svuota. Non si tocca mentre scrivi, anche se i dati vengono ricaricati.
  const dataCaricata = useRef(null)
  useEffect(() => {
    if (!misure || dataCaricata.current === form.data) return
    dataCaricata.current = form.data
    setForm((f) => ({
      ...f,
      peso_kg: esistente ? String(esistente.peso_kg ?? '') : '',
      vita_cm: esistente?.vita_cm != null ? String(esistente.vita_cm) : '',
      note: esistente?.note ?? '',
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.data, misure])

  if (!misure) return <Empty>Carico…</Empty>

  const num = (v) => (v === '' ? null : Number(String(v).replace(',', '.')))

  async function salva() {
    const peso = num(form.peso_kg)
    if (peso == null || Number.isNaN(peso) || peso < 30 || peso > 250) return doFlash('Inserisci un peso valido', true)
    const riga = { data: form.data, peso_kg: peso, vita_cm: num(form.vita_cm), note: form.note }
    // Le righe vuote di esempio vengono rimosse al primo salvataggio
    const altre = misure.filter((m) => m.data !== form.data && m.peso_kg != null)
    await save([...altre, riga].sort((a, b) => a.data.localeCompare(b.data)))
    doFlash(esistente ? 'Misura aggiornata' : 'Misura salvata')
  }

  async function elimina(d) {
    await save(misure.filter((m) => m.data !== d))
    setDaEliminare(null)
  }

  const pesi = validWeights(misure)
  const oggi = isoDate()
  const media = weeklyAvg(misure, oggi)
  const mediaPrec = weeklyAvg(misure, isoDate(addDays(new Date(), -7)))
  const delta = media != null && mediaPrec != null ? round1(media - mediaPrec) : null
  const pctSett = delta != null && mediaPrec ? round1((delta / mediaPrec) * 100) : null
  const vite = pesi.filter((m) => m.vita_cm != null)
  const target = imp?.peso_obiettivo_kg

  let commento = 'Pesati 3-4 mattine a settimana, a digiuno e dopo il bagno: conta la media, non il singolo giorno.'
  if (pctSett != null) {
    if (pctSett < -1) commento = 'Stai calando più dell\'1% a settimana: rischi di perdere forza. Valuta di mangiare un po\' di più.'
    else if (pctSett <= -0.25) commento = 'Ritmo ideale per la definizione (0,25-1% a settimana). Continua così.'
    else commento = 'Peso stabile. Se resta fermo per 2-3 settimane, chiedi a Claude un aggiustamento.'
  }

  return (
    <>
      <ErrorBanner error={error} />
      <Card title="Nuova misura">
        <div className="form-row">
          <label className="field">
            <span>Data</span>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </label>
          <label className="field">
            <span>Peso (kg)</span>
            <input
              inputMode="decimal"
              value={form.peso_kg}
              placeholder={pesi.at(-1)?.peso_kg ?? '75'}
              onChange={(e) => setForm({ ...form, peso_kg: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Vita (cm)</span>
            <input
              inputMode="decimal"
              value={form.vita_cm}
              placeholder="all'ombelico"
              onChange={(e) => setForm({ ...form, vita_cm: e.target.value })}
            />
          </label>
          <label className="field grow">
            <span>Note</span>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <button className="btn btn-primary" onClick={salva}>
            <Icon name="check" size={16} /> {esistente ? 'Aggiorna' : 'Salva'}
          </button>
        </div>
      </Card>

      <Card title="Andamento">
        <div className="stats stats-4">
          <Stat label="Media 7 giorni" value={media != null ? round1(media) : null} unit="kg" />
          <Stat
            label="Variazione settimanale"
            value={delta != null ? `${delta > 0 ? '+' : ''}${delta}` : null}
            unit="kg"
            hint={pctSett != null ? `${pctSett}% del peso` : null}
          />
          <Stat
            label="Vita"
            value={vite.at(-1)?.vita_cm ?? null}
            unit="cm"
            hint={vite.length > 1 ? `${round1(vite.at(-1).vita_cm - vite[0].vita_cm)} cm dall'inizio` : null}
          />
          <Stat
            label="Dall'inizio"
            value={pesi.length > 1 ? round1(pesi.at(-1).peso_kg - pesi[0].peso_kg) : null}
            unit="kg"
            hint={pesi.length ? `da ${formatDate(pesi[0].data)}` : null}
          />
        </div>
        <p className="coach-note">{commento}</p>
        <WeightChart misure={misure} target={target} />
      </Card>

      <Card title="Storico misure">
        {!pesi.length ? (
          <Empty>Nessuna misura ancora.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="num">Peso</th>
                  <th className="num">Media 7 gg</th>
                  <th className="num">Vita</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...pesi].reverse().slice(0, tutte ? undefined : 10).map((m) => (
                  <tr key={m.data}>
                    <td>{formatDate(m.data)}</td>
                    <td className="num">{m.peso_kg} kg</td>
                    <td className="num">{round1(weeklyAvg(misure, m.data))} kg</td>
                    <td className="num">{m.vita_cm != null ? `${m.vita_cm} cm` : '—'}</td>
                    <td className="muted">{m.note}</td>
                    <td className="num">
                      {daEliminare === m.data ? (
                        <button className="btn btn-danger btn-sm" onClick={() => elimina(m.data)}>
                          Conferma
                        </button>
                      ) : (
                        <button
                          className="btn btn-icon"
                          aria-label={`Elimina misura del ${m.data}`}
                          onClick={() => setDaEliminare(m.data)}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pesi.length > 10 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setTutte(!tutte)}>
                {tutte ? 'Mostra meno' : `Mostra tutte (${pesi.length})`}
              </button>
            )}
          </div>
        )}
      </Card>
      {flash}
    </>
  )
}

/* ---------------- Impostazioni ---------------- */

function Impostazioni() {
  const { data: imp, save, error } = useImpostazioni()
  const { data: scheda } = useScheda()
  const [bozza, setBozza] = useState(null)
  const [profilo, setProfilo] = useState('')
  const [flash, doFlash] = useFlash()

  useEffect(() => {
    if (imp && !bozza) setBozza(structuredClone(imp))
  }, [imp, bozza])

  useEffect(() => {
    fetch('/api/profilo')
      .then((r) => r.json())
      .then((d) => setProfilo(d.testo))
      .catch(() => {})
  }, [])

  if (!bozza || !scheda) return <Empty>Carico…</Empty>

  async function salva() {
    await save(bozza)
    doFlash('Impostazioni salvate')
  }
  const set = (path, value) => {
    const next = structuredClone(bozza)
    let o = next
    for (const k of path.slice(0, -1)) o = o[k]
    o[path.at(-1)] = value
    setBozza(next)
  }
  const numero = (v) => (v === '' ? null : Number(v))

  return (
    <>
      <ErrorBanner error={error} />
      <Card title="Calendario allenamenti" action={<span className="muted small">Decide cosa vedi in Home</span>}>
        <div className="cal-grid">
          {GIORNI_SETTIMANA.map((g) => (
            <label className="field" key={g}>
              <span className="cap">{g}</span>
              <select value={bozza.calendario[g] || ''} onChange={(e) => set(['calendario', g], e.target.value || null)}>
                <option value="">Riposo</option>
                {scheda.giorni.map((d) => (
                  <option key={d.nome} value={d.nome}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Obiettivi">
        <div className="form-row">
          <label className="field">
            <span>Kcal al giorno (indicative)</span>
            <input
              inputMode="numeric"
              value={bozza.target.kcal ?? ''}
              onChange={(e) => set(['target', 'kcal'], numero(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Proteine (g)</span>
            <input
              inputMode="numeric"
              value={bozza.target.proteine_g ?? ''}
              onChange={(e) => set(['target', 'proteine_g'], numero(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Peso obiettivo min (kg)</span>
            <input
              inputMode="decimal"
              value={bozza.peso_obiettivo_kg.min ?? ''}
              onChange={(e) => set(['peso_obiettivo_kg', 'min'], numero(e.target.value))}
            />
          </label>
          <label className="field">
            <span>max (kg)</span>
            <input
              inputMode="decimal"
              value={bozza.peso_obiettivo_kg.max ?? ''}
              onChange={(e) => set(['peso_obiettivo_kg', 'max'], numero(e.target.value))}
            />
          </label>
        </div>
      </Card>

      <Card title="Nomi Hevy" action={<span className="muted small">Per l'import</span>}>
        <p className="muted small">
          Se in Hevy un esercizio ha un nome diverso da quello in scheda, collegalo qui: all'import verrà rinominato.
        </p>
        {Object.entries(bozza.hevy_alias || {}).map(([hevy, nome]) => (
          <div className="form-row alias-row" key={hevy}>
            <span className="grow">{hevy}</span>
            <span className="muted">→</span>
            <span className="grow">{nome}</span>
            <button
              className="btn btn-icon"
              aria-label={`Rimuovi ${hevy}`}
              onClick={() => {
                const a = { ...bozza.hevy_alias }
                delete a[hevy]
                set(['hevy_alias'], a)
              }}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        <AliasForm
          nomiScheda={[...new Set(scheda.giorni.flatMap((g) => g.esercizi.map((e) => e.nome)))]}
          onAdd={(hevy, nome) => set(['hevy_alias'], { ...(bozza.hevy_alias || {}), [hevy]: nome })}
        />
      </Card>

      <Card title="Giorni Hevy" action={<span className="muted small">Per l'import</span>}>
        <p className="muted small">
          I titoli come «Push» o «Giorno B» vengono riconosciuti da soli. Se in Hevy chiami un allenamento in modo
          diverso, collegalo qui al giorno della scheda: così non ti ritrovi la stessa sessione due volte.
        </p>
        {Object.entries(bozza.hevy_giorni || {}).map(([hevy, nome]) => (
          <div className="form-row alias-row" key={hevy}>
            <span className="grow">{hevy}</span>
            <span className="muted">→</span>
            <span className="grow">{nome}</span>
            <button
              className="btn btn-icon"
              aria-label={`Rimuovi ${hevy}`}
              onClick={() => {
                const a = { ...bozza.hevy_giorni }
                delete a[hevy]
                set(['hevy_giorni'], a)
              }}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        <AliasForm
          nomiScheda={scheda.giorni.map((g) => g.nome)}
          etichetta="Titolo dell'allenamento in Hevy"
          etichettaScheda="Giorno della scheda"
          placeholder="Es. Petto e tricipiti"
          onAdd={(hevy, nome) => set(['hevy_giorni'], { ...(bozza.hevy_giorni || {}), [hevy]: nome })}
        />
      </Card>

      <div className="save-bar">
        <span className="muted small">Salvate in impostazioni.json</span>
        <button className="btn btn-primary" onClick={salva}>
          <Icon name="check" size={16} /> Salva impostazioni
        </button>
      </div>

      <Card title="Profilo" action={<span className="muted small">profilo.md · lo aggiorna Claude</span>}>
        <pre className="profile">{profilo || 'profilo.md non trovato'}</pre>
      </Card>
      {flash}
    </>
  )
}

function AliasForm({
  nomiScheda,
  onAdd,
  etichetta = 'Nome in Hevy',
  etichettaScheda = 'Esercizio in scheda',
  placeholder = 'Es. Lat Pulldown - Presa Stretta (Cavo)',
}) {
  const [hevy, setHevy] = useState('')
  const [nome, setNome] = useState(nomiScheda[0] || '')
  return (
    <div className="form-row">
      <label className="field grow">
        <span>{etichetta}</span>
        <input value={hevy} placeholder={placeholder} onChange={(e) => setHevy(e.target.value)} />
      </label>
      <label className="field grow">
        <span>{etichettaScheda}</span>
        <select value={nome} onChange={(e) => setNome(e.target.value)}>
          {nomiScheda.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <button
        className="btn"
        onClick={() => {
          if (!hevy.trim()) return
          onAdd(hevy.trim(), nome)
          setHevy('')
        }}
      >
        <Icon name="plus" size={16} /> Collega
      </button>
    </div>
  )
}
