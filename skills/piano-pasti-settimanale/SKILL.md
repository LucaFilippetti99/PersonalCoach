---
name: piano-pasti-settimanale
description: "Crea il piano pasti settimanale di Luca partendo dalla sua lista della spesa (spesa.json), dal frigo (frigo.json) e dal profilo, per una fase di definizione con porzioni indicative e una mini ricetta per piatto. Usala ogni volta che Luca chiede un piano pasti, un menu della settimana, cosa cucinare nei prossimi giorni, come usare la spesa fatta o quello che ha in frigo, o vuole rifare/modificare il piano, anche se non nomina esplicitamente la skill."
---

# Piano pasti settimanale

Il piano viene letto dalla webapp locale di Luca (sezione Cibo), quindi il file JSON deve rispettare lo schema qui sotto alla lettera.

## Input da leggere
1. `profilo.md` — obiettivo, cibi esclusi, preferenze, numero di pasti, integratori.
2. `frigo.json` — cosa c'è già in casa (con eventuali scadenze): va usato per primo.
3. `spesa.json` — la lista della spesa attuale: è la base del piano insieme al frigo.
4. `impostazioni.json` — `target.kcal` e `target.proteine_g`; `calendario` per sapere quali sono i giorni di allenamento.
5. L'ultimo file in `piani-pasti/` — per non ripetere gli stessi piatti.
6. `log/misure.json` — se il trend del peso suggerisce di aggiustare le porzioni.

Se `frigo.json` o `impostazioni.json` non esistono ancora, vai avanti senza.

**Luca modifica i piani anche dalla webapp** (aggiunge, cambia o elimina pasti, li segna come mangiati). Se il file della settimana esiste già, parti da quello: non toccare i pasti con `"fatto": true` e non sovrascrivere i pasti che ha scritto lui, a meno che non te lo chieda; completa solo i giorni o i pasti mancanti.

## Regole
- **Prima il frigo, poi la spesa**: usa per primi gli articoli in `frigo.json`, soprattutto quelli con scadenza vicina. Poi la spesa. Almeno l'80-90% degli ingredienti deve venire da frigo + spesa; ciò che manca va in `da_comprare_extra`, con una breve motivazione.
- **Nomi coerenti**: per gli ingredienti usa lo stesso nome che hanno in `frigo.json` / `spesa.json` (es. "Petto di pollo", non "pollo"), così la webapp riconosce cosa è già in casa.
- **Zero sprechi**: gli ingredienti deperibili (verdure, carne, pesce fresco) vanno usati nei primi giorni. Pianifica gli avanzi furbi: si cucina una volta e si usa due volte.
- **Definizione, deficit moderato**: proteine in ogni pasto principale, tante verdure, carboidrati presenti (più abbondanti nei giorni di allenamento del `calendario`). Niente pasti saltati o piani drastici. Tieni la giornata vicina a `target.kcal` e `target.proteine_g`.
- **Porzioni indicative**: usa misure pratiche (pugno, palmo, cucchiaio, "1 petto medio") con i grammi tra parentesi solo per i carboidrati principali.
- **Varietà**: Luca cucina volentieri ogni giorno, quindi ricette semplici ma diverse, massimo 2 ripetizioni dello stesso piatto a settimana. Puoi riproporre piatti dei piani precedenti che gli sono piaciuti, usando lo stesso nome del piatto (la webapp li raccoglie in un ricettario).
- **Weekend**: Luca mangia fuori nel weekend (almeno una pizza a settimana): non pianificare quei pasti, oppure indica "fuori" nelle note.
- Rispetta sempre i cibi esclusi indicati in `profilo.md`.

## Mini ricetta
Ogni pasto ha il campo `ricetta`: un array di 3-5 passaggi brevi (una riga ciascuno), con tempi di cottura indicativi. Niente passaggi ovvi ("impiatta"). Se un piatto usa avanzi di un giorno precedente, dillo nel primo passaggio.

## Schema del file
```json
{
  "settimana": "AAAA-Www",
  "kcal_giorno_indicative": 2150,
  "giorni": [
    {
      "giorno": "lunedì",
      "pasti": [
        {
          "tipo": "pranzo",
          "piatto": "Riso con pollo e zucchine",
          "ingredienti": [{ "nome": "Riso basmati", "porzione": "1 pugno abbondante (~80 g)" }],
          "ricetta": ["Cuoci il riso in acqua salata (circa 12 min)", "…"],
          "note": "",
          "fatto": true
        }
      ]
    }
  ],
  "da_comprare_extra": [{ "nome": "Limoni", "categoria": "frutta", "quantita": "2", "motivo": "per condire il pesce" }]
}
```
- `giorno`: nome in minuscolo (lunedì … domenica). `tipo`: pranzo, cena, colazione o spuntino.
- `categoria` in `da_comprare_extra`: una tra proteine, carboidrati, verdure, frutta, latticini, grassi, dispensa, altro.
- `fatto` è opzionale: `true` solo per i pasti già mangiati (lo imposta Luca dalla webapp o tu quando ti dice cosa ha mangiato); nei pasti futuri omettilo.
- Non aggiungere altri campi.

## Output
1. Salva il piano in `piani-pasti/AAAA-Www.json` (settimana ISO), rispettando **esattamente** lo schema sopra.
2. In chat mostra un riepilogo breve: una riga per giorno con i piatti principali, poi la lista `da_comprare_extra` e 2-3 consigli di preparazione (cosa cucinare in anticipo). Ricorda a Luca che il piano è già visibile nella webapp, sezione Cibo.