import { useEffect, useId, useMemo, useState } from 'react'
import { readJson, saveFile, useJson } from '../api.js'
import { Card, Empty, ErrorBanner, Icon, PageHeader, useFlash } from '../components/ui.jsx'
import { useFrigo, useImpostazioni, usePianiList, useSpesa } from '../hooks.js'
import { navigate } from '../nav.js'
import { ChiediClaude } from './Claude.jsx'
import { copiaTesto, puoCondividere } from '../clipboard.js'
import { TIPI_PASTO, conTuttiIGiorni, ordinaPasti, pianoVuoto, pulisciPasto, ricettario } from '../piano.js'
import {
  CATEGORIE,
  SEMPRE_IN_CASA_DEFAULT,
  aggiornaSpesa,
  categoriaAuto,
  chiave,
  compra,
  consumaPasto,
  doveAuto,
  doveDi,
  finito,
  giorniAllaScadenza,
  giorniDaConsiderare,
  ingredientiNecessari,
  nomiIngredienti,
  raggruppaPerReparto,
  ripristinaPasto,
  statoIngrediente,
  trova,
  testoSpesa,
} from '../cibo.js'
import { etichettaSettimana, isoDate, isoWeek, weekdayName } from '../utils.js'

const elenco = (nomi) => nomi.join(', ')
const scadenzaTesto = (g) => (g < 0 ? 'scaduto' : g === 0 ? 'scade oggi' : g === 1 ? 'domani' : `${g} gg`)
const scadenzaTono = (g) => (g == null ? '' : g < 0 ? 'bad' : g <= 2 ? 'warn' : 'ok')

/**
 * Pagina Cibo: piano della settimana, spesa, frigo e dispensa visibili insieme.
 * Desktop: piano a sinistra, liste a destra. Telefono: oggi → liste → resto della settimana.
 * Le regole che tengono allineati piano, spesa e casa sono in src/cibo.js.
 */
