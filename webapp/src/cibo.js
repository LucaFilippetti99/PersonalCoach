// Logica pura di piano pasti ↔ spesa ↔ frigo/dispensa (usata da pages/Cibo.jsx, testata in tests/cibo.test.js).
//
// Regole (volutamente semplici):
// 1. Aggiungi o modifichi un pasto → i suoi ingredienti che non sono in frigo, in dispensa, "sempre in casa"
//    o già in lista finiscono nella spesa (marcati `auto: true`).
// 2. Modifichi o elimini un pasto → gli articoli `auto` che non servono più a nessun pasto ancora da mangiare
//    escono dalla spesa. Gli articoli scritti a mano non si toccano mai.
// 3. "Mangiato" → gli ingredienti del pasto escono dal FRIGO (la dispensa resta). Quello che è stato tolto
//    si ricorda nel pasto (`consumati`), così togliendo la spunta rientra.
// 4. "Comprato" → l'articolo esce dalla spesa ed entra in frigo o in dispensa (in base alla categoria).
import { GIORNI_SETTIMANA, isoDate, isoWeek, weekdayName } from './utils.js'

/* ---------------- Nomi ---------------- */

/** Minuscolo, senza accenti né spazi doppi */
export function pulisciNome(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chiave di confronto: come pulisciNome, ma ogni parola perde la vocale finale,
 * così singolare e plurale coincidono ("uovo" = "uova", "zucchina" = "zucchine", "pomodoro" = "pomodori").
 */
export function chiave(s) {
  return pulisciNome(s)
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/[aeiou]$/, '') : w))
    .join(' ')
}

export const stessoNome = (a, b) => chiave(a) === chiave(b)
export const trova = (lista = [], nome) => lista.find((x) => stessoNome(x.nome, nome))

/* ---------------- Categoria e posto ---------------- */

/** Ordine dei reparti del supermercato: così la lista si legge mentre giri tra gli scaffali */
export const CATEGORIE = ['verdure', 'frutta', 'proteine', 'latticini', 'carboidrati', 'dispensa', 'grassi', 'altro']

