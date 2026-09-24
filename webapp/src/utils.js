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

/** Durata in secondi → "45 s" oppure "28:30" */
export function formatDuration(sec) {
  if (sec < 90) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = String(Math.round(sec % 60)).padStart(2, '0')
  return `${m}:${s}`
}

/** Una serie in forma breve: "50×8", "45 s", "20 kg × 45 s", "5,2 km in 28:30" */
export function formatSet(s) {
  if (!s) return ''
  if (s.km) return `${String(s.km).replace('.', ',')} km${s.secondi ? ` in ${formatDuration(s.secondi)}` : ''}`
  if (s.secondi && !s.reps) return s.kg ? `${s.kg} kg × ${formatDuration(s.secondi)}` : formatDuration(s.secondi)
  return s.kg ? `${s.kg}×${s.reps}` : `${s.reps} reps`
}

export function formatSets(serie = []) {
  return serie.map(formatSet).join(' · ')
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

/**
 * Tipo di esercizio in base alle serie:
 * 'distanza' (corsa: km), 'tempo' (plank: secondi), 'corpo' (corpo libero: reps), 'carico' (kg × reps)
 */
export function tipoEsercizio(serie = []) {
  if (serie.length && serie.every((x) => x.km)) return 'distanza'
  if (serie.length && serie.every((x) => x.secondi && !x.reps)) return 'tempo'
  if (serie.every((x) => !x.kg)) return 'corpo'
  return 'carico'
}

/** Cosa si misura per ogni tipo (valore da massimizzare) */
const MISURA = {
  carico: (s) => e1rm(s),
  corpo: (s) => s.reps || 0,
  tempo: (s) => s.secondi || 0,
  distanza: (s) => s.km || 0,
}

/** Etichetta e unità per ogni tipo, usate nei grafici */
export const TIPO_INFO = {
  carico: { label: '1RM stimato', unita: 'kg' },
  corpo: { label: 'ripetizioni massime', unita: 'reps' },
  tempo: { label: 'tenuta massima', unita: 's' },
  distanza: { label: 'distanza', unita: 'km' },
}

/** Storico di un esercizio: una voce per sessione, in ordine di data */
export function exerciseHistory(log = [], nome) {
  return log
    .filter((s) => s.esercizi.some((e) => e.nome === nome))
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((s) => {
      const ex = s.esercizi.find((e) => e.nome === nome)
      const tipo = tipoEsercizio(ex.serie)
      const misura = MISURA[tipo]
      const best = [...ex.serie].sort((a, b) => misura(b) - misura(a) || b.kg - a.kg || b.reps - a.reps)[0]
      const valore = round1(misura(best))
      return {
        data: s.data,
        giorno: s.giorno,
        serie: ex.serie,
        top: best,
        tipo,
        corpoLibero: tipo === 'corpo',
        valore,
        e1rm: valore,
        volume: ex.serie.reduce((v, x) => v + x.kg * x.reps, 0),
      }
    })
}

/**
 * Stato di progressione sulle ultime 3 sessioni (`oggi` e `dal` opzionali):
 * 'su' se l'ultima supera le precedenti, 'fermo' se non migliora da 3 sessioni, altrimenti 'ok'.
 */
export function progressStatus(storia, oggi = new Date(), dal = null) {
  if (!storia.length) return 'nessuno'
  // Conta solo le sessioni delle ultime 6 settimane: dopo una pausa lunga lo storico vecchio non fa testo.
  // Con `dal` (inizio della scheda in corso) si ignorano anche le sessioni del programma precedente.
  const seiSett = isoDate(addDays(oggi, -42))
  const limite = dal && dal > seiSett ? dal : seiSett
  const recenti = storia.filter((h) => h.data >= limite)
  if (!recenti.length) return 'vecchio'
  if (recenti.length < 3) return 'pochi'
  const ult = recenti.slice(-3)
  const primaMax = Math.max(ult[0].e1rm, ult[1].e1rm)
  if (ult[2].e1rm > primaMax) return 'su'
  if (ult[2].e1rm <= ult[0].e1rm && ult[1].e1rm <= ult[0].e1rm) return 'fermo'
  return 'ok'
}

/* ---------------- Scheda ---------------- */

const normTesto = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')

/** "Giorno A — Push" → { sigla: 'A', descrizione: 'Push' } */
export function parseGiorno(nome) {
  const m = String(nome || '').match(/^giorno\s+(\S+)\s*[—–-]\s*(.+)$/i)
  return m ? { sigla: m[1], descrizione: m[2].trim() } : { sigla: null, descrizione: String(nome || '') }
}

/** Sigla breve di un giorno di scheda ("A"), o null */
export const siglaGiorno = (nome) => parseGiorno(nome).sigla

/**
 * Collega il titolo di un allenamento (es. da Hevy) al giorno della scheda.
 * Ordine: alias impostato a mano → nome identico → "Push" / "Giorno A" / "A" → prima parola
 * della descrizione ("Gambe" → "Giorno C — Gambe + spalle") se non è ambigua. Altrimenti null.
 */
export function giornoScheda(titolo, scheda, alias = {}) {
  const giorni = scheda?.giorni?.map((g) => g.nome) || []
  if (alias[titolo] && giorni.includes(alias[titolo])) return alias[titolo]
  const t = normTesto(titolo)
  if (!t) return null
  const esatto = giorni.find((g) => normTesto(g) === t)
  if (esatto) return esatto
  const info = giorni.map((g) => ({ nome: g, ...parseGiorno(g) }))
  const perNome = info.filter(
    (g) =>
      g.sigla &&
      (t === normTesto(g.descrizione) || t === `giorno ${normTesto(g.sigla)}` || t === normTesto(g.sigla)),
  )
  if (perNome.length === 1) return perNome[0].nome
  const primaParola = t.split(/[\s+/,]+/)[0]
  const perParola = info.filter((g) => g.sigla && normTesto(g.descrizione).split(/[\s+/,]+/)[0] === primaParola)
  return perParola.length === 1 ? perParola[0].nome : null
}

/** Settimana della scheda (1, 2, …) in una data; 0 prima dell'inizio, null se la scheda non ha inizio */
export function settimanaScheda(scheda, data = isoDate()) {
  if (!scheda?.inizio) return null
  const diff = Math.round((parseDate(data) - parseDate(scheda.inizio)) / 86400000)
  return diff < 0 ? 0 : Math.floor(diff / 7) + 1
}

/** La scheda è in corso in quella data (iniziata) */
export const schedaAttiva = (scheda, data = isoDate()) => !!scheda?.inizio && data >= scheda.inizio

/**
 * Carico di partenza indicato dalla scheda per un esercizio in una certa settimana.
 * Usa il campo `kg` se c'è, altrimenti legge le note tipo "Sett. 1: 47,5 kg" o "Sett. 1: 35-40 kg"
 * (in un intervallo prende il valore più basso). Vale l'indicazione della settimana più recente ≤ quella corrente.
 */
export function kgDaScheda(target, settimana = 1) {
  if (typeof target?.kg === 'number') return target.kg
  const re = /sett\.?\s*(\d+)\s*:\s*(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*kg/gi
  let best = null
  for (const m of String(target?.note || '').matchAll(re)) {
    const w = Number(m[1])
    if (w <= Math.max(1, settimana) && (!best || w >= best.w)) best = { w, kg: Number(m[2].replace(',', '.')) }
  }
  return best?.kg ?? null
}

/** Lunedì della settimana ISO "AAAA-Www" (null se il formato non torna) */
export function lunediSettimana(settimana) {
  const m = String(settimana || '').match(/(\d{4})-W(\d{2})/)
  if (!m) return null
  const gen4 = new Date(Number(m[1]), 0, 4) // il 4 gennaio è sempre nella settimana 1
  return addDays(startOfWeek(gen4), (Number(m[2]) - 1) * 7)
}

/** "2026-W39" → "21–27 set", "2026-W40" → "28 set – 4 ott" */
export function etichettaSettimana(settimana) {
  const lun = lunediSettimana(settimana)
  if (!lun) return settimana
  const dom = addDays(lun, 6)
  const mese = (d) => d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
  if (lun.getMonth() === dom.getMonth()) return `${lun.getDate()}–${dom.getDate()} ${mese(dom)}`
  return `${lun.getDate()} ${mese(lun)} – ${dom.getDate()} ${mese(dom)}`
}

/**
 * Tempo di recupero leggibile: sotto il minuto in secondi, poi in minuti.
 * 45 → "45 s", 60 → "1 min", 90 → "1 min 30 s", 150 → "2 min 30 s", 180 → "3 min"
 */
export function formatRecupero(sec) {
  // Spazio non divisibile tra numero e unità: se serve andare a capo, si va a capo solo tra "2 min" e "30 s"
  const nb = '\u00a0'
  const s = Math.round(Number(sec) || 0)
  if (s <= 0) return ''
  if (s < 60) return `${s}${nb}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}${nb}min ${r}${nb}s` : `${m}${nb}min`
}
