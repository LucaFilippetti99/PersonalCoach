import { useEffect, useState } from 'react'
import { readJson, saveFile, useJson } from '../api.js'
import { Card, Empty, ErrorBanner, Icon, PageHeader, Tabs, useFlash } from '../components/ui.jsx'
import { CATEGORIE_SPESA } from '../defaults.js'
import { useFrigo, useImpostazioni, usePianiList, useSpesa } from '../hooks.js'
import { navigate } from '../nav.js'
import { ChiediClaude } from './Claude.jsx'
import {
  TIPI_PASTO,
  conTuttiIGiorni,
  contiene,
  ingredientiInFrigo,
  ingredientiMancanti,
  norm,
  ordinaPasti,
  pianoVuoto,
  pulisciPasto,
  ricettario,
} from '../piano.js'
import { etichettaSettimana, isoDate, isoWeek, parseDate, weekdayName } from '../utils.js'

export default function Cibo({ params }) {
  const [tab, setTab] = useState(params.tab || 'piano')
  const spesa = useSpesa()
  const frigo = useFrigo()
  const [flash, doFlash] = useFlash()

  const ctx = { spesa, frigo, doFlash }
  return (
    <div className="page">
      <PageHeader title="Cibo" subtitle="Piano della settimana, lista della spesa e frigo" action={<ChiediClaude ids={['settimana-cibo', 'piano-pasti', 'spesa']} />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'piano', label: 'Piano pasti', icon: 'calendar' },
          { id: 'spesa', label: 'Spesa', icon: 'cart', badge: spesa.data?.articoli.length || null },
          { id: 'frigo', label: 'Frigo', icon: 'fridge', badge: frigo.data?.articoli.length || null },
        ]}
      />
      <ErrorBanner error={spesa.error || frigo.error} />
      {tab === 'piano' && <Piano {...ctx} />}
      {tab === 'spesa' && <Spesa {...ctx} />}
      {tab === 'frigo' && <Frigo {...ctx} />}
      {flash}
    </div>
  )
}

/* ---------------- Piano pasti ---------------- */

