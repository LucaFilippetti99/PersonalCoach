// Muscoli coinvolti da ogni esercizio, per la mappa del corpo (components/MappaMuscoli.jsx).
// Logica pura: niente React, testata in tests/muscoli.test.js.

/** I gruppi muscolari disegnati sulla figura, nell'ordine in cui compaiono negli elenchi */
export const MUSCOLI = [
  { id: 'petto', label: 'Petto' },
  { id: 'deltoidi_ant', label: 'Spalle anteriori' },
  { id: 'deltoidi_lat', label: 'Spalle laterali' },
  { id: 'deltoidi_post', label: 'Spalle posteriori' },
  { id: 'trapezi', label: 'Trapezi' },
  { id: 'schiena_alta', label: 'Schiena alta' },
  { id: 'dorsali', label: 'Dorsali' },
  { id: 'lombari', label: 'Lombari' },
  { id: 'bicipiti', label: 'Bicipiti' },
  { id: 'tricipiti', label: 'Tricipiti' },
  { id: 'avambracci', label: 'Avambracci' },
  { id: 'addominali', label: 'Addominali' },
  { id: 'obliqui', label: 'Obliqui' },
  { id: 'glutei', label: 'Glutei' },
  { id: 'quadricipiti', label: 'Quadricipiti' },
  { id: 'femorali', label: 'Femorali' },
  { id: 'adduttori', label: 'Adduttori' },
  { id: 'polpacci', label: 'Polpacci' },
]
export const LABEL = Object.fromEntries(MUSCOLI.map((m) => [m.id, m.label]))
const IDS = new Set(MUSCOLI.map((m) => m.id))

const r = (re, primari, secondari = []) => ({ re, primari, secondari })

/**
 * Regole sui nomi degli esercizi (quelli della libreria Hevy in italiano, più qualche nome inglese).
 * Vince la PRIMA regola che corrisponde: le più specifiche stanno in alto
 * (es. "leg curl" prima di "curl", "croci inverse" prima di "croci").
 */
const REGOLE = [
  // Non allenano un muscolo in modo misurabile
  r(/stretching|riscaldamento|mobilit|downward dog|cool ?down/, []),

  // Schiena e trazioni
  r(/dead hang/, ['avambracci'], ['dorsali']),
  r(/trazion[ei] scapolar/, ['trapezi', 'schiena_alta'], ['dorsali']),
  r(/braccia dritte|pullover|straight arm/, ['dorsali'], ['tricipiti', 'addominali']),
  r(/trazion|lat pulldown|pull ?-?up|chin ?-?up|lat machine/, ['dorsali', 'bicipiti'], ['schiena_alta', 'avambracci']),
  r(/trx|pulley/, ['dorsali'], ['bicipiti', 'addominali']),
  r(/rematore|\brow\b|t ?-?bar/, ['dorsali', 'schiena_alta'], ['bicipiti', 'deltoidi_post', 'avambracci']),
  r(/scrollat|shrug/, ['trapezi']),

  // Spalle
  r(/croci inverse|deltoide posteriore|face pull|reverse fly|alzate posteriori/, ['deltoidi_post'], ['schiena_alta', 'trapezi']),
  r(/alzat[ae].*lateral|aperture laterali|lateral raise/, ['deltoidi_lat'], ['trapezi']),
  r(/alzat[ae].*frontal|front raise/, ['deltoidi_ant']),
  r(/lento|shoulder press|military|overhead press|arnold/, ['deltoidi_ant'], ['deltoidi_lat', 'tricipiti', 'trapezi']),
  r(/shoulder taps/, ['addominali'], ['deltoidi_ant', 'obliqui']),

  // Petto e tricipiti
  r(/dip su panca|bench dip/, ['tricipiti'], ['deltoidi_ant', 'petto']),
  r(/\bdip/, ['petto', 'tricipiti'], ['deltoidi_ant']),
  r(/piegamenti diamante|diamond/, ['tricipiti', 'petto'], ['deltoidi_ant']),
  r(/piegament|push ?-?up/, ['petto'], ['tricipiti', 'deltoidi_ant', 'addominali']),
  r(/panca|chest press|bench press/, ['petto'], ['tricipiti', 'deltoidi_ant']),
  r(/farfalla|pec deck|\bcroci\b|\bfly|crossover/, ['petto'], ['deltoidi_ant']),
  r(/skull ?crusher|french press|pushdown|push ?down|tricip|kickback/, ['tricipiti']),

  // Gambe (prima di "curl" generico)
  r(/leg curl|curl femorali|nordic/, ['femorali'], ['polpacci']),
  r(/leg extension/, ['quadricipiti']),
  r(/leg press|pressa/, ['quadricipiti', 'glutei'], ['femorali', 'adduttori']),
  r(/stacc.*rumen|rumen.*stacc|\brdl\b|gamba singola|good morning/, ['femorali', 'glutei'], ['lombari', 'avambracci']),
  r(/stacco|deadlift|squat to dl/, ['femorali', 'glutei', 'lombari'], ['quadricipiti', 'trapezi', 'avambracci']),
  r(/hip thrust|ponte glutei|glute bridge|kickback glutei/, ['glutei'], ['femorali']),
  r(/abduzion|clamshell|abductor/, ['glutei']),
  r(/adduzion|adduttor|adductor/, ['adduttori']),
  r(/squat laterale|lateral squat|cossack/, ['quadricipiti', 'adduttori'], ['glutei']),
  r(/affond|lunge|bulgar|step ?down|step ?up/, ['quadricipiti', 'glutei'], ['adduttori', 'femorali']),
  r(/wall ball|thruster/, ['quadricipiti', 'glutei'], ['deltoidi_ant', 'tricipiti']),
  r(/squat/, ['quadricipiti', 'glutei'], ['adduttori', 'lombari']),
  r(/calf|polpacc/, ['polpacci']),
  r(/salto della corda|jump rope|skip/, ['polpacci'], ['quadricipiti']),
  r(/box jump|pogo|bound|salt|jump/, ['quadricipiti', 'polpacci'], ['glutei']),

  // Braccia
  r(/curl|bicipit|martello|hammer/, ['bicipiti'], ['avambracci']),
  r(/polso|wrist|farmer/, ['avambracci'], ['trapezi']),

  // Core e schiena bassa
  r(/iperestension|hyperextension|bird dog|superman/, ['lombari', 'glutei'], ['femorali']),
  r(/russian twist|plank laterale|side plank|obliqu|tocco talloni|heel touch|woodchop/, ['obliqui'], ['addominali']),
  r(/plank|crunch|leg raise|addominal|forbice|sit ?-?up|ab wheel|hollow|dead bug|mountain/, ['addominali'], ['obliqui']),
  r(/ball slam|slam/, ['addominali', 'dorsali'], ['deltoidi_ant', 'tricipiti']),

  // Cardio: lavoro leggero su tutta la gamba
  r(/corsa|run|scale|stair|cyclette|bici|ellittica|camminat/, [], ['quadricipiti', 'femorali', 'glutei', 'polpacci']),
]

