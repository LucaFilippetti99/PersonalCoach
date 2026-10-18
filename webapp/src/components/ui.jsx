import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ricordaTab } from '../nav.js'

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  food: 'M7 3v8a2 2 0 0 1-2 2v8M7 3v6M4 3v6a3 3 0 0 0 3 3M17 21V3c-2.2 1.2-3.5 3.8-3.5 7v3H17',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  check: 'M5 12.5 10 17l9-10',
  chevron: 'M9 6l6 6-6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  fridge: 'M6 3h12v18H6zM6 10h12M9 6v2M9 13v3',
  cart: 'M3 4h2l2.4 11h10.2L20 8H7M9 20h.01M17 20h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  run: 'M13 4a1.5 1.5 0 1 0 0 .01M7 21l3-6 3 2v4M10 15l1-5 4 3h3M11 10l-3 1-2 3',
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  auto: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M12 7h4M12 11h6M12 15h5',
  up: 'M6 15l6-6 6 6',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-1.8-1L15 3.7h-4l-.3 2.4a7.5 7.5 0 0 0-1.8 1l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 1.8 1l.3 2.4h4l.3-2.4a7.5 7.5 0 0 0 1.8-1l2.3 1 2-3.4z',
}

export function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="icon"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={`tab ${value === t.id ? 'active' : ''}`}
          onClick={() => {
            onChange(t.id)
            ricordaTab(t.id)
          }}
        >
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.label}
          {t.badge != null && <span className="badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, unit, hint, tone }) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value ?? '—'}
        {value != null && unit && <span className="stat-unit">{unit}</span>}
      </div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/**
 * Piccola notifica temporanea: const [node, flash] = useFlash(); flash('Salvato')
 * Con un'azione (es. { label: 'Annulla', fn }) resta visibile più a lungo e mostra il pulsante.
 */
export function useFlash() {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), msg.azione ? 6000 : 2200)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? (
    <div className={`toast ${msg.error ? 'toast-error' : ''} ${msg.azione ? 'toast-azione' : ''}`} role="status">
      <span>{msg.text}</span>
      {msg.azione && (
        <button
          className="toast-btn"
          onClick={() => {
            setMsg(null)
            msg.azione.fn()
          }}
        >
          {msg.azione.label}
        </button>
      )}
    </div>
  ) : null
  return [node, (text, error = false, azione = null) => setMsg({ text, error, azione, id: Date.now() })]
}

export function ErrorBanner({ error }) {
  if (!error) return null
  return <div className="banner-error">Errore: {error}</div>
}

/**
 * Finestra modale (pop-up). Sul telefono si apre dal basso a tutto schermo.
 * Si chiude con Esc, con la X o toccando fuori; `azioni` sono i pulsanti in fondo (sempre visibili).
 */
export function Modal({ titolo, onClose, children, azioni, largo = false }) {
  const id = useId()
  const box = useRef(null)
  // onClose in un ref: così l'effetto gira una volta sola (niente focus che salta a ogni tasto)
  const chiudi = useRef(onClose)
  chiudi.current = onClose
  useEffect(() => {
    const prima = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    box.current?.querySelector('input, select, textarea, button:not(.modal-x)')?.focus({ preventScroll: true })
    const esc = (e) => e.key === 'Escape' && chiudi.current()
    document.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', esc)
      prima?.focus?.({ preventScroll: true })
    }
  }, [])
  return createPortal(
    <div className="modal-bg" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className={`modal ${largo ? 'modal-largo' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="modal-head">
          <h2 id={id}>{titolo}</h2>
          <button className="btn btn-icon modal-x" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {azioni && <footer className="modal-foot">{azioni}</footer>}
      </div>
    </div>,
    document.body,
  )
}
