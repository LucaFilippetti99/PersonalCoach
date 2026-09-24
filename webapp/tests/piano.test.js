import { describe, expect, it } from 'vitest'
import {
  conTuttiIGiorni,
  ingredientiInFrigo,
  ingredientiMancanti,
  ordinaPasti,
  pianoVuoto,
  pulisciPasto,
  ricettario,
} from '../src/piano.js'

const pasto = (piatto, ingredienti = [], extra = {}) => ({
  tipo: 'pranzo',
  piatto,
  ingredienti: ingredienti.map((nome) => ({ nome, porzione: '1' })),
  ricetta: [],
  note: '',
  ...extra,
})

describe('piano pasti', () => {
  it('pianoVuoto ha 7 giorni in ordine', () => {
    const p = pianoVuoto('2026-W40', 2150)
    expect(p.giorni.map((g) => g.giorno)).toEqual(['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'])
    expect(p.kcal_giorno_indicative).toBe(2150)
  })

  it('conTuttiIGiorni aggiunge i giorni mancanti senza perdere i pasti', () => {
    const p = conTuttiIGiorni({ settimana: 'x', giorni: [{ giorno: 'venerdì', pasti: [pasto('Riso')] }] })
    expect(p.giorni).toHaveLength(7)
    expect(p.giorni[4].pasti[0].piatto).toBe('Riso')
  })

  it('ordinaPasti mette colazione, pranzo, spuntino, cena', () => {
    const o = ordinaPasti([{ tipo: 'cena' }, { tipo: 'colazione' }, { tipo: 'spuntino' }, { tipo: 'pranzo' }])
    expect(o.map((p) => p.tipo)).toEqual(['colazione', 'pranzo', 'spuntino', 'cena'])
  })

  it('ricettario: solo piatti con ingredienti, ultima versione, ordine alfabetico', () => {
    const piani = [
      { giorni: [{ giorno: 'lunedì', pasti: [pasto('Riso e pollo', ['Riso']), pasto('Pizza fuori')] }] },
      { giorni: [{ giorno: 'martedì', pasti: [pasto('riso e pollo', ['Riso', 'Pollo']), pasto('Avocado toast', ['Pane'])] }] },
    ]
    const r = ricettario(piani)
    expect(r.map((x) => x.piatto)).toEqual(['Avocado toast', 'riso e pollo'])
    expect(r[1].ingredienti).toHaveLength(2)
  })

  it('ingredienti mancanti e in frigo (senza maiuscole)', () => {
    const p = pasto('Salmone', ['Salmone', 'Broccoli', 'Limone'])
    const frigo = [{ nome: 'salmone' }]
    const spesa = [{ nome: 'Broccoli' }]
    expect(ingredientiMancanti(p, frigo, spesa)).toEqual(['Limone'])
    expect(ingredientiInFrigo(p, frigo)).toEqual(['Salmone'])
  })

  it('pulisciPasto toglie righe vuote e trasforma la ricetta in array', () => {
    const p = pulisciPasto({
      tipo: 'cena',
      piatto: '  Piadina ',
      ingredienti: [{ nome: 'Piadina', porzione: '1 ' }, { nome: ' ', porzione: '' }],
      ricetta: 'Scalda la piadina\n\n  Farcisci ',
      note: '',
      fatto: true,
    })
    expect(p).toEqual({
      tipo: 'cena',
      piatto: 'Piadina',
      ingredienti: [{ nome: 'Piadina', porzione: '1' }],
      ricetta: ['Scalda la piadina', 'Farcisci'],
      note: '',
      fatto: true,
    })
  })
})
