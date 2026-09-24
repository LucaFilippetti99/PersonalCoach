import { describe, expect, it } from 'vitest'
import { MODELLI, SEZIONI_PROMPT, valoriIniziali } from '../src/prompts.js'

const ctx = {
  scheda: {
    nome: 'Scheda test',
    giorni: [{ nome: 'Giorno A', esercizi: [{ nome: 'Panca' }] }],
  },
  log: [{ data: '2026-09-20', giorno: 'Giorno A', scheda: 'Scheda test', esercizi: [{ nome: 'Panca', serie: [{ kg: 50, reps: 8 }] }] }],
  misure: [{ data: '2026-09-20', peso_kg: 75, vita_cm: 84 }],
  imp: { target: { kcal: 2150, proteine_g: 150 } },
  frigo: { articoli: [{ nome: 'Salmone' }] },
  spesa: { articoli: [] },
}

describe('modelli per Claude', () => {
  it('ogni modello ha id unico e una sezione valida', () => {
    const ids = MODELLI.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    const sezioni = SEZIONI_PROMPT.map((s) => s.id)
    for (const m of MODELLI) expect(sezioni).toContain(m.sezione)
  })

  it.each(MODELLI.map((m) => [m.id, m]))('%s genera un prompt pulito con i valori iniziali', (_, m) => {
    const testo = m.build(valoriIniziali(m, ctx), ctx)
    expect(testo.startsWith('Sei il mio coach')).toBe(true)
    expect(testo).not.toMatch(/undefined|null|NaN|\[object/)
    expect(testo).not.toMatch(/\n{3,}/)
  })

  it('"Esercizio fermo" include le ultime sessioni', () => {
    const m = MODELLI.find((x) => x.id === 'fermo')
    const testo = m.build({ esercizio: 'Panca', note: '' }, ctx)
    expect(testo).toContain('- 2026-09-20: 50×8')
  })

  it('"Aggiorna cosa ho mangiato" precompila il frigo', () => {
    const m = MODELLI.find((x) => x.id === 'settimana-cibo')
    expect(valoriIniziali(m, ctx).frigo).toBe('Salmone')
  })
})
