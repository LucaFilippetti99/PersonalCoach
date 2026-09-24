// Modelli di richiesta per Claude.
// Ogni modello descrive un piccolo form (campi) e una funzione `build` che trasforma
// i valori del form + i dati dell'app (ctx) in un prompt da copiare in Cowork.
//
// Per aggiungere un modello: aggiungi un oggetto a MODELLI con
//   id, sezione ('allenamento' | 'cibo' | 'salute' | 'generale'), titolo, descrizione,
//   campi: [{ id, label, tipo: 'text'|'textarea'|'select'|'date'|'number'|'checkbox', opzioni?, default?, placeholder? }]
//   build(valori, ctx) → stringa
// Le opzioni e i default possono essere funzioni di ctx (es. elenco giorni della scheda).

import { addDays, exerciseHistory, formatSets, isExampleSession, isoDate, isoWeek, round1, validWeights, weeklyAvg } from './utils.js'

/** Intestazione comune: dà a Claude il contesto anche in una conversazione nuova */
const INTESTAZIONE =
  'Sei il mio coach di palestra e alimentazione: lavora nella cartella coach, leggi ISTRUZIONI.md e profilo.md prima di rispondere.'

/** Riga vuota di separazione (le stringhe vuote invece vengono scartate: campi non compilati) */
const SEP = Symbol('riga-vuota')
const righe = (...xs) =>
  xs
    .filter((x) => x != null && x !== '' && x !== false)
    .map((x) => (x === SEP ? '' : x))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
const log = (ctx) => (ctx.log || []).filter((s) => !isExampleSession(s))
const giorniScheda = (ctx) => (ctx.scheda?.giorni || []).map((g) => g.nome)
const eserciziScheda = (ctx) => [...new Set((ctx.scheda?.giorni || []).flatMap((g) => g.esercizi.map((e) => e.nome)))]

function ultimeSessioni(ctx, nome, n = 3) {
  return exerciseHistory(log(ctx), nome)
    .slice(-n)
    .map((h) => `- ${h.data}: ${formatSets(h.serie)}`)
    .join('\n')
}

function riepilogoPeso(ctx) {
  const pesi = validWeights(ctx.misure)
  if (!pesi.length) return 'Nessuna pesata registrata.'
  const out = []
  for (let w = 3; w >= 0; w--) {
    const fine = isoDate(addDays(new Date(), -7 * w))
    const m = weeklyAvg(ctx.misure, fine)
    if (m != null) out.push(`- media 7 gg al ${fine}: ${round1(m)} kg`)
  }
  const vite = pesi.filter((p) => p.vita_cm != null)
  if (vite.length) out.push(`- vita: ${vite[0].vita_cm} cm (${vite[0].data}) → ${vite.at(-1).vita_cm} cm (${vite.at(-1).data})`)
  return out.join('\n')
}

export const SEZIONI_PROMPT = [
  { id: 'allenamento', label: 'Allenamento' },
  { id: 'cibo', label: 'Cibo' },
  { id: 'salute', label: 'Salute' },
  { id: 'generale', label: 'Altro' },
]

