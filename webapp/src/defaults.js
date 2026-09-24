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
}

export const FRIGO_DEFAULT = { aggiornato: null, articoli: [] }

export const SPESA_DEFAULT = { aggiornata: null, articoli: [] }

export const CATEGORIE_SPESA = ['proteine', 'carboidrati', 'verdure', 'frutta', 'latticini', 'grassi', 'dispensa', 'altro']
