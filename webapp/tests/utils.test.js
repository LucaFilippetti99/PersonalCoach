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
