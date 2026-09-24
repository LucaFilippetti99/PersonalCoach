import { describe, expect, it } from 'vitest'
import {
  e1rm,
  exerciseHistory,
  formatSet,
  isoWeek,
  progressStatus,
  tipoEsercizio,
  weeklyAvg,
} from '../src/utils.js'

describe('date', () => {
  it.each([
    ['2026-09-24', '2026-W39'],
    ['2026-01-01', '2026-W01'],
    ['2027-01-01', '2026-W53'],
  ])('isoWeek(%s) = %s', (d, atteso) => {
    const [y, m, g] = d.split('-').map(Number)
    expect(isoWeek(new Date(y, m - 1, g))).toBe(atteso)
  })
})

describe('peso', () => {
  const misure = [
    { data: '2026-09-10', peso_kg: 80 },
    { data: '2026-09-18', peso_kg: 76 },
    { data: '2026-09-20', peso_kg: 75 },
    { data: '2026-09-21', peso_kg: null },
  ]
  it('media sugli ultimi 7 giorni, ignorando i valori nulli', () => {
    expect(weeklyAvg(misure, '2026-09-21')).toBe(75.5)
  })
  it('null se non ci sono pesate nella finestra', () => {
    expect(weeklyAvg(misure, '2026-09-05')).toBeNull()
  })
})

describe('serie ed esercizi', () => {
  it('e1rm con Epley', () => {
    expect(e1rm({ kg: 60, reps: 10 })).toBe(80)
    expect(e1rm({ kg: 60, reps: 0 })).toBe(0)
  })

  it('formatSet per carico, tempo e distanza', () => {
    expect(formatSet({ kg: 50, reps: 8 })).toBe('50×8')
    expect(formatSet({ kg: 0, reps: 12 })).toBe('12 reps')
    expect(formatSet({ kg: 0, reps: 0, secondi: 45 })).toBe('45 s')
    expect(formatSet({ kg: 10, reps: 0, secondi: 120 })).toBe('10 kg × 2:00')
    expect(formatSet({ kg: 0, reps: 0, km: 5.2, secondi: 1710 })).toBe('5,2 km in 28:30')
  })

  it('riconosce il tipo di esercizio', () => {
    expect(tipoEsercizio([{ kg: 50, reps: 8 }])).toBe('carico')
    expect(tipoEsercizio([{ kg: 0, reps: 10 }])).toBe('corpo')
    expect(tipoEsercizio([{ kg: 0, reps: 0, secondi: 40 }])).toBe('tempo')
    expect(tipoEsercizio([{ kg: 0, reps: 0, km: 5 }])).toBe('distanza')
  })

  it('exerciseHistory sceglie la serie migliore per 1RM stimato', () => {
    const log = [
      { data: '2026-09-02', giorno: 'A', esercizi: [{ nome: 'Panca', serie: [{ kg: 60, reps: 5 }, { kg: 55, reps: 10 }] }] },
      { data: '2026-09-01', giorno: 'A', esercizi: [{ nome: 'Squat', serie: [{ kg: 80, reps: 5 }] }] },
    ]
    const h = exerciseHistory(log, 'Panca')
    expect(h).toHaveLength(1)
    expect(h[0].top).toEqual({ kg: 55, reps: 10 })
    expect(h[0].valore).toBe(73.3)
    expect(h[0].volume).toBe(850)
  })
})

describe('progressStatus', () => {
  const oggi = new Date(2026, 8, 30)
  const storia = (valori, date) => valori.map((valore, i) => ({ valore, e1rm: valore, data: date[i] }))
  const recenti = ['2026-09-20', '2026-09-24', '2026-09-28']

  it('su se l’ultima sessione supera le due precedenti', () => {
    expect(progressStatus(storia([60, 61, 63], recenti), oggi)).toBe('su')
  })
  it('fermo se non migliora da 3 sessioni', () => {
    expect(progressStatus(storia([62, 60, 62], recenti), oggi)).toBe('fermo')
  })
  it('ok se oscilla ma non è fermo', () => {
    expect(progressStatus(storia([60, 63, 62], recenti), oggi)).toBe('ok')
  })
  it('ignora lo storico vecchio', () => {
    expect(progressStatus(storia([60, 60, 60], ['2026-05-01', '2026-05-05', '2026-05-09']), oggi)).toBe('vecchio')
    expect(progressStatus(storia([60, 60], recenti), oggi)).toBe('pochi')
    expect(progressStatus([], oggi)).toBe('nessuno')
  })
})

import { giornoScheda, kgDaScheda, parseGiorno, schedaAttiva, settimanaScheda } from '../src/utils.js'

