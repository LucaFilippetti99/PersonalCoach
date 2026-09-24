// Logica pura del piano pasti (usata da pages/Cibo.jsx e dai test).
import { GIORNI_SETTIMANA } from './utils.js'

export const TIPI_PASTO = ['colazione', 'pranzo', 'spuntino', 'cena']

export const norm = (s) => String(s || '').toLowerCase().trim()
export const contiene = (lista = [], nome) => lista.some((a) => norm(a.nome) === norm(nome))

/** Piano vuoto per una settimana ISO, con tutti i 7 giorni */
export function pianoVuoto(settimana, kcal = null) {
  return {
    settimana,
    kcal_giorno_indicative: kcal,
    giorni: GIORNI_SETTIMANA.map((giorno) => ({ giorno, pasti: [] })),
    da_comprare_extra: [],
  }
}

/** Garantisce che il piano abbia tutti i giorni (in ordine), così si può aggiungere un pasto anche alla domenica */
export function conTuttiIGiorni(piano) {
  const giorni = GIORNI_SETTIMANA.map(
    (giorno) => piano.giorni.find((g) => g.giorno === giorno) || { giorno, pasti: [] },
  )
  return { ...piano, giorni }
}

/** Ordina i pasti per momento della giornata */
export function ordinaPasti(pasti) {
  const pos = (t) => {
    const i = TIPI_PASTO.indexOf(t)
    return i < 0 ? TIPI_PASTO.length : i
  }
  return [...pasti].sort((a, b) => pos(a.tipo) - pos(b.tipo))
}

/**
 * Ricettario: tutti i piatti "cucinabili" (con ingredienti) presenti nei piani passati.
 * Se lo stesso piatto compare più volte vince l'ultima versione (piani in ordine cronologico).
 */
export function ricettario(piani = []) {
  const mappa = new Map()
  for (const piano of piani) {
    for (const g of piano?.giorni || []) {
      for (const p of g.pasti || []) {
        if (!p.piatto || !p.ingredienti?.length) continue
        mappa.set(norm(p.piatto), {
          piatto: p.piatto,
          tipo: p.tipo,
          ingredienti: p.ingredienti.map((i) => ({ ...i })),
          ricetta: Array.isArray(p.ricetta) ? [...p.ricetta] : p.ricetta ? [p.ricetta] : [],
        })
      }
    }
  }
  return [...mappa.values()].sort((a, b) => a.piatto.localeCompare(b.piatto, 'it'))
}

/** Ingredienti di un pasto che non sono né in frigo né in lista spesa */
export function ingredientiMancanti(pasto, frigo = [], spesa = []) {
  return (pasto.ingredienti || [])
    .map((i) => i.nome)
    .filter((n) => n && !contiene(frigo, n) && !contiene(spesa, n))
}

/** Ingredienti di un pasto presenti in frigo (candidati da togliere quando il pasto è fatto) */
export function ingredientiInFrigo(pasto, frigo = []) {
  return (pasto.ingredienti || []).map((i) => i.nome).filter((n) => contiene(frigo, n))
}

/** Pulisce un pasto uscito dal form: niente righe vuote, ricetta come array */
export function pulisciPasto(p) {
  const out = {
    tipo: p.tipo,
    piatto: p.piatto.trim(),
    ingredienti: (p.ingredienti || [])
      .filter((i) => i.nome.trim())
      .map((i) => ({ nome: i.nome.trim(), porzione: (i.porzione || '').trim() })),
    ricetta: (Array.isArray(p.ricetta) ? p.ricetta : String(p.ricetta || '').split('\n'))
      .map((r) => r.trim())
      .filter(Boolean),
    note: (p.note || '').trim(),
  }
  if (p.fatto) out.fatto = true
  return out
}