function Piano({ spesa, frigo, doFlash }) {
  const { files, suggested, current, reload: reloadList } = usePianiList()
  const [scelto, setScelto] = useState(null)
  const file = scelto || suggested
  const piano = useJson(file ? `piani-pasti/${file}` : null, null)
  const ricette = useRicettario(files)
  const { data: imp } = useImpostazioni()
  const oggi = weekdayName()
  const [aperto, setAperto] = useState(oggi)
  const [modifica, setModifica] = useState(null) // { giorno, indice } — indice null = nuovo pasto
  const [avviso, setAvviso] = useState(null) // { tipo: 'mancanti' | 'frigo', giorno, indice, nomi }

  const articoliFrigo = frigo.data?.articoli || []
  const articoliSpesa = spesa.data?.articoli || []
  const inFrigo = (n) => contiene(articoliFrigo, n)
  const inSpesa = (n) => contiene(articoliSpesa, n)

  async function creaSettimana() {
    const settimana = isoWeek()
    await saveFile(`piani-pasti/${settimana}.json`, pianoVuoto(settimana, imp?.target?.kcal ?? null))
    await reloadList()
    setScelto(`${settimana}.json`)
    doFlash(`Piano ${etichettaSettimana(settimana)} creato`)
  }

  async function salvaPiano(next) {
    await piano.save(next)
  }

  /** Aggiorna i pasti di un giorno con una funzione (pasti) => pasti */
  async function aggiornaGiorno(giorno, fn) {
    const base = conTuttiIGiorni(piano.data)
    const giorni = base.giorni.map((g) => (g.giorno === giorno ? { ...g, pasti: ordinaPasti(fn(g.pasti)) } : g))
    // Nel file teniamo solo i giorni con almeno un pasto (come nei piani di Claude)
    await salvaPiano({ ...base, giorni: giorni.filter((g) => g.pasti.length) })
  }

  async function salvaPasto(giorno, indice, pasto) {
    const pulito = pulisciPasto(pasto)
    await aggiornaGiorno(giorno, (pasti) =>
      indice == null ? [...pasti, pulito] : pasti.map((p, i) => (i === indice ? pulito : p)),
    )
    setModifica(null)
    const nomi = ingredientiMancanti(pulito, articoliFrigo, articoliSpesa)
    setAvviso(nomi.length ? { tipo: 'mancanti', giorno, nomi } : null)
    doFlash('Pasto salvato')
  }

  async function eliminaPasto(giorno, indice) {
    await aggiornaGiorno(giorno, (pasti) => pasti.filter((_, i) => i !== indice))
    setAvviso(null)
    doFlash('Pasto eliminato')
  }

  async function segnaFatto(giorno, indice, pasto) {
    const fatto = !pasto.fatto
    await aggiornaGiorno(giorno, (pasti) =>
      pasti.map((p, i) => {
        if (i !== indice) return p
        const { fatto: _, ...resto } = p
        return fatto ? { ...resto, fatto: true } : resto
      }),
    )
    const nomi = fatto ? ingredientiInFrigo(pasto, articoliFrigo) : []
    setAvviso(nomi.length ? { tipo: 'frigo', giorno, nomi, scelti: [] } : null)
  }

  async function aggiungiAllaSpesa(nomi) {
    await spesa.save({
      aggiornata: isoDate(),
      articoli: [...articoliSpesa, ...nomi.filter((n) => !inSpesa(n)).map((nome) => ({ nome, categoria: 'altro', quantita: '' }))],
    })
    setAvviso(null)
    doFlash(`${nomi.length} ${nomi.length === 1 ? 'ingrediente aggiunto' : 'ingredienti aggiunti'} alla spesa`)
  }

  async function togliDalFrigo(nomi) {
    if (nomi.length) {
      await frigo.save({
        aggiornato: isoDate(),
        articoli: articoliFrigo.filter((a) => !nomi.some((n) => norm(n) === norm(a.nome))),
      })
      doFlash('Frigo aggiornato')
    }
    setAvviso(null)
  }

  async function aggiungiExtra(item) {
    const nome = typeof item === 'string' ? item : item.nome
    if (inSpesa(nome)) return doFlash(`${nome} è già in lista`)
    await spesa.save({
      aggiornata: isoDate(),
      articoli: [...articoliSpesa, { nome, categoria: item.categoria || 'altro', quantita: item.quantita || '' }],
    })
    doFlash(`${nome} aggiunto alla spesa`)
  }

  const dati = piano.data ? conTuttiIGiorni(piano.data) : null
  const isEsempio = /esempio/i.test(file || '')

  return (
    <>
      <ErrorBanner error={piano.error} />
      {files && !current && (
        <Card className="card-accent">
          <div className="plan-head">
            <div>
              <h2>Nessun piano per questa settimana ({etichettaSettimana(isoWeek())})</h2>
              <p className="muted small">
                Crealo vuoto e riempilo tu (anche scegliendo piatti già fatti), oppure fattelo proporre da Claude.
              </p>
            </div>
            <div className="row-gap">
              <button className="btn btn-primary" onClick={creaSettimana}>
                <Icon name="plus" size={16} /> Crea piano vuoto
              </button>
              <button className="btn" onClick={() => navigate('claude', { t: 'piano-pasti' })}>
                <Icon name="chat" size={16} /> Chiedi a Claude
              </button>
            </div>
          </div>
        </Card>
      )}

      {files && files.length > 1 && (
        <label className="field inline">
          <span>Settimana</span>
          <select value={file || ''} onChange={(e) => setScelto(e.target.value)}>
            {files.map((f) => (
              <option key={f} value={f}>
                {etichettaSettimana(f)}
                {/esempio/i.test(f) ? ' (esempio)' : f.includes(isoWeek()) ? ' (questa)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {!dati ? (
        <Empty>{files && !files.length ? 'Nessun piano ancora.' : 'Carico il piano…'}</Empty>
      ) : (
        <>
          <p className="muted small">
            Settimana {etichettaSettimana(dati.settimana)}
            {dati.kcal_giorno_indicative ? ` · ~${dati.kcal_giorno_indicative} kcal al giorno` : ''}
            {isEsempio && ' · file di esempio'} · tocca un giorno per vedere, modificare o aggiungere pasti
          </p>
          <div className="days">
            {dati.giorni.map((g) => {
              const open = aperto === g.giorno
              const fatti = g.pasti.filter((p) => p.fatto).length
              return (
                <Card key={g.giorno} className={`day ${g.giorno === oggi ? 'is-today' : ''}`}>
                  <button className="history-head" onClick={() => setAperto(open ? null : g.giorno)} aria-expanded={open}>
                    <div>
                      <strong className="cap">{g.giorno}</strong>
                      {g.giorno === oggi && <span className="pill">oggi</span>}
                      {g.pasti.length > 0 && fatti === g.pasti.length && <span className="pill pill-done">fatto</span>}
                      <div className="muted small">
                        {g.pasti.length ? g.pasti.map((p) => p.piatto).join(' · ') : 'nessun pasto'}
                      </div>
                    </div>
                    <span className={`chev ${open ? 'open' : ''}`}>
                      <Icon name="chevron" />
                    </span>
                  </button>
                  {open && (
                    <div className="meals">
                      {g.pasti.map((p, i) =>
                        modifica && modifica.giorno === g.giorno && modifica.indice === i ? (
                          <PastoEditor
                            key={i}
                            iniziale={p}
                            ricette={ricette}
                            onSave={(x) => salvaPasto(g.giorno, i, x)}
                            onCancel={() => setModifica(null)}
                          />
                        ) : (
                          <PastoView
                            key={i}
                            pasto={p}
                            inFrigo={inFrigo}
                            inSpesa={inSpesa}
                            onFatto={() => segnaFatto(g.giorno, i, p)}
                            onEdit={() => {
                              setModifica({ giorno: g.giorno, indice: i })
                              setAvviso(null)
                            }}
                            onDelete={() => eliminaPasto(g.giorno, i)}
                          />
                        ),
                      )}
                      {modifica && modifica.giorno === g.giorno && modifica.indice == null && (
                        <PastoEditor
                          iniziale={{ tipo: g.pasti.some((p) => p.tipo === 'pranzo') ? 'cena' : 'pranzo', piatto: '', ingredienti: [], ricetta: [], note: '' }}
                          ricette={ricette}
                          nuovo
                          onSave={(x) => salvaPasto(g.giorno, null, x)}
                          onCancel={() => setModifica(null)}
                        />
                      )}
                      {avviso && avviso.giorno === g.giorno && (
                        <Avviso avviso={avviso} onSpesa={aggiungiAllaSpesa} onFrigo={togliDalFrigo} onClose={() => setAvviso(null)} />
                      )}
                      {!modifica && (
                        <button
                          className="btn btn-ghost add-meal"
                          onClick={() => {
                            setModifica({ giorno: g.giorno, indice: null })
                            setAvviso(null)
                          }}
                        >
                          <Icon name="plus" size={16} /> Aggiungi pasto
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
          {dati.da_comprare_extra?.length > 0 && (
            <Card title="Da comprare in più">
              <ul className="plain-list">
                {dati.da_comprare_extra.map((it, i) => {
                  const nome = typeof it === 'string' ? it : it.nome
                  return (
                    <li key={i} className="row-between">
                      <span>
                        {nome}
                        {it.motivo && <span className="muted small"> · {it.motivo}</span>}
                      </span>
                      {inSpesa(nome) ? (
                        <span className="muted small">in lista</span>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => aggiungiExtra(it)}>
                          <Icon name="plus" size={15} /> Spesa
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  )
}

/** Carica tutti i piani per costruire il ricettario (piatti già fatti da riusare) */
function useRicettario(files) {
  const [ricette, setRicette] = useState([])
  useEffect(() => {
    if (!files) return
    let vivo = true
    Promise.all(files.map((f) => readJson(`piani-pasti/${f}`).catch(() => null))).then((piani) => {
      if (vivo) setRicette(ricettario(piani.filter(Boolean)))
    })
    return () => {
      vivo = false
    }
  }, [files])
  return ricette
}

function PastoView({ pasto: p, inFrigo, inSpesa, onFatto, onEdit, onDelete }) {
  const [conferma, setConferma] = useState(false)
  return (
    <div className={`meal ${p.fatto ? 'meal-done' : ''}`}>
      <div className="meal-top">
        <div className="meal-title">
          <span className="meal-type">{p.tipo}</span>
          <h3>{p.piatto}</h3>
        </div>
        <div className="meal-actions">
          <button
            className={`btn btn-sm ${p.fatto ? 'btn-done' : ''}`}
            onClick={onFatto}
            aria-pressed={!!p.fatto}
            title={p.fatto ? 'Segna come non mangiato' : 'Segna come mangiato'}
          >
            <Icon name="check" size={15} /> {p.fatto ? 'Mangiato' : 'Segna mangiato'}
          </button>
          <button className="btn btn-icon" onClick={onEdit} aria-label={`Modifica ${p.piatto}`}>
            <Icon name="edit" size={16} />
          </button>
          {conferma ? (
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              Elimina
            </button>
          ) : (
            <button className="btn btn-icon" onClick={() => setConferma(true)} aria-label={`Elimina ${p.piatto}`}>
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      </div>
      {p.ingredienti?.length > 0 && (
        <ul className="ingredients">
          {p.ingredienti.map((ing) => (
            <li key={ing.nome}>
              <span
                className={`stock ${inFrigo(ing.nome) ? 'ok' : inSpesa(ing.nome) ? 'buy' : 'miss'}`}
                title={inFrigo(ing.nome) ? 'In frigo' : inSpesa(ing.nome) ? 'In lista spesa' : 'Non in lista'}
              >
                {inFrigo(ing.nome) ? 'frigo' : inSpesa(ing.nome) ? 'spesa' : '—'}
              </span>
              <span>{ing.nome}</span>
              <span className="muted">{ing.porzione}</span>
            </li>
          ))}
        </ul>
      )}
      {p.ricetta?.length > 0 && (
        <ol className="recipe">
          {(Array.isArray(p.ricetta) ? p.ricetta : [p.ricetta]).map((r, j) => (
            <li key={j}>{r}</li>
          ))}
        </ol>
      )}
      {p.note && <p className="note">{p.note}</p>}
    </div>
  )
}

function PastoEditor({ iniziale, ricette, nuovo, onSave, onCancel }) {
  const [p, setP] = useState(() => ({
    ...iniziale,
    ingredienti: iniziale.ingredienti?.length ? iniziale.ingredienti.map((i) => ({ ...i })) : [{ nome: '', porzione: '' }],
    ricetta: (Array.isArray(iniziale.ricetta) ? iniziale.ricetta : iniziale.ricetta ? [iniziale.ricetta] : []).join('\n'),
  }))
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const setIng = (i, k, v) => setP((x) => ({ ...x, ingredienti: x.ingredienti.map((ing, j) => (j === i ? { ...ing, [k]: v } : ing)) }))

  function daRicettario(nome) {
    const r = ricette.find((x) => x.piatto === nome)
    if (!r) return
    setP((x) => ({
      ...x,
      piatto: r.piatto,
      ingredienti: r.ingredienti.map((i) => ({ ...i })),
      ricetta: r.ricetta.join('\n'),
    }))
  }

  return (
    <div className="meal meal-edit">
      <h3>{nuovo ? 'Nuovo pasto' : 'Modifica pasto'}</h3>
      {ricette.length > 0 && (
        <label className="field">
          <span>Scegli un piatto già fatto (compila ingredienti e ricetta)</span>
          <select value="" onChange={(e) => daRicettario(e.target.value)}>
            <option value="">— dal ricettario ({ricette.length} piatti) —</option>
            {ricette.map((r) => (
              <option key={r.piatto} value={r.piatto}>
                {r.piatto}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="form-row">
        <label className="field">
          <span>Pasto</span>
          <select value={p.tipo} onChange={(e) => set('tipo', e.target.value)}>
            {TIPI_PASTO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="field grow">
          <span>Piatto</span>
          <input value={p.piatto} placeholder="Es. Pasta al tonno e zucchine" onChange={(e) => set('piatto', e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>Ingredienti (nome uguale a frigo/spesa per riconoscerli)</span>
        {p.ingredienti.map((ing, i) => (
          <div className="ing-row" key={i}>
            <input value={ing.nome} placeholder="Ingrediente" aria-label={`Ingrediente ${i + 1}`} onChange={(e) => setIng(i, 'nome', e.target.value)} />
            <input value={ing.porzione} placeholder="Porzione" aria-label={`Porzione ${i + 1}`} onChange={(e) => setIng(i, 'porzione', e.target.value)} />
            <button
              className="btn btn-icon"
              aria-label={`Rimuovi ingrediente ${i + 1}`}
              onClick={() => set('ingredienti', p.ingredienti.filter((_, j) => j !== i))}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm add-ing" onClick={() => set('ingredienti', [...p.ingredienti, { nome: '', porzione: '' }])}>
          <Icon name="plus" size={15} /> Ingrediente
        </button>
      </div>
      <label className="field">
        <span>Ricetta (un passaggio per riga)</span>
        <textarea rows={3} value={p.ricetta} onChange={(e) => set('ricetta', e.target.value)} />
      </label>
      <label className="field">
        <span>Note</span>
        <input value={p.note || ''} placeholder="Es. fuori con colleghi" onChange={(e) => set('note', e.target.value)} />
      </label>
      <div className="row-gap">
        <button className="btn btn-primary" disabled={!p.piatto.trim()} onClick={() => onSave(p)}>
          <Icon name="check" size={16} /> Salva
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
      </div>
    </div>
  )
}

/** Suggerimento dopo un salvataggio: aggiungere i mancanti alla spesa o togliere dal frigo ciò che è finito */
function Avviso({ avviso, onSpesa, onFrigo, onClose }) {
  const [scelti, setScelti] = useState(avviso.tipo === 'frigo' ? [] : avviso.nomi)
  const toggle = (n) => setScelti((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))
  return (
    <div className="avviso">
      <p>
        {avviso.tipo === 'mancanti'
          ? 'Questi ingredienti non sono né in frigo né nella lista della spesa:'
          : 'Hai finito qualcosa? Seleziona cosa togliere dal frigo:'}
      </p>
      <div className="chips">
        {avviso.nomi.map((n) => (
          <button key={n} className={`chip ${scelti.includes(n) ? 'on' : ''}`} onClick={() => toggle(n)} aria-pressed={scelti.includes(n)}>
            {scelti.includes(n) && <Icon name="check" size={13} />} {n}
          </button>
        ))}
      </div>
      <div className="row-gap">
        {avviso.tipo === 'mancanti' ? (
          <button className="btn btn-primary btn-sm" disabled={!scelti.length} onClick={() => onSpesa(scelti)}>
            <Icon name="cart" size={15} /> Aggiungi alla spesa
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" disabled={!scelti.length} onClick={() => onFrigo(scelti)}>
            <Icon name="fridge" size={15} /> Togli dal frigo
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          No, grazie
        </button>
      </div>
    </div>
  )
}

/* ---------------- Spesa ---------------- */

function Spesa({ spesa, frigo, doFlash }) {
  const [nuovo, setNuovo] = useState({ nome: '', categoria: 'proteine', quantita: '' })
  if (!spesa.data || !frigo.data) return <Empty>Carico…</Empty>
  const articoli = spesa.data.articoli

  const salvaSpesa = (a) => spesa.save({ aggiornata: isoDate(), articoli: a })

  async function aggiungi() {
    if (!nuovo.nome.trim()) return
    if (contiene(articoli, nuovo.nome)) return doFlash('Già in lista', true)
    await salvaSpesa([...articoli, { ...nuovo, nome: nuovo.nome.trim() }])
    setNuovo({ ...nuovo, nome: '', quantita: '' })
  }

  async function preso(a) {
    // Toglie dalla spesa e mette in frigo
    await salvaSpesa(articoli.filter((x) => x !== a))
    const giaIn = frigo.data.articoli.filter((x) => norm(x.nome) !== norm(a.nome))
    await frigo.save({
      aggiornato: isoDate(),
      articoli: [...giaIn, { nome: a.nome, categoria: a.categoria, quantita: a.quantita, scadenza: null }],
    })
    doFlash(`${a.nome} spostato in frigo`)
  }

  const gruppi = [...new Set([...CATEGORIE_SPESA, ...articoli.map((a) => a.categoria)])]
    .map((c) => ({ c, items: articoli.filter((a) => a.categoria === c) }))
    .filter((g) => g.items.length)

  return (
    <>
      <Card>
        <div className="form-row">
          <label className="field grow">
            <span>Articolo</span>
            <input
              value={nuovo.nome}
              placeholder="Es. Uova"
              onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
            />
          </label>
          <label className="field">
            <span>Quantità</span>
            <input
              value={nuovo.quantita}
              placeholder="Es. 12"
              onChange={(e) => setNuovo({ ...nuovo, quantita: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
            />
          </label>
          <label className="field">
            <span>Categoria</span>
            <select value={nuovo.categoria} onChange={(e) => setNuovo({ ...nuovo, categoria: e.target.value })}>
              {CATEGORIE_SPESA.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={aggiungi}>
            <Icon name="plus" size={16} /> Aggiungi
          </button>
        </div>
      </Card>

      {!articoli.length ? (
        <Empty>Lista vuota. Aggiungi quello che ti serve oppure chiedi a Claude di prepararla.</Empty>
      ) : (
        <Card>
          <p className="muted small">Spunta un articolo quando lo compri: passa automaticamente nel frigo.</p>
          {gruppi.map((g) => (
            <div key={g.c} className="group">
              <h4 className="group-title">{g.c}</h4>
              <ul className="check-list">
                {g.items.map((a) => (
                  <li key={a.nome}>
                    <button className="check" aria-label={`Preso: ${a.nome}`} onClick={() => preso(a)}>
                      <Icon name="check" size={14} />
                    </button>
                    <span className="grow">{a.nome}</span>
                    <span className="muted">{a.quantita}</span>
                    <button
                      className="btn btn-icon"
                      aria-label={`Rimuovi ${a.nome}`}
                      onClick={() => salvaSpesa(articoli.filter((x) => x !== a))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}

/* ---------------- Frigo ---------------- */

function giorniA(scadenza) {
  if (!scadenza) return null
  const oggi = parseDate(isoDate())
  return Math.round((parseDate(scadenza) - oggi) / 86400000)
}

function Frigo({ spesa, frigo, doFlash }) {
  const [nuovo, setNuovo] = useState({ nome: '', quantita: '', scadenza: '' })
  if (!spesa.data || !frigo.data) return <Empty>Carico…</Empty>
  const articoli = [...frigo.data.articoli].sort(
    (a, b) => (a.scadenza || '9999').localeCompare(b.scadenza || '9999') || a.nome.localeCompare(b.nome),
  )

  const salvaFrigo = (a) => frigo.save({ aggiornato: isoDate(), articoli: a })

  async function aggiungi() {
    if (!nuovo.nome.trim()) return
    if (contiene(frigo.data.articoli, nuovo.nome)) return doFlash('Già in frigo', true)
    await salvaFrigo([
      ...frigo.data.articoli,
      { nome: nuovo.nome.trim(), categoria: 'altro', quantita: nuovo.quantita, scadenza: nuovo.scadenza || null },
    ])
    setNuovo({ nome: '', quantita: '', scadenza: '' })
  }

  const modifica = (a, campo, valore) =>
    salvaFrigo(frigo.data.articoli.map((x) => (x === a ? { ...x, [campo]: valore || null } : x)))

  async function finito(a, rimetti) {
    await salvaFrigo(frigo.data.articoli.filter((x) => x !== a))
    if (rimetti && !contiene(spesa.data.articoli, a.nome)) {
      await spesa.save({
        aggiornata: isoDate(),
        articoli: [...spesa.data.articoli, { nome: a.nome, categoria: a.categoria || 'altro', quantita: a.quantita || '' }],
      })
      doFlash(`${a.nome} rimesso in lista spesa`)
    }
  }

  return (
    <>
      <Card>
        <div className="form-row">
          <label className="field grow">
            <span>Cosa hai</span>
            <input
              value={nuovo.nome}
              placeholder="Es. Yogurt greco"
              onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
            />
          </label>
          <label className="field">
            <span>Quantità</span>
            <input value={nuovo.quantita} onChange={(e) => setNuovo({ ...nuovo, quantita: e.target.value })} />
          </label>
          <label className="field">
            <span>Scadenza</span>
            <input type="date" value={nuovo.scadenza} onChange={(e) => setNuovo({ ...nuovo, scadenza: e.target.value })} />
          </label>
          <button className="btn btn-primary" onClick={aggiungi}>
            <Icon name="plus" size={16} /> Aggiungi
          </button>
        </div>
      </Card>
      {!articoli.length ? (
        <Empty>Frigo vuoto. Gli articoli spuntati nella spesa arrivano qui.</Empty>
      ) : (
        <Card>
          <ul className="fridge-list">
            {articoli.map((a) => {
              const g = giorniA(a.scadenza)
              const tone = g == null ? '' : g < 0 ? 'bad' : g <= 2 ? 'warn' : 'ok'
              return (
                <li key={a.nome}>
                  <div className="grow">
                    <strong>{a.nome}</strong>
                    <div className="muted small">{a.quantita || ''}</div>
                  </div>
                  {g != null && (
                    <span className={`exp exp-${tone}`}>
                      {g < 0 ? 'scaduto' : g === 0 ? 'scade oggi' : g === 1 ? 'domani' : `${g} gg`}
                    </span>
                  )}
                  <input
                    type="date"
                    className="date-sm"
                    value={a.scadenza || ''}
                    aria-label={`Scadenza ${a.nome}`}
                    onChange={(e) => modifica(a, 'scadenza', e.target.value)}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() => finito(a, true)} title="Finito, rimetti in lista">
                    <Icon name="cart" size={15} />
                  </button>
                  <button className="btn btn-icon" onClick={() => finito(a, false)} aria-label={`Finito: ${a.nome}`}>
                    <Icon name="trash" size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </>
  )
}
