import { describe, expect, it } from 'vitest'
import { caricoMuscoli, classifica, livelli, muscoliEsercizio, overrideMuscoli } from '../src/muscoli.js'

const p = (nome) => muscoliEsercizio(nome).primari
const s = (nome) => muscoliEsercizio(nome).secondari

describe('muscoliEsercizio', () => {
  it.each([
    ['Panca Piana (Bilanciere)', ['petto']],
    ['Chest Press (Macchina)', ['petto']],
    ['Farfalla (Pec Deck)', ['petto']],
    ['Croci (Macchina)', ['petto']],
    ['Croci Inverse Deltoide Posteriore (Macchina)', ['deltoidi_post']],
    ['Bicipiti Martello Incrociato', ['bicipiti']],
    ['Curl Bicipiti (Manubrio)', ['bicipiti']],
    ['Leg Curl Sdraiato (Macchina)', ['femorali']],
    ['Leg Extension (Macchina)', ['quadricipiti']],
    ['Lat Pulldown (Cavo)', ['dorsali', 'bicipiti']],
    ['Lat Pulldown Braccia Dritte (Cavo)', ['dorsali']],
    ['Trazione Presa Supina', ['dorsali', 'bicipiti']],
    ['Rematore al cavo da seduto - Impugnatura a V (cavo)', ['dorsali', 'schiena_alta']],
    ['Aperture Laterali (Manubrio)', ['deltoidi_lat']],
    ['Alzata laterale con cavo a braccio singolo', ['deltoidi_lat']],
    ['Lento in Avanti in Piedi (Bilanciere)', ['deltoidi_ant']],
    ['Pushdown Tricipiti', ['tricipiti']],
    ['Skullcrusher (Bilanciere)', ['tricipiti']],
    ['Dip Petto', ['petto', 'tricipiti']],
    ['Dip su Panca', ['tricipiti']],
    ['Piegamenti Diamante', ['tricipiti', 'petto']],
    ['Piegamenti', ['petto']],
    ['Squat (Bilanciere)', ['quadricipiti', 'glutei']],
    ['Goblet Squat', ['quadricipiti', 'glutei']],
    ['Stacco da Terra Rumeno (Bilanciere)', ['femorali', 'glutei']],
    ['Stacco Rumeno a Gamba Singola (Manubrio)', ['femorali', 'glutei']],
    ['Stacco da Terra (Bilanciere)', ['femorali', 'glutei', 'lombari']],
    ['Hip Thrust (Bilanciere)', ['glutei']],
    ['Abduzione Anche (Macchina)', ['glutei']],
    ['Affondo Bulgaro', ['quadricipiti', 'glutei']],
    ['Iperestensione', ['lombari', 'glutei']],
    ['Bird Dog', ['lombari', 'glutei']],
    ['Plank', ['addominali']],
    ['Plank Laterale', ['obliqui']],
    ['Crunch', ['addominali']],
    ['Russian Twist (Con Peso Aggiunto)', ['obliqui']],
    ['Salto della Corda', ['polpacci']],
    ['Box Jump', ['quadricipiti', 'polpacci']],
    ['Corsa', []],
    ['Stretching', []],
  ])('%s', (nome, attesi) => {
    expect(p(nome)).toEqual(attesi)
  })

  it('la corsa lavora le gambe come secondari', () => {
    expect(s('Corsa')).toContain('quadricipiti')
  })

  it('riconosce gli esercizi sconosciuti', () => {
    expect(muscoliEsercizio('Esercizio inventato').riconosciuto).toBe(false)
    expect(muscoliEsercizio('Stretching').riconosciuto).toBe(true)
  })

  it("l'override vince sulle regole e scarta muscoli sconosciuti", () => {
    const m = muscoliEsercizio('Panca Piana', { primari: ['tricipiti', 'naso'], secondari: [] })
    expect(m.primari).toEqual(['tricipiti'])
  })
})

describe('carico e livelli', () => {
  const esercizi = [
    { nome: 'Panca Piana (Bilanciere)', serie: [{}, {}, {}] }, // petto 3, tricipiti 1.5, deltoidi_ant 1.5
    { nome: 'Pushdown Tricipiti', serie: 2 }, // tricipiti 2
    { nome: 'Mistero', serie: 2 },
  ]
  const { carico, sconosciuti } = caricoMuscoli(esercizi)

  it('conta 1 serie per i primari e 0,5 per i secondari', () => {
    expect(carico).toEqual({ petto: 3, tricipiti: 3.5, deltoidi_ant: 1.5 })
    expect(sconosciuti).toEqual(['Mistero'])
  })

  it('livelli relativi: il muscolo più lavorato è 4', () => {
    expect(livelli(carico)).toEqual({ tricipiti: 4, petto: 4, deltoidi_ant: 2 })
  })

  it('livelli settimanali a soglie 1 / 3 / 6 / 10 serie', () => {
    expect(livelli({ a: 0.5, b: 2, c: 4, d: 7, e: 12, f: 0 }, 'settimana')).toEqual({ a: 1, b: 1, c: 2, d: 3, e: 4 })
  })

  it('classifica dal più lavorato', () => {
    expect(classifica(carico).map((x) => x.id)).toEqual(['tricipiti', 'petto', 'deltoidi_ant'])
  })

  it('override da impostazioni e dalla scheda', () => {
    const o = overrideMuscoli(
      { giorni: [{ esercizi: [{ nome: 'X', muscoli: { primari: ['glutei'] } }] }] },
      { muscoli_esercizi: { Y: { primari: ['petto'] } } },
    )
    expect(Object.keys(o).sort()).toEqual(['X', 'Y'])
    expect(caricoMuscoli([{ nome: 'X', serie: 2 }], o).carico).toEqual({ glutei: 2 })
  })
})

import { livelliEsercizio } from '../src/muscoli.js'

describe('collegamento esercizi ↔ muscoli', () => {
  it('contributi: quali esercizi lavorano ogni muscolo', () => {
    const { contributi } = caricoMuscoli([
      { nome: 'Panca Piana (Bilanciere)', serie: 3 },
      { nome: 'Pushdown Tricipiti', serie: 2 },
      { nome: 'Panca Piana (Bilanciere)', serie: 1 },
    ])
    expect(contributi.tricipiti).toEqual([
      { nome: 'Pushdown Tricipiti', serie: 2, primario: true },
      { nome: 'Panca Piana (Bilanciere)', serie: 2, primario: false },
    ])
    expect(contributi.petto).toEqual([{ nome: 'Panca Piana (Bilanciere)', serie: 4, primario: true }])
  })
  it('il campo muscoli di un esercizio in scheda vale come override', () => {
    expect(caricoMuscoli([{ nome: 'Boh', serie: 2, muscoli: { primari: ['polpacci'] } }]).carico).toEqual({ polpacci: 2 })
  })
  it('livelliEsercizio: primari 4, secondari 2', () => {
    expect(livelliEsercizio(muscoliEsercizio('Panca Piana (Bilanciere)'))).toEqual({ petto: 4, tricipiti: 2, deltoidi_ant: 2 })
  })
})