const minuscolo = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/**
 * Muscoli di un esercizio: { primari, secondari, riconosciuto }.
 * `override` (facoltativo) = { primari, secondari } da scheda o impostazioni: vince sulle regole.
 */
export function muscoliEsercizio(nome, override) {
  const pulisci = (l) => (l || []).filter((m) => IDS.has(m))
  if (override && (override.primari || override.secondari))
    return { primari: pulisci(override.primari), secondari: pulisci(override.secondari), riconosciuto: true }
  const n = minuscolo(nome)
  const regola = REGOLE.find((x) => x.re.test(n))
  if (!regola) return { primari: [], secondari: [], riconosciuto: false }
  return { primari: [...regola.primari], secondari: [...regola.secondari], riconosciuto: true }
}

/**
 * Tabella degli override: impostazioni.muscoli_esercizi + campo `muscoli` degli esercizi in scheda.
 * Formato: { "Nome esercizio": { primari: [...], secondari: [...] } }
 */
export function overrideMuscoli(scheda, imp) {
  const out = { ...(imp?.muscoli_esercizi || {}) }
  for (const g of scheda?.giorni || []) for (const e of g.esercizi || []) if (e.muscoli) out[e.nome] = e.muscoli
  return out
}

/** Peso di una serie per i muscoli primari e secondari */
export const PESO_PRIMARIO = 1
export const PESO_SECONDARIO = 0.5

/**
 * Serie "pesate" per muscolo: ogni serie conta 1 per i muscoli primari e 0,5 per i secondari.
 * `esercizi` = [{ nome, serie: numero | array }]. Restituisce { carico: { muscolo: serie }, sconosciuti: [nomi] }.
 */
export function caricoMuscoli(esercizi = [], override = {}) {
  const carico = {}
  const sconosciuti = new Set()
  for (const e of esercizi) {
    const n = Array.isArray(e.serie) ? e.serie.length : Number(e.serie) || 0
    if (!n) continue
    const m = muscoliEsercizio(e.nome, override[e.nome])
    if (!m.riconosciuto) sconosciuti.add(e.nome)
    for (const id of m.primari) carico[id] = (carico[id] || 0) + n * PESO_PRIMARIO
    for (const id of m.secondari) if (!m.primari.includes(id)) carico[id] = (carico[id] || 0) + n * PESO_SECONDARIO
  }
  return { carico, sconosciuti: [...sconosciuti] }
}

/**
 * Livello di colore 0-4 per ogni muscolo.
 * - modo 'relativo' (una sessione o un giorno di scheda): in proporzione al muscolo più lavorato;
 * - modo 'settimana' (serie settimanali): soglie fisse 1-2 / 3-5 / 6-9 / 10+, dove 10+ è il volume
 *   settimanale di riferimento per far crescere o mantenere un muscolo.
 */
export const SOGLIE_SETTIMANA = [1, 3, 6, 10]

export function livelli(carico, modo = 'relativo') {
  const out = {}
  const max = Math.max(0, ...Object.values(carico))
  for (const [id, v] of Object.entries(carico)) {
    if (!(v > 0)) continue
    if (modo === 'settimana') out[id] = SOGLIE_SETTIMANA.filter((s) => v >= s).length || 1
    else out[id] = Math.max(1, Math.ceil((v / max) * 4))
  }
  return out
}

/** Muscoli ordinati per carico, per gli elenchi sotto la figura */
export function classifica(carico) {
  return Object.entries(carico)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, serie]) => ({ id, label: LABEL[id], serie }))
}
