import { useState } from 'react'
import { useJson } from '../api.js'
import { Card, Empty, ErrorBanner, Icon, PageHeader, Tabs, useFlash } from '../components/ui.jsx'
import { CATEGORIE_SPESA } from '../defaults.js'
import { useFrigo, usePianiList, useSpesa } from '../hooks.js'
import { navigate } from '../nav.js'
import { ChiediClaude } from './Claude.jsx'
import { isoDate, parseDate, weekdayName } from '../utils.js'

const norm = (s) => s.toLowerCase().trim()
const contiene = (lista, nome) => lista.some((a) => norm(a.nome) === norm(nome))

export default function Cibo({ params }) {
  const [tab, setTab] = useState(params.tab || 'piano')
  const spesa = useSpesa()
  const frigo = useFrigo()
  const [flash, doFlash] = useFlash()

  const ctx = { spesa, frigo, doFlash }
  return (
    <div className="page">
      <PageHeader title="Cibo" subtitle="Piano della settimana, lista della spesa e frigo" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'piano', label: 'Piano pasti', icon: 'calendar' },
          { id: 'spesa', label: 'Spesa', icon: 'cart', badge: spesa.data?.articoli.length || null },
          { id: 'frigo', label: 'Frigo', icon: 'fridge', badge: frigo.data?.articoli.length || null },
        ]}
      />
      <ChiediClaude ids={['settimana-cibo', 'piano-pasti', 'spesa']} />
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
  const { files, suggested } = usePianiList()
  const [scelto, setScelto] = useState(null)
  const file = scelto || suggested
  const { data: piano } = useJson(file ? `piani-pasti/${file}` : null, null)
  const oggi = weekdayName()
  const [aperto, setAperto] = useState(oggi)

  async function aggiungiExtra(item) {
    const nome = typeof item === 'string' ? item : item.nome
    if (contiene(spesa.data.articoli, nome)) return doFlash(`${nome} è già in lista`)
    await spesa.save({
      aggiornata: isoDate(),
      articoli: [
        ...spesa.data.articoli,
        { nome, categoria: item.categoria || 'altro', quantita: item.quantita || '' },
      ],
    })
    doFlash(`${nome} aggiunto alla spesa`)
  }

  const inFrigo = (n) => frigo.data && contiene(frigo.data.articoli, n)
  const inSpesa = (n) => spesa.data && contiene(spesa.data.articoli, n)

  return (
    <>
      <Card className="card-accent">
        <div className="plan-head">
          <div>
            <h2>Nuovo piano con Claude</h2>
            <p className="muted small">
              I piatti li propone Claude leggendo spesa, frigo e profilo. Prepara la richiesta e incollala in Cowork: il
              piano comparirà qui da solo.
            </p>
          </div>
          <button className="btn" onClick={() => navigate('claude', { t: 'piano-pasti' })}>
            <Icon name="chat" size={16} /> Prepara richiesta
          </button>
        </div>
      </Card>

      {files && files.length > 1 && (
        <label className="field inline">
          <span>Settimana</span>
          <select value={file || ''} onChange={(e) => setScelto(e.target.value)}>
            {files.map((f) => (
              <option key={f} value={f}>
                {f.replace('.json', '')}
              </option>
            ))}
          </select>
        </label>
      )}

      {!piano ? (
        <Empty>{files && !files.length ? 'Nessun piano ancora.' : 'Carico il piano…'}</Empty>
      ) : (
        <>
          <p className="muted small">
            Settimana {piano.settimana}
            {piano.kcal_giorno_indicative ? ` · ~${piano.kcal_giorno_indicative} kcal al giorno` : ''}
            {/esempio/i.test(file) && ' · file di esempio'}
          </p>
          <div className="days">
            {piano.giorni.map((g) => {
              const open = aperto === g.giorno
              return (
                <Card key={g.giorno} className={`day ${g.giorno === oggi ? 'is-today' : ''}`}>
                  <button className="history-head" onClick={() => setAperto(open ? null : g.giorno)} aria-expanded={open}>
                    <div>
                      <strong className="cap">{g.giorno}</strong>
                      {g.giorno === oggi && <span className="pill">oggi</span>}
                      <div className="muted small">{g.pasti.map((p) => p.piatto).join(' · ')}</div>
                    </div>
                    <span className={`chev ${open ? 'open' : ''}`}>
                      <Icon name="chevron" />
                    </span>
                  </button>
                  {open && (
                    <div className="meals">
                      {g.pasti.map((p, i) => (
                        <div className="meal" key={i}>
                          <div className="meal-title">
                            <span className="meal-type">{p.tipo}</span>
                            <h3>{p.piatto}</h3>
                          </div>
                          <ul className="ingredients">
                            {p.ingredienti.map((ing) => (
                              <li key={ing.nome}>
                                <span
                                  className={`stock ${inFrigo(ing.nome) ? 'ok' : inSpesa(ing.nome) ? 'buy' : 'miss'}`}
                                  title={
                                    inFrigo(ing.nome) ? 'In frigo' : inSpesa(ing.nome) ? 'In lista spesa' : 'Non in lista'
                                  }
                                >
                                  {inFrigo(ing.nome) ? 'frigo' : inSpesa(ing.nome) ? 'spesa' : '—'}
                                </span>
                                <span>{ing.nome}</span>
                                <span className="muted">{ing.porzione}</span>
                              </li>
                            ))}
                          </ul>
                          {p.ricetta && (
                            <ol className="recipe">
                              {(Array.isArray(p.ricetta) ? p.ricetta : [p.ricetta]).map((r, j) => (
                                <li key={j}>{r}</li>
                              ))}
                            </ol>
                          )}
                          {p.note && <p className="note">{p.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
          {piano.da_comprare_extra?.length > 0 && (
            <Card title="Da comprare in più">
              <ul className="plain-list">
                {piano.da_comprare_extra.map((it, i) => {
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