export const MODELLI = [
  /* ---------------- Allenamento ---------------- */
  {
    id: 'sessione',
    sezione: 'allenamento',
    titolo: 'Com\'è andata la sessione',
    descrizione: 'Dopo aver importato da Hevy: sensazioni e confronto con la volta prima.',
    campi: [
      { id: 'data', label: 'Data', tipo: 'date', default: () => isoDate() },
      { id: 'giorno', label: 'Giorno', tipo: 'select', opzioni: giorniScheda },
      { id: 'energia', label: 'Energia', tipo: 'select', opzioni: ['ottima', 'normale', 'bassa', 'pessima'], default: 'normale' },
      { id: 'note', label: 'Sensazioni, fastidi, cosa è andato storto', tipo: 'textarea', placeholder: 'Es. panca pesante, schiena ok negli RDL' },
      { id: 'importata', label: 'Ho già importato la sessione da Hevy', tipo: 'checkbox', default: true },
    ],
    build: (v) =>
      righe(
        INTESTAZIONE,
        SEP,
        `Ho fatto ${v.giorno || 'la sessione'} il ${v.data}. Energia: ${v.energia}.`,
        v.importata
          ? 'La sessione è già in log/allenamenti.json (import da Hevy).'
          : 'La sessione NON è ancora nel log: la importo da Hevy appena posso, intanto usa le note.',
        v.note && `Note: ${v.note}`,
        SEP,
        'Confrontala con la volta precedente dello stesso giorno e dimmi in 2-3 righe com\'è andata. Se un esercizio è fermo da 2-3 sessioni proponi un aggiustamento.',
      ),
  },
  {
    id: 'fermo',
    sezione: 'allenamento',
    titolo: 'Esercizio fermo',
    descrizione: 'Non sali di carico o ripetizioni: chiedi una soluzione.',
    campi: [
      { id: 'esercizio', label: 'Esercizio', tipo: 'select', opzioni: eserciziScheda },
      { id: 'note', label: 'Cosa senti', tipo: 'textarea', placeholder: 'Es. si pianta sempre alla 3ª serie' },
    ],
    build: (v, ctx) =>
      righe(
        INTESTAZIONE,
        SEP,
        `L'esercizio "${v.esercizio}" è fermo. Ultime sessioni:`,
        ultimeSessioni(ctx, v.esercizio) || '- nessuna sessione registrata',
        v.note && `Note: ${v.note}`,
        SEP,
        'Proponi un aggiustamento (deload, variante o cambio del range di ripetizioni) e aggiorna schede/attuale.json solo dopo che ti ho detto ok.',
      ),
  },
  {
    id: 'dolore',
    sezione: 'allenamento',
    titolo: 'Fastidio o dolore',
    descrizione: 'Ottieni alternative per gli esercizi che danno fastidio.',
    campi: [
      { id: 'zona', label: 'Zona', tipo: 'select', opzioni: ['schiena bassa', 'spalla', 'gomito', 'polso', 'ginocchio', 'anca', 'collo', 'altro'] },
      { id: 'esercizio', label: 'Durante quale esercizio', tipo: 'select', opzioni: (ctx) => ['nessuno in particolare', ...eserciziScheda(ctx)] },
      { id: 'intensita', label: 'Intensità (1-10)', tipo: 'number', default: 3 },
      { id: 'da', label: 'Da quanto tempo', tipo: 'text', placeholder: 'Es. da 2 sessioni' },
      { id: 'note', label: 'Descrizione', tipo: 'textarea' },
    ],
    build: (v) =>
      righe(
        INTESTAZIONE,
        SEP,
        `Ho un fastidio in zona ${v.zona} (intensità ${v.intensita}/10)${v.da ? `, ${v.da}` : ''}.`,
        v.esercizio !== 'nessuno in particolare' && `Lo sento soprattutto durante: ${v.esercizio}.`,
        v.note && `Descrizione: ${v.note}`,
        SEP,
        'Proponi alternative o modifiche per la prossima sessione. Se ti sembra una cosa da far vedere a un professionista, dimmelo chiaramente.',
      ),
  },
  {
    id: 'modifica-scheda',
    sezione: 'allenamento',
    titolo: 'Modifica la scheda',
    descrizione: 'Cambiare esercizi, serie, ripetizioni o giorni.',
    campi: [
      { id: 'giorno', label: 'Giorno', tipo: 'select', opzioni: (ctx) => ['tutta la scheda', ...giorniScheda(ctx)] },
      { id: 'cosa', label: 'Cosa vuoi cambiare', tipo: 'textarea', placeholder: 'Es. togli i dip e metti le croci ai cavi' },
      { id: 'hevy', label: 'Usa i nomi degli esercizi di Hevy', tipo: 'checkbox', default: true },
    ],
    build: (v) =>
      righe(
        INTESTAZIONE,
        SEP,
        `Voglio modificare ${v.giorno === 'tutta la scheda' ? 'la scheda' : `il ${v.giorno}`}: ${v.cosa || '(descrivi)'}.`,
        'Dimmi se ha senso; se sì aggiorna schede/attuale.json rispettando lo schema.',
        v.hevy && 'Usa per gli esercizi i nomi della libreria di Hevy in italiano, così posso copiarli nelle routine.',
      ),
  },
  {
    id: 'nuova-scheda',
    sezione: 'allenamento',
    titolo: 'Nuova scheda',
    descrizione: 'A fine ciclo: programma il blocco successivo.',
    campi: [
      { id: 'giorni', label: 'Giorni a settimana', tipo: 'select', opzioni: ['3', '3 + corsa', '4', '4 + corsa', '5'], default: '3 + corsa' },
      { id: 'durata', label: 'Durata sessione (min)', tipo: 'number', default: 60 },
      { id: 'settimane', label: 'Settimane', tipo: 'number', default: 5 },
      { id: 'piaciuto', label: 'Cosa ti è piaciuto della scheda attuale', tipo: 'textarea' },
      { id: 'non', label: 'Cosa cambieresti', tipo: 'textarea' },
    ],
    build: (v, ctx) =>
      righe(
        INTESTAZIONE,
        SEP,
        `La scheda "${ctx.scheda?.nome ?? 'attuale'}" è finita. Programmami la prossima: ${v.giorni} giorni a settimana, sessioni da ${v.durata} minuti, ${v.settimane} settimane.`,
        v.piaciuto && `Mi è piaciuto: ${v.piaciuto}`,
        v.non && `Cambierei: ${v.non}`,
        SEP,
        'Guarda i progressi in log/allenamenti.json, proponi la scheda e, dopo il mio ok, salvala in schede/attuale.json (archivia la vecchia in schede/ con il suo nome). Usa i nomi degli esercizi di Hevy.',
      ),
  },

  /* ---------------- Cibo ---------------- */
  {
    id: 'settimana-cibo',
    sezione: 'cibo',
    titolo: 'Aggiorna cosa ho mangiato',
    descrizione: 'Pasti fatti, pasti fuori in programma e cosa è rimasto in frigo.',
    campi: [
      { id: 'mangiato', label: 'Cosa hai mangiato', tipo: 'textarea', placeholder: 'Es. martedì cena: insalata con feta e ceci' },
      { id: 'programma', label: 'Pasti già decisi / fuori casa nei prossimi giorni', tipo: 'textarea', placeholder: 'Es. sabato pizza fuori' },
      { id: 'frigo', label: 'Cosa è rimasto in frigo', tipo: 'textarea', default: (ctx) => (ctx.frigo?.articoli || []).map((a) => a.nome).join(', ') },
      { id: 'piano', label: 'Completa il piano per i giorni che mancano', tipo: 'checkbox', default: true },
    ],
    build: (v) =>
      righe(
        INTESTAZIONE,
        SEP,
        `Aggiornamento cibo della settimana ${isoWeek()}.`,
        v.mangiato && `Ho mangiato:\n${v.mangiato}`,
        v.programma && `Già deciso per i prossimi giorni:\n${v.programma}`,
        v.frigo && `In frigo è rimasto: ${v.frigo}`,
        SEP,
        'Aggiorna frigo.json con quello che è rimasto e metti in spesa.json quello che manca.',
        v.piano &&
          `Aggiorna piani-pasti/${isoWeek()}.json: segna i pasti già fatti con "fatto": true e completa i giorni mancanti con la skill piano-pasti-settimanale, usando prima il frigo.`,
      ),
  },
  {
    id: 'piano-pasti',
    sezione: 'cibo',
    titolo: 'Nuovo piano pasti',
    descrizione: 'Il piano della settimana con mini ricette, partendo da frigo e spesa.',
    campi: [
      { id: 'settimana', label: 'Settimana', tipo: 'select', opzioni: () => [isoWeek(), isoWeek(addDays(new Date(), 7))] },
      { id: 'fuori', label: 'Pasti fuori casa', tipo: 'textarea', placeholder: 'Es. giovedì cena fuori, sabato pizza' },
      { id: 'voglia', label: 'Hai voglia di… / da evitare questa settimana', tipo: 'textarea' },
    ],
    build: (v) =>
      righe(
        INTESTAZIONE,
        SEP,
        `Usa la skill piano-pasti-settimanale: crea il piano per la settimana ${v.settimana} partendo da frigo.json e spesa.json, con una mini ricetta per ogni piatto.`,
        v.fuori && `Pasti fuori casa (non pianificarli): ${v.fuori}`,
        v.voglia && `Preferenze per questa settimana: ${v.voglia}`,
      ),
  },
  {
    id: 'spesa',
    sezione: 'cibo',
    titolo: 'Prepara la lista della spesa',
    descrizione: 'Lista per i prossimi giorni in base a piano e frigo.',
    campi: [
      { id: 'giorni', label: 'Per quanti giorni', tipo: 'number', default: 5 },
      { id: 'dove', label: 'Dove fai la spesa', tipo: 'text', placeholder: 'Es. supermercato sotto casa' },
      { id: 'note', label: 'Note', tipo: 'textarea' },
    ],
    build: (v) =>
      righe(
        INTESTAZIONE,
        SEP,
        `Preparami la lista della spesa per ${v.giorni} giorni guardando l'ultimo piano in piani-pasti/ e frigo.json.`,
        v.dove && `Faccio la spesa: ${v.dove}.`,
        v.note && `Note: ${v.note}`,
        'Salvala in spesa.json (categorie: proteine, carboidrati, verdure, frutta, latticini, grassi, dispensa, altro).',
      ),
  },

  /* ---------------- Salute ---------------- */
  {
    id: 'progressi',
    sezione: 'salute',
    titolo: 'Check dei progressi',
    descrizione: 'Peso e misure delle ultime settimane: serve un aggiustamento?',
    campi: [
      { id: 'fame', label: 'Fame / energia in generale', tipo: 'select', opzioni: ['tutto ok', 'ho spesso fame', 'poca energia', 'dormo male'], default: 'tutto ok' },
      { id: 'domanda', label: 'Domanda', tipo: 'textarea', placeholder: 'Es. sto calando troppo piano?' },
    ],
    build: (v, ctx) =>
      righe(
        INTESTAZIONE,
        SEP,
        'Check dei progressi. Dati dalla webapp:',
        riepilogoPeso(ctx),
        `Target attuali: ~${ctx.imp?.target?.kcal ?? '?'} kcal, ${ctx.imp?.target?.proteine_g ?? '?'} g proteine.`,
        `Sensazioni: ${v.fame}.`,
        v.domanda && `Domanda: ${v.domanda}`,
        SEP,
        'Controlla anche log/misure.json e dimmi se il ritmo è giusto per la definizione; se serve proponi un aggiustamento di calorie o attività.',
      ),
  },
  {
    id: 'profilo',
    sezione: 'salute',
    titolo: 'Aggiorna il profilo',
    descrizione: 'Cambia obiettivi, preferenze, cibi esclusi o abitudini.',
    campi: [{ id: 'cosa', label: 'Cosa è cambiato', tipo: 'textarea', placeholder: 'Es. ora mi alleno anche il sabato mattina' }],
    build: (v) => righe(INTESTAZIONE, SEP, `Aggiorna profilo.md: ${v.cosa || '(descrivi)'}`, 'Dimmi se questo cambia qualcosa nella scheda o nella dieta.'),
  },

  /* ---------------- Altro ---------------- */
  {
    id: 'libera',
    sezione: 'generale',
    titolo: 'Domanda libera',
    descrizione: 'Qualsiasi cosa, con il contesto del coach.',
    campi: [{ id: 'testo', label: 'Domanda', tipo: 'textarea' }],
    build: (v) => righe(INTESTAZIONE, SEP, v.testo || ''),
  },
]

export function valoriIniziali(modello, ctx) {
  const out = {}
  for (const c of modello.campi) {
    const opz = typeof c.opzioni === 'function' ? c.opzioni(ctx) : c.opzioni
    const def = typeof c.default === 'function' ? c.default(ctx) : c.default
    out[c.id] = def ?? (c.tipo === 'select' ? (opz?.[0] ?? '') : c.tipo === 'checkbox' ? false : '')
  }
  return out
}
