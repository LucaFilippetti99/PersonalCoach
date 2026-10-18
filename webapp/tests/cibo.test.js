import { describe, expect, it } from 'vitest'
import {
  aggiornaSpesa,
  categoriaAuto,
  chiave,
  compra,
  consumaPasto,
  doveAuto,
  doveDi,
  finito,
  giorniAllaScadenza,
  giorniDaConsiderare,
  ingredientiNecessari,
  nomiIngredienti,
  raggruppaPerReparto,
  ripristinaPasto,
  sempreInCasa,
  statoIngrediente,
  stessoNome,
  testoSpesa,
} from '../src/cibo.js'

const giovedi = new Date(2026, 8, 24) // giovedì 24 settembre 2026, settimana 2026-W39
const pasto = (piatto, ingredienti, extra = {}) => ({
  tipo: 'pranzo',
  piatto,
  ingredienti: ingredienti.map((nome) => ({ nome, porzione: '' })),
  ricetta: [],
  note: '',
  ...extra,
})
const piano = (giorni, settimana = '2026-W39') => ({ settimana, giorni })
const spesaDi = (...nomi) => ({ aggiornata: null, articoli: nomi.map((n) => (typeof n === 'string' ? { nome: n, categoria: 'altro', quantita: '' } : n)) })

describe('nomi', () => {
  it.each([
    ['Uovo', 'uova'],
    ['Zucchina', 'zucchine'],
    ['Pomodori', 'Pomodoro'],
    ['Petto di pollo ', 'petto di  POLLO'],
    ['Caffè', 'caffe'],
  ])('%s = %s', (a, b) => expect(stessoNome(a, b)).toBe(true))
  it('nomi diversi restano diversi', () => {
    expect(stessoNome('Pollo', 'Petto di pollo')).toBe(false)
    expect(stessoNome('Riso', 'Riso basmati')).toBe(false)
    expect(chiave('Tè')).toBe('te')
  })
})

describe('categoria e posto', () => {
  it.each([
    ['Salmone', 'proteine'],
    ['Uova', 'proteine'],
    ['Yogurt greco', 'latticini'],
    ['Lattuga', 'verdure'],
    ['Melanzane', 'verdure'],
    ['Peperoni', 'verdure'],
    ['Mele', 'frutta'],
    ['Riso basmati', 'carboidrati'],
    ['Pane per hamburger', 'carboidrati'],
    ['Granola', 'carboidrati'],
    ['Olio extravergine', 'grassi'],
    ['Ceci in scatola', 'dispensa'],
    ['Passata di pomodoro', 'dispensa'],
    ['Hamburger vegetali', 'proteine'],
    ['Cosa strana', 'altro'],
  ])('%s → %s', (nome, cat) => expect(categoriaAuto(nome)).toBe(cat))
  it('dispensa per carboidrati, grassi e scatolame; frigo per il resto', () => {
    expect(doveAuto('Riso basmati')).toBe('dispensa')
    expect(doveAuto('Olio')).toBe('dispensa')
    expect(doveAuto('Salmone')).toBe('frigo')
    expect(doveAuto('Cosa strana')).toBe('frigo')
    expect(doveDi({ nome: 'Riso basmati', categoria: 'carboidrati' })).toBe('dispensa')
    expect(doveDi({ nome: 'Riso basmati', dove: 'frigo' })).toBe('frigo')
  })
  it('sempre in casa: basta che il nome inizi con la voce', () => {
    const l = ['Sale', 'Olio']
    expect(sempreInCasa("Olio extravergine d'oliva", l)).toBe(true)
    expect(sempreInCasa('sale grosso', l)).toBe(true)
    expect(sempreInCasa('Salmone', l)).toBe(false)
  })
})

describe('stato di un ingrediente', () => {
  const casa = [
    { nome: 'Salmone', categoria: 'proteine' },
    { nome: 'Riso basmati', categoria: 'carboidrati' },
  ]
  const ctx = { casa, spesa: [{ nome: 'Broccoli' }], sempre: ['Olio'] }
  it.each([
    ['salmone', 'frigo'],
    ['Riso basmati', 'dispensa'],
    ['Olio extravergine', 'sempre'],
    ['Broccolo', 'spesa'],
    ['Limone', 'manca'],
  ])('%s → %s', (n, s) => expect(statoIngrediente(n, ctx)).toBe(s))
  it('giorni alla scadenza', () => {
    expect(giorniAllaScadenza('2026-09-25', '2026-09-24')).toBe(1)
    expect(giorniAllaScadenza('2026-09-23', '2026-09-24')).toBe(-1)
    expect(giorniAllaScadenza(null)).toBe(null)
  })
})