// Prima corrispondenza vince: le voci più specifiche stanno in alto
const PAROLE_CATEGORIA = [
  ['grassi', /burro d'arachidi|burro di arachidi|frutta secca|\bnoci\b|mandorl|anacardi|nocciol|pistacch|semi di|avocado|\bolio\b/],
  ['dispensa', /passata|pelati|polpa di pomodoro|\bsugo\b|pesto|tonno in scatola|scatolett|in scatola|\bceci\b|lenticch|\bfagioli\b|\bsale\b|\bpepe\b|spezi|curry|paprika|origano|aceto|miele|zucchero|farina|lievito|\bdado\b|brodo|\bsalsa\b|senape|maionese|ketchup|cacao|caffe|tisan|marmellat|crema spalmabile/],
  ['latticini', /\blatte\b|yogurt|skyr|kefir|formagg|\bfeta\b|mozzarell|ricotta|parmigian|\bgrana\b|stracchino|scamorza|fiocchi di latte|\bburro\b|\bpanna\b|philadelphia|quark/],
  ['proteine', /pollo|tacchino|manzo|vitello|maiale|\bcarne\b|macinat|hamburger|salsicc|prosciutt|bresaola|speck|salmone|tonno|merluzzo|orata|branzino|\bpesce\b|gamber|calamar|polpo|\buov|albume|tofu|tempeh|seitan|legum/],
  ['carboidrati', /\bpasta\b|spaghett|\bpenne\b|fusilli|\briso\b|basmati|\bpane\b|piadin|tortill|\bwrap\b|farro|\borzo\b|quinoa|couscous|cous cous|patat|avena|cereal|gallett|crackers|fette biscottate|gnocchi|tarall|polenta|muesli|granola/],
  ['frutta', /\bmel[ae]\b|banan|\bper[ae]\b|arancia|arance|mandarin|kiwi|fragol|frutti di bosco|mirtill|lampon|\buva\b|limon|\bpesc[ah]e?\b|albicocc|ananas|mango|melone|anguria|prugn|\bfichi\b|frutta/],
  ['verdure', /zucchin|broccol|spinac|insalat|lattug|rucola|pomodor|carot|peperon|melanzan|cipoll|aglio|funghi|cavolfior|cavol|verza|cetriol|fagiolini|asparag|finocch|sedano|porri|zucca|carciof|bietol|radicchi|verdur|minestrone|piselli/],
]

/**
 * Categoria indovinata dal nome (per la spesa); "altro" se non si capisce.
 * Conta prima la parola principale (la prima): "Pane per hamburger" è pane, non carne.
 */
export function categoriaAuto(nome) {
  const n = pulisciNome(nome)
  const cerca = (t) => PAROLE_CATEGORIA.find(([, re]) => re.test(t))?.[0]
  return cerca(n.split(' ')[0]) || cerca(n) || 'altro'
}

/** Dove si mette una cosa comprata: dispensa per carboidrati secchi, grassi e scatolame, frigo per il resto */
export function doveAuto(nome, categoria) {
  const c = categoria && categoria !== 'altro' ? categoria : categoriaAuto(nome)
  return ['carboidrati', 'dispensa', 'grassi'].includes(c) ? 'dispensa' : 'frigo'
}

/** Posto di un articolo di frigo.json (i file vecchi non hanno il campo `dove`) */
export const doveDi = (a) => (a.dove === 'dispensa' || a.dove === 'frigo' ? a.dove : doveAuto(a.nome, a.categoria))

/* ---------------- Sempre in casa ---------------- */

export const SEMPRE_IN_CASA_DEFAULT = ['Sale', 'Pepe', 'Olio', 'Aceto', 'Acqua']

/** "Olio extravergine d'oliva" conta come "Olio": basta che il nome inizi con una voce della lista */
export function sempreInCasa(nome, lista = []) {
  const n = chiave(nome)
  return lista.some((x) => {
    const k = chiave(x)
    return k && (n === k || n.startsWith(k + ' '))
  })
}

/* ---------------- Stato di un ingrediente ---------------- */

/**
 * Dove si trova un ingrediente: 'frigo' | 'dispensa' | 'sempre' | 'spesa' | 'manca'.
 * `casa` = articoli di frigo.json (frigo + dispensa).
 */
export function statoIngrediente(nome, { casa = [], spesa = [], sempre = [] }) {
  const a = trova(casa, nome)
  if (a) return doveDi(a)
  if (sempreInCasa(nome, sempre)) return 'sempre'
  if (trova(spesa, nome)) return 'spesa'
  return 'manca'
}

/** Giorni in cui scade (0 = oggi, negativo = scaduto), null se non c'è scadenza */
export function giorniAllaScadenza(scadenza, oggi = isoDate()) {
  if (!scadenza) return null
  const d = (s) => new Date(`${s}T00:00:00`)
  return Math.round((d(scadenza) - d(oggi)) / 86400000)
}

/* ---------------- Pasti ancora da mangiare ---------------- */

/**
 * Giorni del piano che contano per la spesa: niente per le settimane passate,
 * da oggi in poi per la settimana corrente, tutti per quelle future.
 */
export function giorniDaConsiderare(piano, oggi = new Date()) {
  const sett = piano?.settimana || ''
  const corrente = isoWeek(oggi)
  if (!sett || sett < corrente) return []
  if (sett > corrente) return [...GIORNI_SETTIMANA]
  return GIORNI_SETTIMANA.slice(GIORNI_SETTIMANA.indexOf(weekdayName(oggi)))
}

const etichettaPasto = (giorno, pasto) => `${giorno.slice(0, 3)} · ${pasto.tipo}`

/**
 * Ingredienti che servono ai pasti non ancora mangiati (dei giorni che contano) e che non sono in casa.
 * Restituisce un Map chiave → { nome, per: ['ven · pranzo', …] }.
 */
export function ingredientiNecessari(piano, { casa = [], sempre = [], oggi = new Date() } = {}) {
  const giorni = new Set(giorniDaConsiderare(piano, oggi))
  const out = new Map()
  for (const g of piano?.giorni || []) {
    if (!giorni.has(g.giorno)) continue
    for (const p of g.pasti || []) {
      if (p.fatto) continue
      for (const ing of p.ingredienti || []) {
        if (!ing.nome?.trim() || trova(casa, ing.nome) || sempreInCasa(ing.nome, sempre)) continue
        const k = chiave(ing.nome)
        if (!out.has(k)) out.set(k, { nome: ing.nome.trim(), per: [] })
        out.get(k).per.push(etichettaPasto(g.giorno, p))
      }
    }
  }
  return out
}

/** Per ogni articolo della spesa, a quali pasti serve (per mostrarlo sotto il nome) */
export function perQualiPasti(piano, opts) {
  return ingredientiNecessari(piano, opts)
}

const nuovoArticolo = (nome) => ({ nome, categoria: categoriaAuto(nome), quantita: '', auto: true })

/**
 * Aggiorna la spesa dopo una modifica al piano.
 * - `aggiungiDa`: i pasti di cui aggiungere gli ingredienti mancanti ('tutti' = spesa della settimana,
 *   un array di pasti = solo quelli appena modificati, [] = nessuno);
 * - toglie gli articoli `auto` che non servono più a nessun pasto da mangiare.
 * Restituisce { spesa, aggiunti: [nomi], tolti: [nomi] }.
 */
export function aggiornaSpesa({ piano, casa = [], spesa, sempre = [], aggiungiDa = [], oggi = new Date() }) {
  const servono = ingredientiNecessari(piano, { casa, sempre, oggi })
  const articoli = spesa?.articoli || []
  const tolti = articoli.filter((a) => a.auto && !servono.has(chiave(a.nome))).map((a) => a.nome)
  const tenuti = articoli.filter((a) => !(a.auto && !servono.has(chiave(a.nome))))

  const candidati =
    aggiungiDa === 'tutti'
      ? [...servono.values()].map((x) => x.nome)
      : aggiungiDa.filter((p) => !p.fatto).flatMap((p) => (p.ingredienti || []).map((i) => i.nome))
  const aggiunti = []
  for (const nome of candidati) {
    if (!nome?.trim() || !servono.has(chiave(nome))) continue
    if (trova(tenuti, nome) || aggiunti.some((n) => stessoNome(n, nome))) continue
    aggiunti.push(nome.trim())
  }
  if (!aggiunti.length && !tolti.length) return { spesa, aggiunti, tolti }
  return {
    spesa: { ...spesa, aggiornata: isoDate(oggi), articoli: [...tenuti, ...aggiunti.map(nuovoArticolo)] },
    aggiunti,
    tolti,
  }
}

/* ---------------- Mangiato ---------------- */

/**
 * Segna un pasto come mangiato: gli ingredienti presenti in FRIGO escono dal frigo (la dispensa resta)
 * e vengono ricordati nel pasto (`consumati`). Restituisce { pasto, casa, tolti: [nomi] }.
 */
export function consumaPasto(pasto, casa = []) {
  const consumati = []
  let resto = casa
  for (const ing of pasto.ingredienti || []) {
    const a = trova(resto, ing.nome)
    if (a && doveDi(a) === 'frigo') {
      consumati.push({ ...a })
      resto = resto.filter((x) => x !== a)
    }
  }
  const nuovo = { ...pasto, fatto: true }
  if (consumati.length) nuovo.consumati = consumati
  else delete nuovo.consumati
  return { pasto: nuovo, casa: resto, tolti: consumati.map((a) => a.nome) }
}

/** Toglie la spunta "mangiato": quello che era stato tolto dal frigo rientra (se non c'è già) */
export function ripristinaPasto(pasto, casa = []) {
  const { fatto: _, consumati = [], ...resto } = pasto
  const rientrati = consumati.filter((a) => !trova(casa, a.nome))
  return { pasto: resto, casa: [...casa, ...rientrati], rientrati: rientrati.map((a) => a.nome) }
}

/* ---------------- Comprato e finito ---------------- */

/** "Comprato": esce dalla spesa ed entra in frigo o dispensa. Restituisce { spesa, casa, dove } */
export function compra(articolo, spesa, casa = [], oggi = new Date()) {
  const dove = doveAuto(articolo.nome, articolo.categoria)
  const categoria = articolo.categoria && articolo.categoria !== 'altro' ? articolo.categoria : categoriaAuto(articolo.nome)
  const giaInCasa = trova(casa, articolo.nome)
  const nuovoCasa = giaInCasa
    ? casa
    : [...casa, { nome: articolo.nome, categoria, quantita: articolo.quantita || '', scadenza: null, dove }]
  return {
    spesa: { ...spesa, aggiornata: isoDate(oggi), articoli: spesa.articoli.filter((x) => x !== articolo) },
    casa: nuovoCasa,
    dove: giaInCasa ? doveDi(giaInCasa) : dove,
  }
}

/** "Finito": esce da frigo/dispensa; con `ricompra` torna in spesa (scritto a mano, quindi non sparisce da solo) */
export function finito(articolo, casa, spesa, ricompra = false, oggi = new Date()) {
  const nuovaCasa = casa.filter((x) => x !== articolo)
  if (!ricompra || trova(spesa.articoli, articolo.nome)) return { casa: nuovaCasa, spesa }
  return {
    casa: nuovaCasa,
    spesa: {
      ...spesa,
      aggiornata: isoDate(oggi),
      articoli: [...spesa.articoli, { nome: articolo.nome, categoria: articolo.categoria || categoriaAuto(articolo.nome), quantita: articolo.quantita || '' }],
    },
  }
}

/* ---------------- Lista da condividere ---------------- */

/** La spesa come testo, divisa per reparto: da incollare in WhatsApp o nelle note */
export function testoSpesa(articoli = []) {
  const gruppi = raggruppaPerReparto(articoli)
  if (!gruppi.length) return 'Lista della spesa vuota'
  return [
    'Lista della spesa',
    ...gruppi.flatMap((g) => [
      '',
      g.categoria.toUpperCase(),
      ...g.articoli.map((a) => `- ${a.nome}${a.quantita ? ` (${a.quantita})` : ''}`),
    ]),
  ].join('\n')
}

/** Articoli raggruppati nell'ordine dei reparti; categoria mancante o sconosciuta → indovinata o "altro" */
export function raggruppaPerReparto(articoli = []) {
  const cat = (a) => (CATEGORIE.includes(a.categoria) ? a.categoria : categoriaAuto(a.nome))
  return CATEGORIE.map((c) => ({
    categoria: c,
    articoli: articoli.filter((a) => cat(a) === c).sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
  })).filter((g) => g.articoli.length)
}

/** Nomi da suggerire mentre scrivi un ingrediente: casa, spesa, sempre in casa, ricettario */
export function nomiIngredienti({ casa = [], spesa = [], sempre = [], ricette = [] }) {
  const out = new Map()
  const add = (n) => n?.trim() && !out.has(chiave(n)) && out.set(chiave(n), n.trim())
  casa.forEach((a) => add(a.nome))
  spesa.forEach((a) => add(a.nome))
  sempre.forEach(add)
  ricette.forEach((r) => (r.ingredienti || []).forEach((i) => add(i.nome)))
  return [...out.values()].sort((a, b) => a.localeCompare(b, 'it'))
}
