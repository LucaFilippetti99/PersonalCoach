// Import dell'export CSV di Hevy (Profilo → Impostazioni → Export & Import Data → Export Data).
// Converte le righe (una per serie) nello schema di log/allenamenti.json.
// Modulo puro: funziona sia nel browser sia in Node.

const MESI = {
  // italiano
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
  // inglese
  jan: 1, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, dec: 12,
}

/** Parser CSV minimale con supporto a virgolette e a capo nei campi */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else q = false
      } else field += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [head, ...body] = rows.filter((r) => r.some((v) => v !== ''))
  const keys = head.map((h) => h.replace(/^﻿/, '').trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])))
}

/**
 * Converte una data Hevy in { data: 'AAAA-MM-GG', minuti: minuti dalla mezzanotte }.
 * Formati gestiti: "23 set 2026, 19:55", "Sep 23, 2026, 7:55 PM", "23 Sep 2026, 19:55", ISO.
 */
export function parseHevyDate(s) {
  if (!s) return null
  const t = s.trim()
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (iso) return { data: `${iso[1]}-${iso[2]}-${iso[3]}`, minuti: +iso[4] * 60 + +iso[5] }

  let d, m, y
  let rest
  let a = t.match(/^(\d{1,2})\s+([A-Za-zà]+)\.?\s+(\d{4}),?\s*(.*)$/) // 23 set 2026, 19:55
  if (a) {
    ;[, d, m, y, rest] = a
  } else {
    a = t.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4}),?\s*(.*)$/) // Sep 23, 2026, 7:55 PM
    if (!a) return null
    ;[, m, d, y, rest] = a
  }
  const mese = MESI[m.toLowerCase().slice(0, 3)]
  if (!mese) return null
  let minuti = 0
  const h = (rest || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (h) {
    let hh = +h[1]
    if (h[3]) hh = (hh % 12) + (/pm/i.test(h[3]) ? 12 : 0)
    minuti = hh * 60 + +h[2]
  }
  const p = (n) => String(n).padStart(2, '0')
  return { data: `${y}-${p(mese)}-${p(+d)}`, minuti }
}

const num = (v) => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Trasforma le righe Hevy in sessioni.
 * - salta le serie di riscaldamento e quelle vuote; le serie a tempo (plank) o a distanza (corsa)
 *   vengono tenute con reps = 0 e i campi opzionali `secondi` / `km`
 * - serie "failure" → RIR 0; RPE presente → RIR = 10 - RPE
 * - `alias`: { "Nome Hevy": "Nome in scheda" } per esercizi con nomi diversi
 * - `nomeScheda(data)`: restituisce il nome della scheda attiva in quella data
 * - `giorno(titolo, data)`: collega il titolo dell'allenamento al giorno di scheda (default: il titolo stesso)
 */
export function hevyToSessions(rows, { alias = {}, nomeScheda = () => 'Hevy', giorno = (titolo) => titolo } = {}) {
  const byWorkout = new Map()
  for (const r of rows) {
    const key = `${r.title}|${r.start_time}`
    if (!byWorkout.has(key)) byWorkout.set(key, [])
    byWorkout.get(key).push(r)
  }

  const sessioni = []
  let saltate = 0
  for (const righe of byWorkout.values()) {
    const r0 = righe[0]
    const start = parseHevyDate(r0.start_time)
    if (!start) continue
    const end = parseHevyDate(r0.end_time)

    const esercizi = []
    const noteEs = []
    for (const r of righe) {
      const nome = alias[r.exercise_title] || r.exercise_title
      let ex = esercizi.find((e) => e.nome === nome)
      if (!ex) {
        ex = { nome, serie: [], _idx: [] }
        esercizi.push(ex)
        if (r.exercise_notes?.trim()) noteEs.push(`${nome}: ${r.exercise_notes.trim()}`)
      }
      const reps = num(r.reps)
      const secondi = num(r.duration_seconds)
      const km = num(r.distance_km)
      if (r.set_type === 'warmup' || (!reps && !secondi && !km)) {
        saltate++
        continue
      }
      const rpe = num(r.rpe)
      const serie = {
        kg: num(r.weight_kg) ?? 0,
        reps: reps ?? 0,
        rir: r.set_type === 'failure' ? 0 : rpe != null ? Math.max(0, Math.round(10 - rpe)) : null,
      }
      if (secondi) serie.secondi = secondi
      if (km) serie.km = km
      ex.serie.push(serie)
      ex._idx.push(num(r.set_index) ?? ex._idx.length)
    }

    const pulite = esercizi
      .filter((e) => e.serie.length)
      .map((e) => {
        const ord = e._idx.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
        return { nome: e.nome, serie: ord.map(([, i]) => e.serie[i]) }
      })
    if (!pulite.length) continue

    let durata = null
    if (end) {
      let diff = end.minuti - start.minuti
      if (end.data !== start.data) diff += 24 * 60
      if (diff > 0 && diff < 600) durata = diff
    }

    sessioni.push({
      data: start.data,
      scheda: nomeScheda(start.data),
      giorno: giorno(r0.title.trim(), start.data) || r0.title.trim(),
      esercizi: pulite,
      durata_min: durata,
      note: [r0.description?.trim(), ...noteEs].filter(Boolean).join(' | '),
    })
  }
  sessioni.sort((a, b) => a.data.localeCompare(b.data))
  return { sessioni, saltate }
}

/**
 * Unisce le sessioni importate al log esistente.
 * Una sessione è la stessa se ha stessa data e stesso titolo: viene sostituita (re-import sicuro).
 */
export function mergeLog(log, importate, isExample = () => false) {
  const chiave = (s) => `${s.data}|${s.giorno}`
  const nuove = new Map(importate.map((s) => [chiave(s), s]))
  let aggiornate = 0
  const tenute = log.filter((s) => {
    if (isExample(s)) return false
    if (nuove.has(chiave(s))) {
      aggiornate++
      return false
    }
    return true
  })
  const merged = [...tenute, ...importate].sort((a, b) => a.data.localeCompare(b.data))
  return { log: merged, aggiunte: importate.length - aggiornate, aggiornate }
}
