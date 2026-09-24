import { describe, expect, it } from 'vitest'
import {
  ciclaMuscolo,
  eliminaGiornoScheda,
  erroreGiorno,
  erroreSessione,
  esercizioSchedaForm,
  pulisciEsercizioScheda,
  pulisciSessione,
  rinominaGiornoImpostazioni,
  salvaGiornoScheda,
  salvaSessioneLog,
  sessioneForm,
  sposta,
} from '../src/editor.js'

describe('scheda', () => {
  it('pulisce un esercizio dal form, tenendo i campi extra', () => {
    const e = pulisciEsercizioScheda({ _id: 3, nome: ' Panca ', serie: '3', reps: '6-8', rir: '2', recupero_s: '150', note: ' x ', kg: 47.5 })
    expect(e).toEqual({ nome: 'Panca', serie: 3, reps: '6-8', rir: 2, recupero_s: 150, note: 'x', kg: 47.5 })
  })
  it('scarta esercizi senza nome, RIR vuoto diventa null, muscoli vuoti tolti', () => {
    expect(pulisciEsercizioScheda({ nome: '  ' })).toBe(null)
    const e = pulisciEsercizioScheda({ nome: 'Plank', serie: '0', reps: '', rir: '', recupero_s: '', muscoli: { primari: [], secondari: [] } })
    expect(e).toEqual({ nome: 'Plank', serie: 1, reps: '8-12', rir: null, recupero_s: null, note: '' })
  })
  it('andata e ritorno dal form', () => {
    const orig = { nome: 'Squat', serie: 3, reps: '6-8', rir: 2, recupero_s: 150, note: '', muscoli: { primari: ['glutei'], secondari: [] } }
    expect(pulisciEsercizioScheda(esercizioSchedaForm(orig))).toEqual(orig)
  })
  it('controlli sul giorno', () => {
    expect(erroreGiorno({ nome: '', esercizi: [1] })).toMatch(/nome/)
    expect(erroreGiorno({ nome: 'A', esercizi: [1] }, ['A'])).toMatch(/già/)
    expect(erroreGiorno({ nome: 'A', esercizi: [] })).toMatch(/esercizio/)
    expect(erroreGiorno({ nome: 'A', esercizi: [1] }, ['B'])).toBe(null)
  })
  it('salva, aggiunge ed elimina giorni', () => {
    const s = { nome: 'S', giorni: [{ nome: 'A' }, { nome: 'B' }] }
    expect(salvaGiornoScheda(s, 'A', { nome: 'A2' }).giorni.map((g) => g.nome)).toEqual(['A2', 'B'])
    expect(salvaGiornoScheda(s, null, { nome: 'C' }).giorni.map((g) => g.nome)).toEqual(['A', 'B', 'C'])
    expect(eliminaGiornoScheda(s, 'A').giorni.map((g) => g.nome)).toEqual(['B'])
  })
  it('rinominare un giorno aggiorna calendario e titoli Hevy', () => {
    const imp = { calendario: { lunedì: 'A', martedì: null, mercoledì: 'B' }, hevy_giorni: { Push: 'A', Pull: 'B' }, target: { kcal: 1 } }
    const r = rinominaGiornoImpostazioni(imp, 'A', 'A2')
    expect(r.calendario).toEqual({ lunedì: 'A2', martedì: null, mercoledì: 'B' })
    expect(r.hevy_giorni).toEqual({ Push: 'A2', Pull: 'B' })
    expect(r.target).toEqual({ kcal: 1 })
    const el = rinominaGiornoImpostazioni(imp, 'A', null)
    expect(el.calendario.lunedì).toBe(null)
    expect(el.hevy_giorni).toEqual({ Pull: 'B' })
  })
  it('ciclo dei muscoli personalizzati', () => {
    let m = ciclaMuscolo(undefined, 'petto')
    expect(m).toEqual({ primari: ['petto'], secondari: [] })
    m = ciclaMuscolo(m, 'petto')
    expect(m).toEqual({ primari: [], secondari: ['petto'] })
    m = ciclaMuscolo(m, 'petto')
    expect(m).toEqual({ primari: [], secondari: [] })
  })
  it('sposta', () => {
    expect(sposta([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(sposta([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
  })
})

describe('sessione', () => {
  const s = {
    data: '2026-09-23',
    scheda: 'Storico Hevy',
    giorno: 'Giorno 1',
    esercizi: [
      { nome: 'Squat', serie: [{ kg: 50, reps: 8, rir: null }, { kg: 50, reps: 8, rir: 2 }] },
      { nome: 'Plank', serie: [{ kg: 0, reps: 0, rir: null, secondi: 45 }] },
    ],
    durata_min: 63,
    note: 'ok',
  }
  it('andata e ritorno dal form non cambia nulla', () => {
    expect(pulisciSessione(sessioneForm(s))).toEqual(s)
  })
  it('toglie serie vuote ed esercizi senza serie, converte la virgola', () => {
    const f = sessioneForm(s)
    f.esercizi[0].serie.push({ kg: '52,5', reps: '6', rir: '' }, { kg: '50', reps: '', rir: '' })
    f.esercizi.push({ nome: 'Vuoto', serie: [{ kg: '', reps: '', rir: '' }] })
    const p = pulisciSessione(f)
    expect(p.esercizi[0].serie.at(-1)).toEqual({ kg: 52.5, reps: 6, rir: null })
    expect(p.esercizi.map((e) => e.nome)).toEqual(['Squat', 'Plank'])
  })
  it('controlli', () => {
    expect(erroreSessione({ data: '', giorno: 'x', esercizi: [1] })).toMatch(/data/)
    expect(erroreSessione({ data: '2026-01-01', giorno: '', esercizi: [1] })).toMatch(/nome/)
    expect(erroreSessione({ data: '2026-01-01', giorno: 'x', esercizi: [] })).toMatch(/esercizio/)
  })
  it('salva nel log sostituendo l\'originale e segnala i doppioni', () => {
    const altra = { ...s, data: '2026-09-25', giorno: 'Giorno 2' }
    const log = [s, altra]
    const mod = { ...s, note: 'cambiata' }
    expect(salvaSessioneLog(log, s, mod).log.find((x) => x.data === s.data).note).toBe('cambiata')
    // spostata su data e titolo di un'altra sessione → errore
    expect(salvaSessioneLog(log, s, { ...s, data: '2026-09-25', giorno: 'Giorno 2' }).errore).toMatch(/già/)
    // cambio di data: resta una sola copia, in ordine
    const r = salvaSessioneLog(log, s, { ...s, data: '2026-09-30' }).log
    expect(r.map((x) => x.data)).toEqual(['2026-09-25', '2026-09-30'])
  })
})
