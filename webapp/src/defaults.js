// Valori usati quando un file non esiste ancora: verrà creato al primo salvataggio.

export const IMPOSTAZIONI_DEFAULT = {
  calendario: {
    lunedì: 'Giorno A — Push',
    martedì: null,
    mercoledì: 'Giorno B — Pull',
    giovedì: null,
    venerdì: 'Giorno C — Gambe + spalle',
    sabato: 'Giorno D — Corsa + corpo libero',
    domenica: null,
  },
  target: { kcal: 2150, proteine_g: 150 },
  peso_obiettivo_kg: { min: 70, max: 75 },
  hevy_alias: {},
  hevy_giorni: {},
  // Mai aggiunti in spesa da soli ("Olio" vale anche per "Olio extravergine")
  sempre_in_casa: ['Sale', 'Pepe', 'Olio', 'Aceto', 'Acqua'],
}

export const FRIGO_DEFAULT = { aggiornato: null, articoli: [] }

export const SPESA_DEFAULT = { aggiornata: null, articoli: [] }

// Nell'ordine dei reparti del supermercato (vedi CATEGORIE in cibo.js)
export const CATEGORIE_SPESA = ['verdure', 'frutta', 'proteine', 'latticini', 'carboidrati', 'dispensa', 'grassi', 'altro']