describe('pasti da considerare', () => {
  it('settimana corrente da oggi, future tutte, passate nessuna', () => {
    expect(giorniDaConsiderare(piano([], '2026-W39'), giovedi)).toEqual(['giovedì', 'venerdì', 'sabato', 'domenica'])
    expect(giorniDaConsiderare(piano([], '2026-W40'), giovedi)).toHaveLength(7)
    expect(giorniDaConsiderare(piano([], '2026-W38'), giovedi)).toEqual([])
  })
  it('necessari: solo pasti non mangiati, da oggi, non in casa né sempre in casa', () => {
    const p = piano([
      { giorno: 'mercoledì', pasti: [pasto('Ieri', ['Tofu'])] },
      { giorno: 'giovedì', pasti: [pasto('Oggi', ['Salmone', 'Limone', 'Olio evo']), pasto('Fatto', ['Kiwi'], { fatto: true })] },
      { giorno: 'venerdì', pasti: [pasto('Domani', ['limoni', 'Pane'], { tipo: 'cena' })] },
    ])
    const n = ingredientiNecessari(p, { casa: [{ nome: 'Salmone' }], sempre: ['Olio'], oggi: giovedi })
    expect([...n.values()].map((x) => x.nome)).toEqual(['Limone', 'Pane'])
    expect(n.get(chiave('limone')).per).toEqual(['gio · pranzo', 'ven · cena'])
  })
})

describe('spesa automatica', () => {
  const casa = [{ nome: 'Salmone', categoria: 'proteine' }]
  it('aggiunge solo gli ingredienti del pasto modificato che mancano', () => {
    const nuovo = pasto('Salmone al limone', ['Salmone', 'Limone', 'Sale'])
    const altro = pasto('Pasta', ['Pasta'], { tipo: 'cena' })
    const p = piano([{ giorno: 'giovedì', pasti: [nuovo, altro] }])
    const r = aggiornaSpesa({ piano: p, casa, spesa: spesaDi(), sempre: ['Sale'], aggiungiDa: [nuovo], oggi: giovedi })
    expect(r.aggiunti).toEqual(['Limone'])
    expect(r.spesa.articoli).toEqual([{ nome: 'Limone', categoria: 'frutta', quantita: '', auto: true }])
  })
  it('non aggiunge doppioni né cose già in lista (anche al plurale)', () => {
    const nuovo = pasto('X', ['Limone', 'limoni'])
    const r = aggiornaSpesa({ piano: piano([{ giorno: 'giovedì', pasti: [nuovo] }]), spesa: spesaDi('Limoni'), aggiungiDa: [nuovo], oggi: giovedi })
    expect(r.aggiunti).toEqual([])
    expect(r.spesa.articoli).toHaveLength(1)
  })
  it('togliendo un ingrediente o il pasto, l\'articolo automatico esce; quelli scritti a mano restano', () => {
    const spesa = spesaDi({ nome: 'Limone', categoria: 'frutta', auto: true }, { nome: 'Birra', categoria: 'altro' })
    const r = aggiornaSpesa({ piano: piano([{ giorno: 'giovedì', pasti: [] }]), spesa, oggi: giovedi })
    expect(r.tolti).toEqual(['Limone'])
    expect(r.spesa.articoli.map((a) => a.nome)).toEqual(['Birra'])
  })
  it('un articolo automatico che serve ancora a un altro pasto resta', () => {
    const spesa = spesaDi({ nome: 'Limone', auto: true })
    const p = piano([{ giorno: 'sabato', pasti: [pasto('Y', ['Limone'])] }])
    expect(aggiornaSpesa({ piano: p, spesa, oggi: giovedi }).tolti).toEqual([])
  })
  it('spesa della settimana: aggiunge tutto ciò che manca ai pasti da mangiare', () => {
    const p = piano([
      { giorno: 'giovedì', pasti: [pasto('A', ['Limone', 'Salmone'])] },
      { giorno: 'domenica', pasti: [pasto('B', ['Zucchine'])] },
      { giorno: 'lunedì', pasti: [pasto('Passato', ['Tofu'])] },
    ])
    const r = aggiornaSpesa({ piano: p, casa, spesa: spesaDi(), aggiungiDa: 'tutti', oggi: giovedi })
    expect(r.aggiunti).toEqual(['Limone', 'Zucchine'])
  })
  it('se non cambia nulla restituisce la stessa spesa', () => {
    const s = spesaDi('Birra')
    expect(aggiornaSpesa({ piano: piano([]), spesa: s, oggi: giovedi }).spesa).toBe(s)
  })
})

