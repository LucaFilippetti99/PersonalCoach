export const GIORNI_SETTIMANA = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

/** Data locale in formato AAAA-MM-GG */
export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Nome del giorno in italiano (lunedì…domenica) */
export function weekdayName(d = new Date()) {
  return GIORNI_SETTIMANA[(d.getDay() + 6) % 7]
}

/** Lunedì della settimana di d */
export function startOfWeek(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return addDays(x, -((x.getDay() + 6) % 7))
}

/** Settimana ISO nel formato AAAA-Www */
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`
}

export function formatDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!s) return ''
  return parseDate(s).toLocaleDateString('it-IT', opts)
}

export function round1(n) {
  return Math.round(n * 10) / 10
}

/** Misure valide (peso non nullo) ordinate per data */
export function validWeights(misure = []) {
  return misure
    .filter((m) => typeof m.peso_kg === 'number')
    .sort((a, b) => a.data.localeCompare(b.data))
}

/** Media del peso negli ultimi 7 giorni che terminano in `endDate` (inclusa) */
export function weeklyAvg(misure, endDate) {
  const end = parseDate(endDate)
  const start = addDays(end, -6)
  const vals = validWeights(misure).filter((m) => {
    const d = parseDate(m.data)
    return d >= start && d <= end
  })
  if (!vals.length) return null
  return vals.reduce((s, m) => s + m.peso_kg, 0) / vals.length
}

/** Serie migliore (kg più alto, poi più reps) di un esercizio in una sessione */
export function topSet(ex) {
  if (!ex?.serie?.length) return null
  return [...ex.serie].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0]
}

/** Ultima sessione (prima di `beforeDate`, esclusa) in cui compare l'esercizio */
export function lastExercise(log = [], nome, beforeDate) {
  const sessions = [...log]
    .filter((s) => !beforeDate || s.data < beforeDate)
    .sort((a, b) => b.data.localeCompare(a.data))
  for (const s of sessions) {
    const ex = s.esercizi.find((e) => e.nome === nome)
    if (ex) return { data: s.data, esercizio: ex }
  }
  return null
}

export function formatSets(serie = []) {
  return serie.map((s) => `${s.kg}×${s.reps}`).join(' · ')
}

/** Il file di log contiene all'inizio un esempio: lo riconosciamo per non contarlo */
export function isExampleSession(s) {
  return /esempio/i.test(s.scheda || '')
}

/** 1RM stimato (Epley); per serie oltre 12 reps la stima è poco affidabile ma resta confrontabile */
export function e1rm(s) {
  if (!s?.reps) return 0
  return s.kg * (1 + s.reps / 30)
}

/** Storico di un esercizio: una voce per sessione, in ordine di data */
export function exerciseHistory(log = [], nome) {
  return log
    .filter((s) => s.esercizi.some((e) => e.nome === nome))
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((s) => {
      const ex = s.esercizi.find((e) => e.nome === nome)
      const corpoLibero = ex.serie.every((x) => !x.kg)
      // A corpo libero conta il numero massimo di ripetizioni
      const best = [...ex.serie].sort((a, b) => e1rm(b) - e1rm(a) || b.kg - a.kg || b.reps - a.reps)[0]
      return {
        data: s.data,
        giorno: s.giorno,
        serie: ex.serie,
        top: best,
        corpoLibero,
        e1rm: corpoLibero ? best.reps : round1(e1rm(best)),
        volume: ex.serie.reduce((v, x) => v + x.kg * x.reps, 0),
      }
    })
}

/**
 * Stato di progressione sulle ultime 3 sessioni:
 * 'su' se l'ultima supera le precedenti, 'fermo' se non migliora da 3 sessioni, altrimenti 'ok'.
 */
export function progressStatus(storia, oggi = new Date()) {
  if (!storia.length) return 'nessuno'
  // Conta solo le sessioni delle ultime 6 settimane: dopo una pausa lunga lo storico vecchio non fa testo
  const limite = isoDate(addDays(oggi, -42))
  const recenti = storia.filter((h) => h.data >= limite)
  if (!recenti.length) return 'vecchio'
  if (recenti.length < 3) return 'pochi'
  const ult = recenti.slice(-3)
  const primaMax = Math.max(ult[0].e1rm, ult[1].e1rm)
  if (ult[2].e1rm > primaMax) return 'su'
  if (ult[2].e1rm <= ult[0].e1rm && ult[1].e1rm <= ult[0].e1rm) return 'fermo'
  return 'ok'
}
