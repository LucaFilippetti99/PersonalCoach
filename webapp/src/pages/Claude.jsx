import { useEffect, useMemo, useState } from 'react'
import { Card, Empty, Icon, PageHeader, useFlash } from '../components/ui.jsx'
import { useFrigo, useImpostazioni, useLog, useMisure, useScheda, useSpesa } from '../hooks.js'
import { navigate } from '../nav.js'
import { MODELLI, SEZIONI_PROMPT, valoriIniziali } from '../prompts.js'
import { copiaTesto, puoCondividere } from '../clipboard.js'

/** Pagina "Chiedi a Claude": scegli un modello, compila il form, copia il prompt. */
export default function Claude({ params }) {
  const { data: scheda } = useScheda()
  const { data: log } = useLog()
  const { data: misure } = useMisure()
  const { data: imp } = useImpostazioni()
  const { data: frigo } = useFrigo()
  const { data: spesa } = useSpesa()
  const ctx = useMemo(() => ({ scheda, log, misure, imp, frigo, spesa }), [scheda, log, misure, imp, frigo, spesa])
  const pronto = scheda && log && misure && imp && frigo && spesa

  const modello = MODELLI.find((m) => m.id === params.t) || MODELLI[0]

  return (
    <div className="page">
      <PageHeader
        title="Chiedi a Claude"
        subtitle="Compila il form: il testo pronto da incollare in Cowork si crea da solo, con i dati dell'app già dentro."
      />
      <div className="grid-progress claude-grid">
        <Card title="Richieste">
          {SEZIONI_PROMPT.map((s) => (
            <div key={s.id} className="group">
              <h4 className="group-title">{s.label}</h4>
              <ul className="prog-list">
                {MODELLI.filter((m) => m.sezione === s.id).map((m) => (
                  <li key={m.id}>
                    <button
                      className={`prog-item ${m.id === modello.id ? 'active' : ''}`}
                      onClick={() => navigate('claude', { t: m.id })}
                    >
                      <span className="grow">
                        <span className="prog-name">{m.titolo}</span>
                        <span className="muted small">{m.descrizione}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
        {pronto ? <Form key={modello.id} modello={modello} ctx={ctx} /> : <Empty>Carico i dati…</Empty>}
      </div>
    </div>
  )
}

function Form({ modello, ctx }) {
  const [valori, setValori] = useState(() => valoriIniziali(modello, ctx))
  const [testo, setTesto] = useState('')
  const [modificato, setModificato] = useState(false)
  const [flash, doFlash] = useFlash()

  // Il prompt si rigenera a ogni modifica del form (a meno che tu non l'abbia ritoccato a mano)
  useEffect(() => {
    if (!modificato) setTesto(modello.build(valori, ctx))
  }, [valori, ctx, modello, modificato])

  const set = (id, v) => setValori((x) => ({ ...x, [id]: v }))

  async function copia() {
    try {
      await copiaTesto(testo)
      doFlash('Copiato: incollalo in Cowork')
    } catch {
      doFlash('Copia non riuscita: seleziona il testo e copialo a mano', true)
    }
  }

  async function condividi() {
    try {
      await navigator.share({ text: testo })
    } catch {
      /* annullato */
    }
  }

  return (
    <Card title={modello.titolo}>
      <p className="muted small">{modello.descrizione}</p>
      <div className="prompt-form">
        {modello.campi.map((c) => {
          const opz = typeof c.opzioni === 'function' ? c.opzioni(ctx) : c.opzioni
          if (c.tipo === 'checkbox')
            return (
              <label key={c.id} className="check-field">
                <input type="checkbox" checked={!!valori[c.id]} onChange={(e) => set(c.id, e.target.checked)} />
                <span>{c.label}</span>
              </label>
            )
          return (
            <label key={c.id} className={`field ${c.tipo === 'textarea' ? 'full' : ''}`}>
              <span>{c.label}</span>
              {c.tipo === 'textarea' ? (
                <textarea
                  rows={3}
                  value={valori[c.id]}
                  placeholder={c.placeholder}
                  onChange={(e) => set(c.id, e.target.value)}
                />
              ) : c.tipo === 'select' ? (
                <select value={valori[c.id]} onChange={(e) => set(c.id, e.target.value)}>
                  {opz.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={c.tipo === 'number' ? 'number' : c.tipo === 'date' ? 'date' : 'text'}
                  value={valori[c.id]}
                  placeholder={c.placeholder}
                  onChange={(e) => set(c.id, e.target.value)}
                />
              )}
            </label>
          )
        })}
      </div>

      <div className="prompt-head">
        <h3>Testo per Claude</h3>
        {modificato && (
          <button className="btn btn-ghost btn-sm" onClick={() => setModificato(false)}>
            Rigenera dal form
          </button>
        )}
      </div>
      <textarea
        className="prompt-preview"
        value={testo}
        rows={Math.min(18, testo.split('\n').length + 2)}
        onChange={(e) => {
          setTesto(e.target.value)
          setModificato(true)
        }}
        aria-label="Testo del prompt"
      />
      <div className="row-between">
        <span className="muted small">Puoi ritoccare il testo prima di copiarlo.</span>
        <div className="row-gap">
          {puoCondividere() && (
            <button className="btn" onClick={condividi}>
              Condividi
            </button>
          )}
          <button className="btn btn-primary" onClick={copia}>
            <Icon name="copy" size={16} /> Copia
          </button>
        </div>
      </div>
      {flash}
    </Card>
  )
}

/** Menu compatto "Chiedi a Claude" da mettere nell'intestazione delle altre sezioni */
export function ChiediClaude({ ids }) {
  const [aperto, setAperto] = useState(false)
  useEffect(() => {
    if (!aperto) return
    const chiudi = (e) => !e.target.closest?.('.ask') && setAperto(false)
    const esc = (e) => e.key === 'Escape' && setAperto(false)
    document.addEventListener('pointerdown', chiudi)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', chiudi)
      document.removeEventListener('keydown', esc)
    }
  }, [aperto])
  return (
    <div className="ask">
      <button className="btn btn-sm ask-toggle" aria-expanded={aperto} aria-haspopup="menu" onClick={() => setAperto(!aperto)}>
        <Icon name="chat" size={16} /> Chiedi a Claude
      </button>
      {aperto && (
        <div className="ask-menu" role="menu">
          {ids.map((id) => {
            const m = MODELLI.find((x) => x.id === id)
            return (
              <button key={id} role="menuitem" className="ask-item" onClick={() => navigate('claude', { t: id })}>
                <strong>{m.titolo}</strong>
                <span className="muted small">{m.descrizione}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
