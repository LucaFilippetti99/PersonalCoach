// Logica pura dei pop-up di modifica (giorno di scheda e sessione dello storico).
// Testata in tests/editor.test.js.

const numero = (v) => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Sposta l'elemento i di `delta` posizioni (−1 su, +1 giù); restituisce un nuovo array */
export function sposta(lista, i, delta) {
  const j = i + delta
  if (j < 0 || j >= lista.length) return lista
  const out = [...lista]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/* ---------------- Giorno di scheda ---------------- */

/** Esercizio vuoto per il form della scheda */
export const esercizioSchedaVuoto = () => ({ nome: '', serie: '3', reps: '8-12', rir: '2', recupero_s: '90', note: '' })

/** Da esercizio salvato a valori del form (tutto stringa) */
export function esercizioSchedaForm(e) {
  return {
    ...e,
    serie: String(e.serie ?? ''),
    reps: String(e.reps ?? ''),
    rir: e.rir == null ? '' : String(e.rir),
    recupero_s: e.recupero_s == null ? '' : String(e.recupero_s),
    note: e.note ?? '',
  }
}

/**
 * Dal form all'esercizio da salvare. Tiene gli altri campi (es. `kg`), toglie `muscoli` se vuoto.
 * Restituisce null se manca il nome.
 */
export function pulisciEsercizioScheda(f) {
  const nome = String(f.nome || '').trim()
  if (!nome) return null
  const { _id, ...resto } = f
  const out = {
    ...resto,
    nome,
    serie: Math.max(1, Math.round(numero(f.serie) ?? 1)),
    reps: String(f.reps ?? '').trim() || '8-12',
    rir: numero(f.rir),
    recupero_s: numero(f.recupero_s) != null ? Math.round(numero(f.recupero_s)) : null,
    note: String(f.note || '').trim(),
  }
  const m = f.muscoli
  if (!m || (!m.primari?.length && !m.secondari?.length)) delete out.muscoli
  else out.muscoli = { primari: [...(m.primari || [])], secondari: [...(m.secondari || [])] }
  return out
}

/** Controlla un giorno prima del salvataggio: restituisce un messaggio d'errore o null */
export function erroreGiorno(giorno, altriNomi = []) {
  const nome = String(giorno.nome || '').trim()
  if (!nome) return 'Dai un nome al giorno (es. "Giorno A — Push").'
  if (altriNomi.includes(nome)) return `Esiste già un giorno chiamato "${nome}".`
  if (!giorno.esercizi.length) return 'Aggiungi almeno un esercizio.'
  return null
}

/**
 * Salva un giorno nella scheda: sostituisce quello chiamato `vecchioNome` (o lo aggiunge se null).
 * Restituisce la nuova scheda.
 */
export function salvaGiornoScheda(scheda, vecchioNome, giorno) {
  const giorni = scheda.giorni || []
  const esiste = vecchioNome != null && giorni.some((g) => g.nome === vecchioNome)
  return {
    ...scheda,
    giorni: esiste ? giorni.map((g) => (g.nome === vecchioNome ? giorno : g)) : [...giorni, giorno],
  }
}

export const eliminaGiornoScheda = (scheda, nome) => ({ ...scheda, giorni: scheda.giorni.filter((g) => g.nome !== nome) })

/**
 * Se un giorno cambia nome, aggiorna i riferimenti nelle impostazioni (calendario e titoli Hevy).
 * Con `nuovo` = null il giorno è stato eliminato: nel calendario diventa riposo.
 */
export function rinominaGiornoImpostazioni(imp, vecchio, nuovo) {
  if (!imp || vecchio === nuovo) return imp
  const calendario = Object.fromEntries(
    Object.entries(imp.calendario || {}).map(([g, v]) => [g, v === vecchio ? nuovo : v]),
  )
  const hevy_giorni = Object.fromEntries(
    Object.entries(imp.hevy_giorni || {})
      .map(([t, v]) => [t, v === vecchio ? nuovo : v])
      .filter(([, v]) => v),
  )
  return { ...imp, calendario, hevy_giorni }
}

/** Muscoli personalizzati: un tocco su un muscolo passa nessuno → principale → aiuta → nessuno */
export function ciclaMuscolo(m, id) {
  const primari = [...(m?.primari || [])]
  const secondari = [...(m?.secondari || [])]
  if (primari.includes(id)) return { primari: primari.filter((x) => x !== id), secondari: [...secondari, id] }
  if (secondari.includes(id)) return { primari, secondari: secondari.filter((x) => x !== id) }
  return { primari: [...primari, id], secondari }
}

/* ---------------- Sessione dello storico ---------------- */

/** Da sessione salvata a valori del form */
export function sessioneForm(s) {
  return {
    data: s.data,
    giorno: s.giorno ?? '',
    scheda: s.scheda ?? '',
    durata_min: s.durata_min == null ? '' : String(s.durata_min),
    note: s.note ?? '',
    esercizi: (s.esercizi || []).map((e) => ({
      nome: e.nome,
      serie: (e.serie || []).map((x) => ({
        ...x,
        kg: x.kg == null ? '' : String(x.kg),
        reps: x.reps ? String(x.reps) : '',
        rir: x.rir == null ? '' : String(x.rir),
      })),
    })),
  }
}

/**
 * Dal form alla sessione da salvare: numeri veri, niente serie vuote
 * (una serie vale se ha ripetizioni, secondi o km), niente esercizi senza serie.
 */
export function pulisciSessione(f) {
  const esercizi = (f.esercizi || [])
    .map((e) => ({
      nome: String(e.nome || '').trim(),
      serie: (e.serie || [])
        .map((x) => {
          const s = { kg: numero(x.kg) ?? 0, reps: Math.round(numero(x.reps) ?? 0), rir: numero(x.rir) }
          if (numero(x.secondi)) s.secondi = numero(x.secondi)
          if (numero(x.km)) s.km = numero(x.km)
          return s
        })
        .filter((s) => s.reps > 0 || s.secondi || s.km),
    }))
    .filter((e) => e.nome && e.serie.length)
  return {
    data: f.data,
    scheda: f.scheda ?? '',
    giorno: String(f.giorno || '').trim(),
    esercizi,
    durata_min: numero(f.durata_min) != null ? Math.round(numero(f.durata_min)) : null,
    note: String(f.note || '').trim(),
  }
}

export function erroreSessione(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.data || '')) return 'Scegli una data.'
  if (!s.giorno) return 'Scrivi il nome dell\'allenamento (es. "Giorno A — Push").'
  if (!s.esercizi.length) return 'Serve almeno un esercizio con una serie compilata.'
  return null
}

/**
 * Sostituisce nel log la sessione `originale` (identificata da data + giorno) con `nuova`.
 * Restituisce { log } oppure { errore } se la nuova data + giorno coincide con un'altra sessione.
 */
export function salvaSessioneLog(log, originale, nuova) {
  const chiave = (s) => `${s.data}|${s.giorno}`
  const altre = log.filter((s) => !originale || chiave(s) !== chiave(originale))
  if (altre.some((s) => chiave(s) === chiave(nuova)))
    return { errore: `Esiste già una sessione "${nuova.giorno}" in quella data.` }
  return { log: [...altre, nuova].sort((a, b) => a.data.localeCompare(b.data)) }
}