const SCHEDA = {
  inizio: '2026-10-05',
  giorni: [
    { nome: 'Giorno A — Push' },
    { nome: 'Giorno B — Pull' },
    { nome: 'Giorno C — Gambe + spalle' },
    { nome: 'Giorno D — Corsa + corpo libero' },
  ],
}

describe('giorni di scheda', () => {
  it('parseGiorno separa sigla e descrizione', () => {
    expect(parseGiorno('Giorno A — Push')).toEqual({ sigla: 'A', descrizione: 'Push' })
    expect(parseGiorno('Allenamento libero').sigla).toBe(null)
  })

  it.each([
    ['Giorno A — Push', 'Giorno A — Push'],
    ['push', 'Giorno A — Push'],
    ['Giorno B', 'Giorno B — Pull'],
    ['C', 'Giorno C — Gambe + spalle'],
    ['Gambe', 'Giorno C — Gambe + spalle'],
    ['Corsa del sabato', 'Giorno D — Corsa + corpo libero'],
    ['Giorno 1 homemade', null],
    ['Allenamento con Benny', null],
  ])('%s → %s', (titolo, atteso) => {
    expect(giornoScheda(titolo, SCHEDA)).toBe(atteso)
  })

  it("l'alias impostato a mano vince", () => {
    expect(giornoScheda('Giorno 1', SCHEDA, { 'Giorno 1': 'Giorno B — Pull' })).toBe('Giorno B — Pull')
  })

  it('settimana e stato della scheda', () => {
    expect(settimanaScheda(SCHEDA, '2026-10-04')).toBe(0)
    expect(settimanaScheda(SCHEDA, '2026-10-05')).toBe(1)
    expect(settimanaScheda(SCHEDA, '2026-10-12')).toBe(2)
    expect(schedaAttiva(SCHEDA, '2026-09-24')).toBe(false)
    expect(schedaAttiva(SCHEDA, '2026-10-05')).toBe(true)
  })
})

describe('kgDaScheda', () => {
  it('usa il campo kg se presente', () => {
    expect(kgDaScheda({ kg: 42.5, note: 'Sett. 1: 30 kg' })).toBe(42.5)
  })
  it('legge le note, anche con virgola e intervallo', () => {
    expect(kgDaScheda({ note: 'Sett. 1: 47,5 kg. Quando chiudi 3×8, passa a 50 kg.' })).toBe(47.5)
    expect(kgDaScheda({ note: 'Sett. 1: 35-40 kg. Riscaldamento' })).toBe(35)
  })
  it("prende l'indicazione della settimana più recente", () => {
    const t = { note: 'Sett. 1: 40 kg. Sett. 3: 45 kg' }
    expect(kgDaScheda(t, 2)).toBe(40)
    expect(kgDaScheda(t, 4)).toBe(45)
  })
  it('null se non c\'è un carico', () => {
    expect(kgDaScheda({ note: 'Sett. 1: a corpo libero' })).toBe(null)
  })
})

describe('progressStatus con inizio scheda', () => {
  const h = (data, v) => ({ data, e1rm: v, valore: v })
  it('ignora le sessioni prima della scheda', () => {
    const storia = [h('2026-09-01', 60), h('2026-09-08', 58), h('2026-09-15', 57), h('2026-10-06', 55)]
    const oggi = new Date(2026, 9, 7)
    expect(progressStatus(storia, oggi)).toBe('fermo')
    expect(progressStatus(storia, oggi, '2026-10-05')).toBe('pochi')
  })
})

import { etichettaSettimana, lunediSettimana } from '../src/utils.js'

describe('settimane leggibili', () => {
  it('lunediSettimana è coerente con isoWeek', () => {
    for (const w of ['2026-W01', '2026-W39', '2026-W53', '2027-W10']) expect(isoWeek(lunediSettimana(w))).toBe(w)
  })
  it.each([
    ['2026-W39', '21–27 set'],
    ['2026-W40', '28 set – 4 ott'],
    ['esempio-2026-W40.json', '28 set – 4 ott'],
    ['boh', 'boh'],
  ])('%s → %s', (w, atteso) => expect(etichettaSettimana(w)).toBe(atteso))
})

import { formatRecupero } from '../src/utils.js'

describe('formatRecupero', () => {
  it.each([
    [45, '45 s'],
    [59, '59 s'],
    [60, '1 min'],
    [75, '1 min 15 s'],
    [90, '1 min 30 s'],
    [120, '2 min'],
    [150, '2 min 30 s'],
    [180, '3 min'],
    [0, ''],
    [null, ''],
  ])('%s s → "%s"', (s, atteso) => expect(formatRecupero(s).replace(/\u00a0/g, ' ')).toBe(atteso))
  it('non spezza mai numero e unità', () => {
    expect(formatRecupero(150)).toBe('2\u00a0min 30\u00a0s')
  })
})
