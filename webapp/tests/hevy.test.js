import { describe, expect, it } from 'vitest'
import { hevyToSessions, mergeLog, parseCsv, parseHevyDate } from '../src/hevy.js'

// Estratto nel formato reale dell'export di Hevy (una riga per serie)
const HEAD =
  '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"'
const CSV = [
  HEAD,
  '"Giorno 1","23 set 2026, 19:55","23 set 2026, 20:58","Nuovo ciclo","Squat (Bilanciere)",,"Sceso più in basso",0,"warmup",20,10,,,',
  '"Giorno 1","23 set 2026, 19:55","23 set 2026, 20:58","Nuovo ciclo","Squat (Bilanciere)",,"Sceso più in basso",1,"normal",50,8,,,',
  '"Giorno 1","23 set 2026, 19:55","23 set 2026, 20:58","Nuovo ciclo","Squat (Bilanciere)",,"Sceso più in basso",2,"failure",50,6,,,',
  '"Giorno 1","23 set 2026, 19:55","23 set 2026, 20:58","Nuovo ciclo","Plank",,"",0,"normal",,,,45,',
  '"Giorno 1","23 set 2026, 19:55","23 set 2026, 20:58","Nuovo ciclo","Stretching",,"",0,"normal",,,,,',
  '"Corsa, ""lenta""","24 set 2026, 07:10","24 set 2026, 07:40","","Corsa",,"",0,"normal",,,5.2,1710,',
  '"Giorno 2","Sep 25, 2026, 7:05 PM","Sep 25, 2026, 8:00 PM","","Panca Piana (Bilanciere)",,"",1,"normal",50,7,,,8',
  '"Giorno 2","Sep 25, 2026, 7:05 PM","Sep 25, 2026, 8:00 PM","","Panca Piana (Bilanciere)",,"",0,"normal",50,8,,,',
].join('\n')

describe('parseCsv', () => {
  it('legge intestazione, campi vuoti e virgolette escapate', () => {
    const rows = parseCsv(CSV)
    expect(rows).toHaveLength(8)
    expect(rows[0].exercise_title).toBe('Squat (Bilanciere)')
    expect(rows[0].superset_id).toBe('')
    expect(rows[5].title).toBe('Corsa, "lenta"')
  })

  it('ignora il BOM iniziale', () => {
    const rows = parseCsv('﻿"a","b"\n1,2')
    expect(rows).toEqual([{ a: '1', b: '2' }])
  })
})

describe('parseHevyDate', () => {
  it.each([
    ['23 set 2026, 19:55', { data: '2026-09-23', minuti: 19 * 60 + 55 }],
    ['Sep 25, 2026, 7:05 PM', { data: '2026-09-25', minuti: 19 * 60 + 5 }],
    ['Sep 25, 2026, 12:10 AM', { data: '2026-09-25', minuti: 10 }],
    ['2026-01-02T08:30:00Z', { data: '2026-01-02', minuti: 8 * 60 + 30 }],
  ])('%s', (input, atteso) => {
    expect(parseHevyDate(input)).toEqual(atteso)
  })

  it('restituisce null per formati sconosciuti', () => {
    expect(parseHevyDate('ieri sera')).toBeNull()
    expect(parseHevyDate('')).toBeNull()
  })
})

describe('hevyToSessions', () => {
  const { sessioni, saltate } = hevyToSessions(parseCsv(CSV), {
    nomeScheda: (d) => (d >= '2026-09-24' ? 'Scheda 1' : 'Storico Hevy'),
    alias: { 'Panca Piana (Bilanciere)': 'Panca' },
  })

  it('raggruppa per allenamento e ordina per data', () => {
    expect(sessioni.map((s) => s.data)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25'])
    expect(sessioni[0].giorno).toBe('Giorno 1')
  })

  it('salta riscaldamento e serie vuote', () => {
    expect(saltate).toBe(2)
    const squat = sessioni[0].esercizi.find((e) => e.nome === 'Squat (Bilanciere)')
    expect(squat.serie).toHaveLength(2)
    expect(sessioni[0].esercizi.some((e) => e.nome === 'Stretching')).toBe(false)
  })

  it('failure → RIR 0, RPE 8 → RIR 2', () => {
    expect(sessioni[0].esercizi[0].serie[1].rir).toBe(0)
    expect(sessioni[2].esercizi[0].serie[1].rir).toBe(2)
  })

  it('tiene le serie a tempo e a distanza', () => {
    expect(sessioni[0].esercizi.find((e) => e.nome === 'Plank').serie[0]).toMatchObject({ reps: 0, secondi: 45 })
    expect(sessioni[1].esercizi[0].serie[0]).toMatchObject({ km: 5.2, secondi: 1710 })
  })

  it('applica alias, ordina le serie per set_index e calcola la durata', () => {
    const panca = sessioni[2].esercizi[0]
    expect(panca.nome).toBe('Panca')
    expect(panca.serie.map((s) => s.reps)).toEqual([8, 7])
    expect(sessioni[0].durata_min).toBe(63)
    expect(sessioni[2].durata_min).toBe(55)
  })

  it('assegna la scheda in base alla data e unisce le note', () => {
    expect(sessioni[0].scheda).toBe('Storico Hevy')
    expect(sessioni[1].scheda).toBe('Scheda 1')
    expect(sessioni[0].note).toBe('Nuovo ciclo | Squat (Bilanciere): Sceso più in basso')
  })
})

describe('mergeLog', () => {
  const vecchio = [
    { data: '2026-09-01', giorno: 'A mano', scheda: 'x', esercizi: [] },
    { data: '2026-09-23', giorno: 'Giorno 1', scheda: 'x', esercizi: [], note: 'vecchia' },
    { data: '2026-09-28', giorno: 'Giorno A — Upper', scheda: 'Esempio — da sostituire', esercizi: [] },
  ]
  const nuove = [{ data: '2026-09-23', giorno: 'Giorno 1', scheda: 'x', esercizi: [], note: 'nuova' }]

  it('sostituisce le sessioni uguali, tiene le altre, rimuove gli esempi', () => {
    const r = mergeLog(vecchio, nuove, (s) => /esempio/i.test(s.scheda))
    expect(r.aggiunte).toBe(0)
    expect(r.aggiornate).toBe(1)
    expect(r.log.map((s) => s.note ?? s.giorno)).toEqual(['A mano', 'nuova'])
  })

  it('reimportare due volte dà lo stesso risultato', () => {
    const una = mergeLog(vecchio, nuove).log
    const due = mergeLog(una, nuove).log
    expect(due).toEqual(una)
  })
})

describe('hevyToSessions con giorni di scheda', () => {
  it('rinomina il titolo col giorno di scheda, così coincide con le sessioni inserite a mano', () => {
    const { sessioni } = hevyToSessions(parseCsv(CSV), {
      giorno: (titolo, data) => (data === '2026-09-23' ? 'Giorno A — Push' : null),
    })
    expect(sessioni[0].giorno).toBe('Giorno A — Push')
    expect(sessioni[1].giorno).not.toBe('Giorno A — Push') // null → resta il titolo originale
    const manuale = { data: '2026-09-23', giorno: 'Giorno A — Push', esercizi: [] }
    const { log, aggiornate } = mergeLog([manuale], sessioni)
    expect(aggiornate).toBe(1)
    expect(log.filter((s) => s.data === '2026-09-23')).toHaveLength(1)
  })
})