export default function Cibo({ params }) {
  const spesa = useSpesa()
  const frigo = useFrigo()
  const { data: imp, save: salvaImp } = useImpostazioni()
  const { files, suggested, current, reload: reloadList } = usePianiList()
  const [scelto, setScelto] = useState(null)
  const file = scelto || suggested
  const piano = useJson(file ? `piani-pasti/${file}` : null, null)
  const ricette = useRicettario(files)
  const [flash, doFlash] = useFlash()

  const sempre = imp?.sempre_in_casa ?? SEMPRE_IN_CASA_DEFAULT
  const casa = frigo.data?.articoli || []
  const articoliSpesa = spesa.data?.articoli || []
  const nomi = useMemo(
    () => nomiIngredienti({ casa, spesa: articoliSpesa, sempre, ricette }),
    [casa, articoliSpesa, sempre, ricette],
  )

  // Arrivando da un link (#/cibo?tab=spesa) si scorre alla sezione
  useEffect(() => {
    if (!params.tab || !spesa.data || !frigo.data) return
    const id = { spesa: 'sez-spesa', frigo: 'sez-casa', dispensa: 'sez-casa', piano: 'sez-oggi' }[params.tab]
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!spesa.data, !!frigo.data])

  /**
   * Salva insieme piano, spesa e casa (solo quelli cambiati) e mostra un messaggio con "Annulla",
   * che rimette i tre file com'erano prima.
   */
  async function applica({ nuovoPiano, nuovaSpesa, nuovaCasa, messaggio }) {
    const prima = { piano: piano.data, spesa: spesa.data, frigo: frigo.data }
    const fatti = []
    try {
      if (nuovoPiano) await piano.save(nuovoPiano).then(() => fatti.push('piano'))
      if (nuovaSpesa && nuovaSpesa !== spesa.data) await spesa.save(nuovaSpesa).then(() => fatti.push('spesa'))
      if (nuovaCasa) await frigo.save({ aggiornato: isoDate(), articoli: nuovaCasa }).then(() => fatti.push('frigo'))
    } catch {
      return doFlash('Salvataggio non riuscito: riprova', true)
    }
    doFlash(messaggio, false, {
      label: 'Annulla',
      fn: async () => {
        try {
          if (fatti.includes('piano')) await piano.save(prima.piano)
          if (fatti.includes('spesa')) await spesa.save(prima.spesa)
          if (fatti.includes('frigo')) await frigo.save(prima.frigo)
          doFlash('Annullato')
        } catch {
          doFlash('Non sono riuscito ad annullare', true)
        }
      },
    })
  }

  /** Piano con un giorno modificato da fn(pasti); nel file si tengono solo i giorni con almeno un pasto */
  function pianoCon(giorno, fn) {
    const base = conTuttiIGiorni(piano.data)
    const giorni = base.giorni.map((g) => (g.giorno === giorno ? { ...g, pasti: ordinaPasti(fn(g.pasti)) } : g))
    return { ...base, giorni: giorni.filter((g) => g.pasti.length) }
  }

  const spesaDopo = (nuovoPiano, aggiungiDa, nuovaCasa = casa) =>
    aggiornaSpesa({ piano: nuovoPiano, casa: nuovaCasa, spesa: spesa.data, sempre, aggiungiDa })

  const riassuntoSpesa = ({ aggiunti, tolti }) =>
    [aggiunti.length && `in spesa: ${elenco(aggiunti)}`, tolti.length && `tolti dalla spesa: ${elenco(tolti)}`]
      .filter(Boolean)
      .join(' · ')

  const azioni = {
    async salvaPasto(giorno, indice, pasto) {
      const pulito = pulisciPasto(pasto)
      const nuovoPiano = pianoCon(giorno, (pasti) =>
        indice == null ? [...pasti, pulito] : pasti.map((p, i) => (i === indice ? { ...p, ...pulito } : p)),
      )
      const r = spesaDopo(nuovoPiano, [pulito])
      await applica({ nuovoPiano, nuovaSpesa: r.spesa, messaggio: ['Pasto salvato', riassuntoSpesa(r)].filter(Boolean).join(' · ') })
    },
    async eliminaPasto(giorno, indice) {
      const nuovoPiano = pianoCon(giorno, (pasti) => pasti.filter((_, i) => i !== indice))
      const r = spesaDopo(nuovoPiano, [])
      await applica({ nuovoPiano, nuovaSpesa: r.spesa, messaggio: ['Pasto eliminato', riassuntoSpesa(r)].filter(Boolean).join(' · ') })
    },
    async segnaFatto(giorno, indice, pasto) {
      if (!pasto.fatto) {
        const c = consumaPasto(pasto, casa)
        const nuovoPiano = pianoCon(giorno, (pasti) => pasti.map((p, i) => (i === indice ? c.pasto : p)))
        const r = spesaDopo(nuovoPiano, [], c.casa)
        const msg = ['Mangiato', c.tolti.length ? `tolti dal frigo: ${elenco(c.tolti)}` : null, r.tolti.length ? `tolti dalla spesa: ${elenco(r.tolti)}` : null]
        await applica({ nuovoPiano, nuovaSpesa: r.spesa, nuovaCasa: c.tolti.length ? c.casa : null, messaggio: msg.filter(Boolean).join(' · ') })
      } else {
        const rp = ripristinaPasto(pasto, casa)
        const nuovoPiano = pianoCon(giorno, (pasti) => pasti.map((p, i) => (i === indice ? rp.pasto : p)))
        await applica({
          nuovoPiano,
          nuovaCasa: rp.rientrati.length ? rp.casa : null,
          messaggio: ['Non ancora mangiato', rp.rientrati.length ? `di nuovo in frigo: ${elenco(rp.rientrati)}` : null].filter(Boolean).join(' · '),
        })
      }
    },
    async spesaSettimana() {
      const r = aggiornaSpesa({ piano: piano.data, casa, spesa: spesa.data, sempre, aggiungiDa: 'tutti' })
      if (!r.aggiunti.length && !r.tolti.length) return doFlash('La spesa è già completa per i pasti della settimana')
      await applica({ nuovaSpesa: r.spesa, messaggio: riassuntoSpesa(r) })
    },
    async aggiungiExtra(item) {
      const nome = typeof item === 'string' ? item : item.nome
      if (trova(articoliSpesa, nome)) return doFlash(`${nome} è già in lista`)
      const nuovaSpesa = {
        aggiornata: isoDate(),
        articoli: [...articoliSpesa, { nome, categoria: item.categoria || categoriaAuto(nome), quantita: item.quantita || '' }],
      }
      await applica({ nuovaSpesa, messaggio: `${nome} in spesa` })
    },
    async creaSettimana() {
      const settimana = isoWeek()
      await saveFile(`piani-pasti/${settimana}.json`, pianoVuoto(settimana, imp?.target?.kcal ?? null))
      await reloadList()
      setScelto(`${settimana}.json`)
      doFlash(`Piano ${etichettaSettimana(settimana)} creato`)
    },
    // --- spesa
    async aggiungiSpesa(art) {
      if (trova(articoliSpesa, art.nome)) return doFlash('Già in lista', true)
      await applica({ nuovaSpesa: { aggiornata: isoDate(), articoli: [...articoliSpesa, art] }, messaggio: `${art.nome} in spesa` })
    },
    async comprato(art) {
      const r = compra(art, spesa.data, casa)
      await applica({ nuovaSpesa: r.spesa, nuovaCasa: r.casa, messaggio: `${art.nome} → ${r.dove}` })
    },
    async togliSpesa(art) {
      await applica({ nuovaSpesa: { aggiornata: isoDate(), articoli: articoliSpesa.filter((x) => x !== art) }, messaggio: `${art.nome} tolto dalla spesa` })
    },
    // --- frigo e dispensa
    async aggiungiCasa(art) {
      if (trova(casa, art.nome)) return doFlash(`${art.nome} c'è già`, true)
      await applica({ nuovaCasa: [...casa, art], messaggio: `${art.nome} → ${art.dove}` })
    },
    async modificaCasa(art, campi) {
      await frigo.save({ aggiornato: isoDate(), articoli: casa.map((x) => (x === art ? { ...x, ...campi } : x)) })
    },
    async sposta(art) {
      const dove = doveDi(art) === 'frigo' ? 'dispensa' : 'frigo'
      await applica({ nuovaCasa: casa.map((x) => (x === art ? { ...x, dove } : x)), messaggio: `${art.nome} → ${dove}` })
    },
    async finito(art, ricompra) {
      const r = finito(art, casa, spesa.data, ricompra)
      await applica({ nuovaCasa: r.casa, nuovaSpesa: r.spesa, messaggio: ricompra ? `${art.nome} finito · di nuovo in spesa` : `${art.nome} finito` })
    },
    avvisa: doFlash,
    async salvaSempre(lista) {
      await salvaImp({ ...imp, sempre_in_casa: lista })
    },
  }

  const nFrigo = casa.filter((a) => doveDi(a) === 'frigo').length
  const nDispensa = casa.length - nFrigo

  return (
    <div className="page">
      <PageHeader
        title="Cibo"
        subtitle="Piano della settimana, spesa, frigo e dispensa"
        action={<ChiediClaude ids={['settimana-cibo', 'piano-pasti', 'spesa']} />}
      />
      <ErrorBanner error={spesa.error || frigo.error || piano.error} />
      <nav className="cibo-salti" aria-label="Vai a">
        <a href="#sez-oggi" onClick={salta('sez-oggi')}>
          <Icon name="calendar" size={15} /> Piano
        </a>
        <a href="#sez-spesa" onClick={salta('sez-spesa')}>
          <Icon name="cart" size={15} /> Spesa <strong>{articoliSpesa.length}</strong>
        </a>
        <a href="#sez-casa" onClick={salta('sez-casa')}>
          <Icon name="fridge" size={15} /> Frigo <strong>{nFrigo}</strong> · Dispensa <strong>{nDispensa}</strong>
        </a>
      </nav>

      <datalist id="nomi-ingredienti">
        {nomi.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <Piano
        piano={piano.data}
        caricato={!piano.loading || !file}
        files={files}
        file={file}
        current={current}
        setScelto={setScelto}
        ricette={ricette}
        ctx={{ casa, spesa: articoliSpesa, sempre }}
        azioni={azioni}
        liste={
          <aside className="cibo-liste">
            <Spesa articoli={articoliSpesa} piano={piano.data} ctx={{ casa, sempre }} caricata={!!spesa.data} azioni={azioni} haPiano={!!piano.data} />
            <Casa articoli={casa} caricata={!!frigo.data} sempre={sempre} azioni={azioni} />
          </aside>
        }
      />
      {flash}
    </div>
  )
}

const salta = (id) => (e) => {
  e.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ---------------- Piano pasti ---------------- */

function Piano({ piano, caricato, files, file, current, setScelto, ricette, ctx, azioni, liste }) {
  const oggi = weekdayName()
  const dati = piano ? conTuttiIGiorni(piano) : null
  const settimanaCorrente = dati?.settimana === isoWeek()
  const giornoOggi = settimanaCorrente ? dati.giorni.find((g) => g.giorno === oggi) : null
  const altri = dati ? dati.giorni.filter((g) => g !== giornoOggi) : []
  const daFare = dati ? giorniDaConsiderare(dati) : []
  const [aperti, setAperti] = useState(() => new Set())
  const isEsempio = /esempio/i.test(file || '')

  const testa = (
    <div className="piano-testa">
      <div className="grow">
        <h2>Piano pasti</h2>
        {dati && (
          <p className="muted small">
            {etichettaSettimana(dati.settimana)}
            {dati.kcal_giorno_indicative ? ` · ~${dati.kcal_giorno_indicative} kcal al giorno` : ''}
            {isEsempio && ' · file di esempio'}
          </p>
        )}
      </div>
      {files && files.length > 1 && (
        <select className="select-sm" value={file || ''} onChange={(e) => setScelto(e.target.value)} aria-label="Settimana">
          {files.map((f) => (
            <option key={f} value={f}>
              {etichettaSettimana(f)}
              {/esempio/i.test(f) ? ' (esempio)' : f.includes(isoWeek()) ? ' (questa)' : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )

  const giornoCard = (g, sempreAperto = false) => (
    <GiornoCard
      key={g.giorno}
      g={g}
      oggi={g.giorno === oggi && settimanaCorrente}
      passato={!daFare.includes(g.giorno)}
      aperto={sempreAperto || aperti.has(g.giorno)}
      toggle={
        sempreAperto
          ? null
          : () =>
              setAperti((s) => {
                const n = new Set(s)
                n.has(g.giorno) ? n.delete(g.giorno) : n.add(g.giorno)
                return n
              })
      }
      ricette={ricette}
      ctx={ctx}
      azioni={azioni}
    />
  )

  return (
    <div className="cibo-layout">
      <section className="cibo-oggi" id="sez-oggi">
        {testa}
        {files && !current && (
          <Card className="card-accent">
            <div className="plan-head">
              <div>
                <h3>Nessun piano per questa settimana ({etichettaSettimana(isoWeek())})</h3>
                <p className="muted small">Crealo vuoto e riempilo tu, oppure fattelo proporre da Claude.</p>
              </div>
              <div className="row-gap">
                <button className="btn btn-primary" onClick={azioni.creaSettimana}>
                  <Icon name="plus" size={16} /> Crea piano vuoto
                </button>
                <button className="btn" onClick={() => navigate('claude', { t: 'piano-pasti' })}>
                  <Icon name="chat" size={16} /> Chiedi a Claude
                </button>
              </div>
            </div>
          </Card>
        )}
        {!dati ? (
          <Empty>{files && !files.length ? 'Nessun piano ancora.' : caricato ? 'Nessun piano.' : 'Carico il piano…'}</Empty>
        ) : giornoOggi ? (
          giornoCard(giornoOggi, true)
        ) : null}
      </section>

      {liste}

      <section className="cibo-settimana">
        {dati && (
          <>
            {altri.length > 0 && <h3 className="group-title">{giornoOggi ? 'Resto della settimana' : 'Giorni'}</h3>}
            <div className="days">{altri.map((g) => giornoCard(g))}</div>
            {dati.da_comprare_extra?.length > 0 && (
              <Card title="Suggeriti da Claude">
                <ul className="plain-list">
                  {dati.da_comprare_extra.map((it, i) => {
                    const nome = typeof it === 'string' ? it : it.nome
                    return (
                      <li key={i} className="row-between">
                        <span>
                          {nome}
                          {it.motivo && <span className="muted small"> · {it.motivo}</span>}
                        </span>
                        {trova(ctx.spesa, nome) ? (
                          <span className="muted small">in lista</span>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => azioni.aggiungiExtra(it)}>
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
      </section>
    </div>
  )
}

function GiornoCard({ g, oggi, passato, aperto, toggle, ricette, ctx, azioni }) {
  const [modifica, setModifica] = useState(null) // indice del pasto, 'nuovo' o null
  const fatti = g.pasti.filter((p) => p.fatto).length
  const titolo = (
    <div>
      <strong className="cap">{g.giorno}</strong>
      {oggi && <span className="pill">oggi</span>}
      {g.pasti.length > 0 && fatti === g.pasti.length && <span className="pill pill-done">fatto</span>}
      {!aperto && <div className="muted small">{g.pasti.length ? g.pasti.map((p) => p.piatto).join(' · ') : 'nessun pasto'}</div>}
    </div>
  )
  return (
    <Card className={`day ${oggi ? 'is-today' : ''} ${passato && !oggi ? 'is-past' : ''}`}>
      {toggle ? (
        <button className="history-head" onClick={toggle} aria-expanded={aperto}>
          {titolo}
          <span className={`chev ${aperto ? 'open' : ''}`}>
            <Icon name="chevron" />
          </span>
        </button>
      ) : (
        <div className="history-head">{titolo}</div>
      )}
      {aperto && (
        <div className="meals">
          {g.pasti.map((p, i) =>
            modifica === i ? (
              <PastoEditor
                key={i}
                iniziale={p}
                ricette={ricette}
                ctx={ctx}
                onSave={(x) => azioni.salvaPasto(g.giorno, i, x).then(() => setModifica(null))}
                onCancel={() => setModifica(null)}
              />
            ) : (
              <PastoView
                key={i}
                pasto={p}
                ctx={ctx}
                onFatto={() => azioni.segnaFatto(g.giorno, i, p)}
                onEdit={() => setModifica(i)}
                onDelete={() => azioni.eliminaPasto(g.giorno, i)}
              />
            ),
          )}
          {modifica === 'nuovo' && (
            <PastoEditor
              iniziale={{ tipo: g.pasti.some((p) => p.tipo === 'pranzo') ? 'cena' : 'pranzo', piatto: '', ingredienti: [], ricetta: [], note: '' }}
              ricette={ricette}
              ctx={ctx}
              nuovo
              onSave={(x) => azioni.salvaPasto(g.giorno, null, x).then(() => setModifica(null))}
              onCancel={() => setModifica(null)}
            />
          )}
          {modifica == null && (
            <button className="btn btn-ghost add-meal" onClick={() => setModifica('nuovo')}>
              <Icon name="plus" size={16} /> Aggiungi pasto
            </button>
          )}
        </div>
      )}
    </Card>
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

const ETICHETTA_STATO = {
  frigo: { testo: 'frigo', classe: 'ok', titolo: 'In frigo' },
  dispensa: { testo: 'dispensa', classe: 'ok', titolo: 'In dispensa' },
  sempre: { testo: 'sempre', classe: 'sempre', titolo: 'Sempre in casa' },
  spesa: { testo: 'spesa', classe: 'buy', titolo: 'Nella lista della spesa' },
  manca: { testo: 'manca', classe: 'miss', titolo: 'Non in casa e non in lista' },
}

function PastoView({ pasto: p, ctx, onFatto, onEdit, onDelete }) {
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
            title={p.fatto ? 'Segna come non mangiato: quello che era stato tolto torna in frigo' : 'Segna come mangiato: gli ingredienti escono dal frigo'}
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
          {p.ingredienti.map((ing, k) => {
            // Per un pasto già mangiato conta quello che è stato consumato, non lo stato attuale
            const consumato = p.fatto && trova(p.consumati || [], ing.nome)
            const stato = consumato ? 'frigo' : statoIngrediente(ing.nome, ctx)
            const e = ETICHETTA_STATO[stato]
            const art = trova(ctx.casa, ing.nome)
            const g = !p.fatto && art ? giorniAllaScadenza(art.scadenza) : null
            return (
              <li key={k}>
                <span className={`stock ${e.classe}`} title={consumato ? 'Preso dal frigo' : e.titolo}>
                  {consumato ? 'usato' : e.testo}
                </span>
                <span>
                  {ing.nome}
                  {g != null && g <= 2 && <span className={`exp exp-${scadenzaTono(g)} exp-inline`}>{scadenzaTesto(g)}</span>}
                </span>
                <span className="muted">{ing.porzione}</span>
              </li>
            )
          })}
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

function PastoEditor({ iniziale, ricette, ctx, nuovo, onSave, onCancel }) {
  const [p, setP] = useState(() => ({
    ...iniziale,
    ingredienti: iniziale.ingredienti?.length ? iniziale.ingredienti.map((i) => ({ ...i })) : [{ nome: '', porzione: '' }],
    ricetta: (Array.isArray(iniziale.ricetta) ? iniziale.ricetta : iniziale.ricetta ? [iniziale.ricetta] : []).join('\n'),
  }))
  const [salvando, setSalvando] = useState(false)
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const setIng = (i, k, v) => setP((x) => ({ ...x, ingredienti: x.ingredienti.map((ing, j) => (j === i ? { ...ing, [k]: v } : ing)) }))

  function daRicettario(nome) {
    const r = ricette.find((x) => x.piatto === nome)
    if (!r) return
    setP((x) => ({ ...x, piatto: r.piatto, ingredienti: r.ingredienti.map((i) => ({ ...i })), ricetta: r.ricetta.join('\n') }))
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
        <span>Ingredienti · quello che non hai in casa va da solo nella spesa</span>
        {p.ingredienti.map((ing, i) => {
          const stato = ing.nome.trim() ? statoIngrediente(ing.nome, ctx) : null
          return (
            <div className="ing-row" key={i}>
              <input
                value={ing.nome}
                list="nomi-ingredienti"
                placeholder="Ingrediente"
                aria-label={`Ingrediente ${i + 1}`}
                onChange={(e) => setIng(i, 'nome', e.target.value)}
              />
              <input value={ing.porzione} placeholder="Porzione" aria-label={`Porzione ${i + 1}`} onChange={(e) => setIng(i, 'porzione', e.target.value)} />
              <button className="btn btn-icon" aria-label={`Rimuovi ingrediente ${i + 1}`} onClick={() => set('ingredienti', p.ingredienti.filter((_, j) => j !== i))}>
                <Icon name="trash" size={15} />
              </button>
              {stato && (
                <span className={`stock ${ETICHETTA_STATO[stato].classe} ing-stato`} title={ETICHETTA_STATO[stato].titolo}>
                  {stato === 'manca' ? '→ spesa' : ETICHETTA_STATO[stato].testo}
                </span>
              )}
            </div>
          )
        })}
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
        <button
          className="btn btn-primary"
          disabled={!p.piatto.trim() || salvando}
          onClick={async () => {
            setSalvando(true)
            try {
              await onSave(p)
            } finally {
              setSalvando(false)
            }
          }}
        >
          <Icon name="check" size={16} /> Salva
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Annulla
        </button>
      </div>
    </div>
  )
}

/* ---------------- Spesa ---------------- */

function Spesa({ articoli, piano, ctx, caricata, azioni, haPiano }) {
  const [nuovo, setNuovo] = useState({ nome: '', quantita: '', categoria: '' })
  const per = useMemo(() => (piano ? ingredientiNecessari(piano, ctx) : new Map()), [piano, ctx])
  if (!caricata) return <Card title="Spesa">Carico…</Card>
  const gruppi = raggruppaPerReparto(articoli)
  const catAuto = nuovo.nome.trim() ? categoriaAuto(nuovo.nome) : null

  async function aggiungi() {
    const nome = nuovo.nome.trim()
    if (!nome) return
    await azioni.aggiungiSpesa({ nome, categoria: nuovo.categoria || categoriaAuto(nome), quantita: nuovo.quantita.trim() })
    setNuovo({ nome: '', quantita: '', categoria: '' })
  }
  async function copia() {
    try {
      await copiaTesto(testoSpesa(articoli))
      azioni.avvisa('Lista copiata: incollala dove vuoi')
    } catch {
      azioni.avvisa('Copia non riuscita', true)
    }
  }

  return (
    <Card title={`Spesa · ${articoli.length}`} className="lista-card" >
      <div id="sez-spesa" className="ancora" />
      <div className="lista-add">
        <input
          value={nuovo.nome}
          list="nomi-ingredienti"
          placeholder="Aggiungi alla spesa…"
          aria-label="Articolo da comprare"
          onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
        />
        <input
          className="lista-qta"
          value={nuovo.quantita}
          placeholder="Q.tà"
          aria-label="Quantità"
          onChange={(e) => setNuovo({ ...nuovo, quantita: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
        />
        <button className="btn btn-primary btn-icon-text" onClick={aggiungi} aria-label="Aggiungi alla spesa">
          <Icon name="plus" size={16} />
        </button>
      </div>
      {nuovo.nome.trim() && (
        <label className="lista-cat muted small">
          Reparto:{' '}
          <select className="select-sm" value={nuovo.categoria || catAuto} onChange={(e) => setNuovo({ ...nuovo, categoria: e.target.value })}>
            {CATEGORIE.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}

      {!articoli.length ? (
        <p className="muted small lista-vuota">Lista vuota. Gli ingredienti che mancano ai pasti arrivano qui da soli.</p>
      ) : (
        gruppi.map((g) => (
          <div key={g.categoria} className="group">
            <h4 className="group-title">{g.categoria}</h4>
            <ul className="check-list">
              {g.articoli.map((a) => {
                const serve = per.get(chiave(a.nome))
                return (
                  <li key={a.nome}>
                    <button className="check" aria-label={`Comprato: ${a.nome}`} title="Comprato: va in frigo o in dispensa" onClick={() => azioni.comprato(a)}>
                      <Icon name="check" size={14} />
                    </button>
                    <span className="grow">
                      {a.nome}
                      {a.quantita && <span className="muted"> · {a.quantita}</span>}
                      {serve && <span className="per">per {serve.per.slice(0, 2).join(', ')}{serve.per.length > 2 ? '…' : ''}</span>}
                    </span>
                    <button className="btn btn-icon" aria-label={`Togli ${a.nome} dalla spesa`} onClick={() => azioni.togliSpesa(a)}>
                      <Icon name="trash" size={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
      <div className="lista-azioni">
        {haPiano && (
          <button className="btn btn-sm" onClick={azioni.spesaSettimana} title="Aggiunge tutto quello che manca ai pasti ancora da mangiare">
            <Icon name="cart" size={15} /> Spesa della settimana
          </button>
        )}
        {articoli.length > 0 && (
          <button className="btn btn-sm btn-ghost" onClick={copia}>
            <Icon name="copy" size={15} /> Copia lista
          </button>
        )}
        {articoli.length > 0 && puoCondividere() && (
          <button className="btn btn-sm btn-ghost" onClick={() => navigator.share({ text: testoSpesa(articoli) }).catch(() => {})}>
            Condividi
          </button>
        )}
      </div>
    </Card>
  )
}

/* ---------------- Frigo e dispensa ---------------- */

function Casa({ articoli, caricata, sempre, azioni }) {
  const [nuovo, setNuovo] = useState({ nome: '', quantita: '', dove: '', scadenza: '' })
  if (!caricata) return <Card title="Frigo e dispensa">Carico…</Card>
  const ordina = (l) =>
    [...l].sort((a, b) => (a.scadenza || '9999').localeCompare(b.scadenza || '9999') || a.nome.localeCompare(b.nome, 'it'))
  const frigo = ordina(articoli.filter((a) => doveDi(a) === 'frigo'))
  const dispensa = ordina(articoli.filter((a) => doveDi(a) === 'dispensa'))
  const doveProposto = nuovo.nome.trim() ? doveAuto(nuovo.nome) : 'frigo'

  async function aggiungi() {
    const nome = nuovo.nome.trim()
    if (!nome) return
    await azioni.aggiungiCasa({
      nome,
      categoria: categoriaAuto(nome),
      quantita: nuovo.quantita.trim(),
      scadenza: nuovo.scadenza || null,
      dove: nuovo.dove || doveAuto(nome),
    })
    setNuovo({ nome: '', quantita: '', dove: '', scadenza: '' })
  }

  const lista = (l, vuota) =>
    !l.length ? (
      <p className="muted small lista-vuota">{vuota}</p>
    ) : (
      <ul className="fridge-list">
        {l.map((a) => {
          const g = giorniAllaScadenza(a.scadenza)
          return (
            <li key={a.nome}>
              <div className="grow">
                <span>{a.nome}</span>
                {a.quantita && <span className="muted small"> · {a.quantita}</span>}
                {g != null && <span className={`exp exp-${scadenzaTono(g)} exp-inline`}>{scadenzaTesto(g)}</span>}
              </div>
              <input
                type="date"
                className="date-sm"
                value={a.scadenza || ''}
                aria-label={`Scadenza ${a.nome}`}
                onChange={(e) => azioni.modificaCasa(a, { scadenza: e.target.value || null })}
              />
              <button
                className="btn btn-icon"
                onClick={() => azioni.sposta(a)}
                aria-label={doveDi(a) === 'frigo' ? `Sposta ${a.nome} in dispensa` : `Sposta ${a.nome} in frigo`}
                title={doveDi(a) === 'frigo' ? 'Sposta in dispensa' : 'Sposta in frigo'}
              >
                <Icon name="swap" size={15} />
              </button>
              <button className="btn btn-icon" onClick={() => azioni.finito(a, true)} aria-label={`${a.nome} finito, ricompra`} title="Finito: rimetti in spesa">
                <Icon name="cart" size={15} />
              </button>
              <button className="btn btn-icon" onClick={() => azioni.finito(a, false)} aria-label={`${a.nome} finito`} title="Finito">
                <Icon name="trash" size={15} />
              </button>
            </li>
          )
        })}
      </ul>
    )

  return (
    <Card title="In casa" className="lista-card">
      <div id="sez-casa" className="ancora" />
      <div className="lista-add">
        <input
          value={nuovo.nome}
          list="nomi-ingredienti"
          placeholder="Cosa hai in casa…"
          aria-label="Articolo in casa"
          onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
        />
        <input
          className="lista-qta"
          value={nuovo.quantita}
          placeholder="Q.tà"
          aria-label="Quantità in casa"
          onChange={(e) => setNuovo({ ...nuovo, quantita: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && aggiungi()}
        />
        <button className="btn btn-primary btn-icon-text" onClick={aggiungi} aria-label="Aggiungi in casa">
          <Icon name="plus" size={16} />
        </button>
      </div>
      {nuovo.nome.trim() && (
        <div className="lista-cat muted small">
          <label>
            In{' '}
            <select className="select-sm" value={nuovo.dove || doveProposto} onChange={(e) => setNuovo({ ...nuovo, dove: e.target.value })}>
              <option value="frigo">frigo</option>
              <option value="dispensa">dispensa</option>
            </select>
          </label>
          <label>
            scade{' '}
            <input type="date" className="date-sm" value={nuovo.scadenza} onChange={(e) => setNuovo({ ...nuovo, scadenza: e.target.value })} />
          </label>
        </div>
      )}

      <h4 className="group-title">Frigo · {frigo.length}</h4>
      {lista(frigo, 'Frigo vuoto. Quello che compri arriva qui.')}
      <h4 className="group-title">Dispensa · {dispensa.length}</h4>
      {lista(dispensa, 'Dispensa vuota: pasta, riso, scatolame e condimenti finiscono qui.')}
      <SempreInCasa lista={sempre} onSave={azioni.salvaSempre} />
    </Card>
  )
}

function SempreInCasa({ lista, onSave }) {
  const [aperto, setAperto] = useState(false)
  const [nuovo, setNuovo] = useState('')
  const id = useId()
  return (
    <div className="sempre">
      <button className="btn btn-link" onClick={() => setAperto(!aperto)} aria-expanded={aperto} aria-controls={id}>
        Sempre in casa ({lista.length}) {aperto ? '▴' : '▾'}
      </button>
      {aperto && (
        <div id={id}>
          <p className="muted small">Non finiscono mai in spesa da soli: «Olio» vale anche per «Olio extravergine».</p>
          <div className="chips">
            {lista.map((n) => (
              <span key={n} className="chip on">
                {n}
                <button className="chip-x" aria-label={`Togli ${n}`} onClick={() => onSave(lista.filter((x) => x !== n))}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="lista-add">
            <input
              value={nuovo}
              placeholder="Es. Spezie"
              aria-label="Aggiungi a sempre in casa"
              onChange={(e) => setNuovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nuovo.trim()) {
                  onSave([...lista, nuovo.trim()])
                  setNuovo('')
                }
              }}
            />
            <button
              className="btn btn-icon-text"
              aria-label="Aggiungi"
              onClick={() => {
                if (!nuovo.trim()) return
                onSave([...lista, nuovo.trim()])
                setNuovo('')
              }}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
