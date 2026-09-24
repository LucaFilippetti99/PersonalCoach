import { useEffect, useState } from 'react'

/*
 * Tema dell'app: 'auto' (segue il sistema), 'light' o 'dark'.
 * La scelta vive in localStorage (è una preferenza di questo dispositivo, non un dato del coach)
 * e si applica come attributo data-theme su <html>; i colori sono in styles.css.
 * index.html applica il tema salvato prima del primo render, così non c'è il lampo di colore sbagliato.
 */
export const TEMI = [
  { id: 'auto', label: 'Automatico', icon: 'auto' },
  { id: 'light', label: 'Chiaro', icon: 'sun' },
  { id: 'dark', label: 'Scuro', icon: 'moon' },
]
const KEY = 'coach-tema'
const EVENTO = 'coach-tema'
const scuroDiSistema = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function leggiTema() {
  try {
    const t = localStorage.getItem(KEY)
    return TEMI.some((x) => x.id === t) ? t : 'auto'
  } catch {
    return 'auto'
  }
}

/** Il tema effettivo in questo momento: 'light' o 'dark' */
export const temaEffettivo = (t = leggiTema()) => (t === 'auto' ? (scuroDiSistema() ? 'dark' : 'light') : t)

export function applicaTema(t = leggiTema()) {
  const root = document.documentElement
  if (t === 'auto') delete root.dataset.theme
  else root.dataset.theme = t
  // Colore della barra di stato sul telefono
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', temaEffettivo(t) === 'dark' ? '#0e1412' : '#0f766e')
}

export function impostaTema(t) {
  try {
    if (t === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {
    /* storage non disponibile: vale solo per questa sessione */
  }
  applicaTema(t)
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: t }))
}

/** [tema, impostaTema] — tutti i componenti che lo usano restano allineati */
export function useTema() {
  const [tema, setTema] = useState(leggiTema)
  useEffect(() => {
    const onCambio = (e) => setTema(e.detail)
    // In automatico, se il sistema passa da chiaro a scuro aggiorna la barra di stato
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onSistema = () => applicaTema()
    window.addEventListener(EVENTO, onCambio)
    mq?.addEventListener?.('change', onSistema)
    return () => {
      window.removeEventListener(EVENTO, onCambio)
      mq?.removeEventListener?.('change', onSistema)
    }
  }, [])
  return [tema, impostaTema]
}

/** Prossimo tema del pulsante in alto: Automatico → Chiaro → Scuro → Automatico */
export const prossimoTema = (t) => TEMI[(TEMI.findIndex((x) => x.id === t) + 1) % TEMI.length].id
