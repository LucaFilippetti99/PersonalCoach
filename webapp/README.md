# Coach — webapp locale

Webapp React + Vite che legge e scrive direttamente i file JSON della cartella `coach/`
(la cartella padre). Claude e la webapp lavorano sugli stessi file.

## Avvio

Serve Node.js 20.19+ (consigliato 22 LTS): `nvm use` legge `.nvmrc`.

Per la spiegazione tecnica del codice vedi **[ARCHITETTURA.md](ARCHITETTURA.md)**.

```bash
cd webapp
npm install      # solo la prima volta
npm run dev      # apri http://localhost:5173
```

- `npm run dev:rete` → raggiungibile anche dal telefono sulla stessa Wi-Fi (http://IP-del-Mac:5173)
- `npm start` → build ottimizzata + server su http://localhost:4173

## Sezioni

- **Home** — allenamento del giorno (dal calendario), settimana, pasti di oggi, progressi
- **Allenamento** — scheda, storico con import da Hevy, progressi per esercizio, registrazione a mano
- **Cibo** — piano pasti (generato da Claude), lista spesa (spunta → va nel frigo), frigo con scadenze
- **Salute** — peso e vita con media mobile 7 giorni, impostazioni (calendario, target, peso obiettivo, nomi Hevy)
- **Claude** — form che generano il testo da incollare in Cowork (sessione, esercizio fermo, dolore, cibo, progressi…)

## File usati

| File | Chi lo scrive |
|---|---|
| `schede/attuale.json` | Claude |
| `log/allenamenti.json` | webapp / Claude |
| `log/misure.json` | webapp / Claude |
| `piani-pasti/AAAA-Www.json` | Claude (skill piano-pasti-settimanale) |
| `spesa.json`, `frigo.json` | webapp / Claude |
| `impostazioni.json` | webapp |

L'API locale (`server/coachApi.js`) accetta solo questi percorsi e scrive in modo atomico.