describe('mangiato, comprato, finito', () => {
  const casa = [
    { nome: 'Salmone', categoria: 'proteine', quantita: '1', scadenza: '2026-09-26' },
    { nome: 'Riso basmati', categoria: 'carboidrati', quantita: '' },
    { nome: 'Broccoli', categoria: 'verdure', dove: 'frigo' },
  ]
  const p = pasto('Riso salmone broccoli', ['salmone', 'Riso basmati', 'Broccolo', 'Limone'])

  it('mangiato: esce dal frigo solo ciò che è in frigo, la dispensa resta', () => {
    const r = consumaPasto(p, casa)
    expect(r.tolti).toEqual(['Salmone', 'Broccoli'])
    expect(r.casa.map((a) => a.nome)).toEqual(['Riso basmati'])
    expect(r.pasto.fatto).toBe(true)
    expect(r.pasto.consumati).toHaveLength(2)
  })
  it('togliendo la spunta, rientra quello che era stato tolto', () => {
    const { pasto: fatto, casa: dopo } = consumaPasto(p, casa)
    const r = ripristinaPasto(fatto, dopo)
    expect(r.pasto.fatto).toBeUndefined()
    expect(r.pasto.consumati).toBeUndefined()
    expect(r.casa.map((a) => a.nome).sort()).toEqual(['Broccoli', 'Riso basmati', 'Salmone'])
    expect(r.casa.find((a) => a.nome === 'Salmone').scadenza).toBe('2026-09-26')
  })
  it('mangiato senza niente in frigo: nessun campo consumati', () => {
    const r = consumaPasto(pasto('Fuori', []), casa)
    expect(r.pasto).not.toHaveProperty('consumati')
    expect(r.casa).toBe(casa)
  })
  it('comprato: esce dalla spesa ed entra nel posto giusto', () => {
    const spesa = spesaDi({ nome: 'Pasta', categoria: 'altro', quantita: '1 kg', auto: true }, { nome: 'Yogurt', categoria: 'latticini', quantita: '' })
    const r = compra(spesa.articoli[0], spesa, [], giovedi)
    expect(r.spesa.articoli.map((a) => a.nome)).toEqual(['Yogurt'])
    expect(r.casa).toEqual([{ nome: 'Pasta', categoria: 'carboidrati', quantita: '1 kg', scadenza: null, dove: 'dispensa' }])
    expect(compra(spesa.articoli[1], spesa, [], giovedi).dove).toBe('frigo')
  })
  it('comprato di qualcosa già in casa: niente doppione', () => {
    const spesa = spesaDi('salmone')
    expect(compra(spesa.articoli[0], spesa, casa).casa).toBe(casa)
  })
  it('finito, con o senza ricompra', () => {
    const spesa = spesaDi()
    expect(finito(casa[0], casa, spesa).spesa.articoli).toEqual([])
    const r = finito(casa[0], casa, spesa, true)
    expect(r.casa).toHaveLength(2)
    expect(r.spesa.articoli).toEqual([{ nome: 'Salmone', categoria: 'proteine', quantita: '1' }])
  })
})

describe('lista e suggerimenti', () => {
  it('raggruppa per reparto nell\'ordine del supermercato', () => {
    const g = raggruppaPerReparto([{ nome: 'Yogurt' }, { nome: 'Zucchine' }, { nome: 'Mele', categoria: 'frutta' }, { nome: 'Boh' }])
    expect(g.map((x) => x.categoria)).toEqual(['verdure', 'frutta', 'latticini', 'altro'])
  })
  it('testo da condividere', () => {
    expect(testoSpesa([{ nome: 'Zucchine', quantita: '3' }, { nome: 'Yogurt' }])).toBe('Lista della spesa\n\nVERDURE\n- Zucchine (3)\n\nLATTICINI\n- Yogurt')
    expect(testoSpesa([])).toBe('Lista della spesa vuota')
  })
  it('nomi suggeriti senza doppioni', () => {
    expect(
      nomiIngredienti({ casa: [{ nome: 'Uova' }], spesa: [{ nome: 'uovo' }], sempre: ['Sale'], ricette: [{ ingredienti: [{ nome: 'Riso' }] }] }),
    ).toEqual(['Riso', 'Sale', 'Uova'])
  })
})
