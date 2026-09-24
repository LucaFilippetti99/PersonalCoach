# Coach: architettura della webapp

Documento tecnico per orientarsi nel codice: cosa fa ogni file, come passano i dati, dove mettere le mani per le modifiche più comuni.

---

## 1. Idea generale

La webapp è una **Single Page Application React** servita da **Vite** in locale. Non c'è database: **i dati sono i file JSON della cartella `coach/`**, gli stessi che legge e scrive Claude in Cowork.

```
                ┌──────────────── cartella coach/ ────────────────┐
                │  schede/attuale.json   log/allenamenti.json     │
   Claude  ───► │  log/misure.json       piani-pasti/*.json       │ ◄─── webapp (browser)
  (Cowork)      │  spesa.json  frigo.json  impostazioni.json      │        │
                │  profilo.md  ISTRUZIONI.md                      │        │ fetch /api/...
                └──────────────────────────▲──────────────────────┘        ▼
                                           │                     ┌───────────────────┐
                                           └──── fs (Node) ──────│ server/coachApi.js│
                                                                 │ (plugin di Vite)  │
                                                                 └───────────────────┘
```

- Il **browser** non può scrivere su disco, quindi parla con una **mini API HTTP** (`/api/...`).
- L'API è un **plugin di Vite** (`server/coachApi.js`): gira dentro lo stesso processo Node di `npm run dev` / `npm start`, niente server separato.
- **Claude** modifica i file direttamente; la webapp li **rilegge quando la finestra torna in primo piano** (evento `focus`), quindi le modifiche compaiono da sole.

### Stack

| Cosa | Scelta | Perché |
|---|---|---|
| UI | React 19, componenti a funzione + hooks | standard, nessuna libreria extra |
| Build / dev server | Vite 8 | veloce; il plugin ospita anche l'API |
| Routing | hash (`#/sezione?param=…`) fatto a mano | 30 righe, nessuna dipendenza |
| Stato | un hook per file JSON (`useJson`) | i file *sono* lo stato: niente Redux/Context |
| Grafici | SVG scritto a mano | due grafici semplici, nessuna libreria |
| Stile | un solo `styles.css` con variabili CSS | tema chiaro/scuro automatico |
| Persistenza | file JSON su disco + `localStorage` solo per le bozze | |

Dipendenze runtime: solo `react` e `react-dom`. Dev: `vite`, `@vitejs/plugin-react`, `vitest`. Requisito: **Node ≥ 20.19** (vedi `.nvmrc`).

---

## 2. Struttura delle cartelle

```
coach/
├── ISTRUZIONI.md, profilo.md        ← contesto per Claude (la webapp legge solo profilo.md)
├── schede/attuale.json              ← scheda di allenamento corrente
├── log/allenamenti.json             ← sessioni (import Hevy o inserite a mano)
├── log/misure.json                  ← peso e vita
├── piani-pasti/AAAA-Www.json        ← un piano per settimana ISO
├── spesa.json, frigo.json           ← lista della spesa e dispensa
├── impostazioni.json                ← calendario, target, alias Hevy (lo crea la webapp)
├── skills/                          ← copia della skill piano-pasti-settimanale
└── webapp/
    ├── index.html                   ← punto di ingresso HTML (+ meta per l'installazione come app)
    ├── public/                      ← manifest.webmanifest e icone (servite così come sono)
    ├── tests/                       ← test Vitest di hevy.js, utils.js, prompts.js
    ├── vite.config.js               ← config Vite + registrazione del plugin API
    ├── package.json, .nvmrc
    ├── server/
    │   └── coachApi.js              ← API locale che legge/scrive i JSON
    └── src/
        ├── main.jsx                 ← monta <App/>
        ├── App.jsx                  ← layout, barra di navigazione, routing
        ├── nav.js                   ← navigate(sezione, parametri)
        ├── api.js                   ← fetch verso l'API + hook useJson
        ├── hooks.js                 ← un hook per ogni file di dati
        ├── defaults.js              ← valori di default per file non ancora creati
        ├── utils.js                 ← date, medie peso, progressi, 1RM…
        ├── hevy.js                  ← parser del CSV di Hevy → sessioni
        ├── prompts.js               ← modelli della pagina "Chiedi a Claude"
        ├── styles.css               ← tutto lo stile
        ├── components/
        │   ├── ui.jsx               ← Card, Tabs, Stat, Icon, Empty, toast…
        │   ├── WeightChart.jsx      ← grafico peso + media 7 gg + fascia obiettivo
        │   ├── TrendChart.jsx       ← grafico generico a una serie (progressi)
        │   └── RestTimer.jsx        ← timer di recupero
        └── pages/
            ├── Home.jsx
            ├── Allenamento.jsx      ← Scheda, Storico+Import, Progressi, A mano
            ├── Cibo.jsx             ← Piano pasti, Spesa, Frigo
            ├── Salute.jsx           ← Peso e misure, Impostazioni
            └── Claude.jsx           ← form → prompt da copiare
```

---

## 3. Backend: `server/coachApi.js`

Plugin Vite che aggiunge un middleware su `configureServer` (dev) e `configurePreviewServer` (preview). `root` è la cartella `coach/`, calcolata in `vite.config.js` come cartella padre di `webapp/`.

| Metodo | Endpoint | Cosa fa |
|---|---|---|
| `GET` | `/api/file?path=<rel>` | restituisce il JSON; **204** se il file non esiste ancora |
| `PUT` | `/api/file?path=<rel>` | valida il body come JSON e lo scrive (indentato a 2 spazi) |
| `GET` | `/api/list?dir=<dir>` | elenco dei `.json` in `piani-pasti`, `schede` o `log` |
| `GET` | `/api/profilo` | `{ testo }` con il contenuto di `profilo.md` (sola lettura) |

**Sicurezza** (è solo locale, ma comunque):
- `ALLOWED` è una whitelist di regex: solo `log/*.json`, `schede/*.json`, `piani-pasti/*.json`, `spesa.json`, `frigo.json`, `impostazioni.json`. Tutto il resto → 403.
- `safePath` rifiuta `..` e verifica che il percorso risolto resti dentro `root`.
- Scrittura **atomica**: scrive `file.tmp-<pid>` e poi `rename`, così un crash non lascia file a metà.

> Con `npm run dev:rete` (`vite --host`) l'API è raggiungibile da tutta la rete Wi-Fi, **senza autenticazione**. Usalo solo su reti di cui ti fidi.

Per aggiungere un nuovo file di dati: aggiungi la regex in `ALLOWED`, un default in `defaults.js` e un hook in `hooks.js`.

---

## 4. Frontend

### 4.1 Avvio e routing: `main.jsx`, `App.jsx`, `nav.js`

- `main.jsx` monta `<App/>` in `StrictMode` e importa `styles.css`.
- `App.jsx` definisce `SEZIONI` (id, etichetta, icona) e legge l'hash: `#/cibo?tab=frigo` → `{ id: 'cibo', params: { tab: 'frigo' } }`.
- `<main key={window.location.hash}>`: cambiando hash la pagina **si rimonta**, quindi ogni pagina può leggere `params` solo nello stato iniziale (es. la tab da aprire).
- `navigate(id, params)` (in `nav.js`) cambia l'hash. Esempio: `navigate('claude', { t: 'fermo' })`.

**Aggiungere una sezione:** crea `pages/Nuova.jsx`, aggiungila a `SEZIONI` e al blocco di render in `App.jsx`, eventualmente un'icona in `components/ui.jsx` (`PATHS`).

### 4.2 Accesso ai dati: `api.js`, `hooks.js`, `defaults.js`

`useJson(path, fallback)` è il cuore dello stato:

```js
const { data, save, reload, loading, error } = useJson('log/misure.json', [])
```

- al mount fa `GET`; se il file non esiste usa una copia di `fallback`;
- si ricarica su `window.focus` (così vedi le modifiche fatte da Claude);
- `save(next)` aggiorna subito lo stato locale (UI ottimistica) e poi fa `PUT`; in caso di errore imposta `error` e rilancia l'eccezione.

`hooks.js` espone un hook per file (`useScheda`, `useLog`, `useMisure`, `useSpesa`, `useFrigo`, `useImpostazioni`) più `usePianiList()`, che elenca i piani e sceglie quello della settimana corrente (o il più recente). `useImpostazioni` unisce i valori salvati con `IMPOSTAZIONI_DEFAULT`, così le chiavi nuove hanno sempre un valore.

> Ogni componente che chiama un hook fa la sua `fetch`: più componenti sulla stessa pagina possono leggere lo stesso file. Con file così piccoli è accettabile; se crescesse, si potrebbe introdurre un Context/cache condivisa.

### 4.3 Logica pura: `utils.js`, `hevy.js`, `prompts.js`

Funzioni senza React, testabili anche con Node (`node -e "import('./src/utils.js')…"`).

**`utils.js`**
- Date: `isoDate`, `parseDate`, `addDays`, `weekdayName`, `startOfWeek`, `isoWeek` (settimana ISO `AAAA-Www`), `formatDate`. Le date sono sempre stringhe `AAAA-MM-GG` in ora **locale** (non UTC), per evitare slittamenti di giorno.
- Peso: `validWeights` (scarta righe con peso `null`), `weeklyAvg(misure, data)` = media delle pesate dei 7 giorni che finiscono in `data`.
- Allenamento: `topSet`, `lastExercise`, `formatSet`/`formatSets` ("50×8", "12 reps", "45 s", "5,2 km in 28:30"), `isExampleSession` (riconosce la sessione di esempio del template).
  - `tipoEsercizio(serie)` → `carico` (kg×reps), `corpo` (solo reps), `tempo` (secondi), `distanza` (km). `TIPO_INFO` dà etichetta e unità per i grafici.
- Progressi:
  - `e1rm(serie)` = 1RM stimato con la formula di **Epley**: `kg × (1 + reps/30)`.
  - `exerciseHistory(log, nome)` → una voce per sessione con `tipo`, serie migliore (`top`), `valore` e volume (`Σ kg×reps`). Il valore dipende dal tipo: 1RM stimato (carico), ripetizioni massime (corpo libero), secondi massimi (tempo), km (distanza).
  - `progressStatus(storia)` considera solo le sessioni delle **ultime 6 settimane** e restituisce `su`, `ok`, `fermo` (ultime 3 senza miglioramento), `pochi`, `vecchio`, `nessuno`.

**`hevy.js`**: import dell'export CSV di Hevy
1. `parseCsv(text)`: parser CSV minimale (virgolette, `""` escapato, a capo nei campi) → array di oggetti per colonna.
2. `parseHevyDate(s)`: gestisce `"23 set 2026, 19:55"` (italiano), `"Sep 23, 2026, 7:55 PM"` (inglese) e ISO.
3. `hevyToSessions(rows, { alias, nomeScheda })`:
   - raggruppa le righe (una per serie) per `title + start_time` = un allenamento;
   - rinomina gli esercizi con la mappa `alias` (Impostazioni → Nomi Hevy);
   - **salta** le serie `warmup` e quelle vuote; le serie a tempo o distanza (plank, corsa) diventano `reps: 0` con `secondi` / `km`;
   - `failure` → `rir: 0`; se c'è l'RPE → `rir = 10 − RPE`;
   - `durata_min` = fine − inizio; `note` = descrizione + note degli esercizi;
   - `scheda` = nome della scheda attiva in quella data (o `"Storico Hevy"`).
4. `mergeLog(log, importate)`: la chiave di una sessione è `data|giorno` (giorno = titolo dell'allenamento in Hevy). Le sessioni con la stessa chiave vengono **sostituite**, le altre (anche quelle inserite a mano) restano. Per questo reimportare tutto lo storico è sicuro.

**`prompts.js`**: modelli per "Chiedi a Claude". Ogni modello:

```js
{
  id: 'fermo', sezione: 'allenamento', titolo: 'Esercizio fermo', descrizione: '…',
  campi: [{ id: 'esercizio', label: 'Esercizio', tipo: 'select', opzioni: (ctx) => [...] }, …],
  build: (valori, ctx) => 'testo del prompt',
}
```

`ctx` contiene tutti i dati caricati (`scheda, log, misure, imp, frigo, spesa`), così il prompt può includere dati veri (es. le ultime 3 sessioni di un esercizio). `righe(...)` compone il testo scartando i campi vuoti; `SEP` è una riga vuota voluta. **Per aggiungere un modello basta aggiungere un oggetto a `MODELLI`**: la UI si genera da sola.

### 4.4 Componenti: `components/`

- `ui.jsx`: `Icon` (SVG inline, set in `PATHS`), `Card`, `Tabs`, `Stat`, `Empty`, `PageHeader`, `ErrorBanner`, `useFlash()` (toast: `const [node, flash] = useFlash(); flash('Salvato')`).
- `WeightChart.jsx`: peso giornaliero (punti grigi) + media mobile 7 gg (linea) + fascia obiettivo; `ResizeObserver` per la larghezza, crosshair con tooltip su mouse/touch.
- `TrendChart.jsx`: versione generica a una serie (`punti: [{ data, valore, dettaglio }]`), usata nei Progressi. Il passo dell'asse Y si sceglie tra valori "tondi" (1, 2, 2.5, 5…).
- `RestTimer.jsx`: countdown in basso a partire da un timestamp di fine (resta preciso anche se il tab va in background), vibrazione e beep a fine recupero.

### 4.5 Pagine: `pages/`

| Pagina | Componenti interni | Legge | Scrive |
|---|---|---|---|
| `Home.jsx` | n/a | scheda, log, misure, impostazioni, frigo, piano corrente | n/a |
| `Allenamento.jsx` | `SchedaView`, `Storico`, `ImportHevy`, `Progressi`, `Registra` | scheda, log, impostazioni | log |
| `Cibo.jsx` | `Piano`, `Spesa`, `Frigo` | piani, spesa, frigo | spesa, frigo |
| `Salute.jsx` | `Peso`, `Impostazioni`, `AliasForm` | misure, impostazioni, scheda, profilo.md | misure, impostazioni |
| `Claude.jsx` | `Form`, `ChiediClaude` (pulsanti rapidi usati nelle altre pagine) | tutto | nessuno (copia negli appunti) |

Dettagli utili:
- **Home**: l'allenamento del giorno arriva da `impostazioni.calendario[giorno della settimana]`; i progressi dei fondamentali (`ESERCIZI_CHIAVE`) confrontano solo le ultime 6 settimane.
- **Registra (a mano)**: il form si costruisce dalla scheda (`buildForm`), precompila i kg dall'ultima sessione (`emptySets`) e salva una **bozza in `localStorage`** (chiave `coach-bozza:<data>:<giorno>`) a ogni modifica. Al salvataggio vengono tenute solo le serie con le ripetizioni compilate.
- **Spesa → Frigo**: spuntare un articolo lo toglie da `spesa.json` e lo aggiunge a `frigo.json`; "finito, rimetti in lista" fa il contrario.
- **Piano pasti**: ogni ingrediente viene confrontato per nome (senza maiuscole) con frigo e spesa per mostrare le etichette *frigo* / *spesa*. Per questo la skill chiede a Claude di usare gli stessi nomi.

### 4.6 Stile: `styles.css`

- Tutti i colori sono **variabili CSS** in `:root`, ridefinite in `@media (prefers-color-scheme: dark)`. Per cambiare il colore principale modifica `--accent`.
- Layout: contenuto max 1080 px; sotto i 760 px la navigazione diventa una barra in basso (`.nav` fixed) e le griglie vanno a una colonna.
- Il file è diviso per sezioni commentate (`/* ---------- Home ---------- */` ecc.).

---

## 5. Schemi dei dati

Tutte le date sono `AAAA-MM-GG`. Non aggiungere campi senza aggiornare anche la webapp (e `ISTRUZIONI.md`).

**`schede/attuale.json`**
```json
{ "nome": "Scheda 1 — …", "inizio": "2026-09-28", "settimane": 5,
  "giorni": [ { "nome": "Giorno A — Push",
    "esercizi": [ { "nome": "Panca Piana (Bilanciere)", "serie": 3, "reps": "6-8", "rir": 2, "recupero_s": 150, "note": "" } ] } ] }
```
I nomi degli esercizi sono quelli della **libreria di Hevy**, così l'import li riconosce.

**`log/allenamenti.json`**: array di sessioni
```json
[ { "data": "2026-09-23", "scheda": "Storico Hevy", "giorno": "Giorno 1",
    "esercizi": [ { "nome": "Squat (Bilanciere)", "serie": [ { "kg": 50, "reps": 8, "rir": null } ] },
                  { "nome": "Plank", "serie": [ { "kg": 0, "reps": 0, "rir": null, "secondi": 45 } ] } ],
    "durata_min": 63, "note": "" } ]
```
Campi opzionali di una serie: `secondi` (esercizi a tempo) e `km` (esercizi a distanza). Negli esercizi a corpo libero `kg` è 0.

**`log/misure.json`**: `[ { "data", "peso_kg", "vita_cm", "note" } ]`

**`piani-pasti/AAAA-Www.json`**
```json
{ "settimana": "2026-W39", "kcal_giorno_indicative": 2150,
  "giorni": [ { "giorno": "venerdì", "pasti": [ { "tipo": "pranzo", "piatto": "…",
      "ingredienti": [ { "nome": "Salmone", "porzione": "1 trancio" } ],
      "ricetta": [ "passo 1", "passo 2" ], "note": "" } ] } ],
  "da_comprare_extra": [ { "nome": "…", "categoria": "proteine", "quantita": "2", "motivo": "…" } ] }
```

**`spesa.json`**: `{ "aggiornata", "articoli": [ { "nome", "categoria", "quantita" } ] }`
**`frigo.json`**: `{ "aggiornato", "articoli": [ { "nome", "categoria", "quantita", "scadenza" } ] }`

**`impostazioni.json`**
```json
{ "calendario": { "lunedì": "Giorno A — Push", "martedì": null, … },
  "target": { "kcal": 2150, "proteine_g": 150 },
  "peso_obiettivo_kg": { "min": 70, "max": 75 },
  "hevy_alias": { "Nome in Hevy": "Nome in scheda" } }
```

---

## 6. Flussi principali

**Import da Hevy**
`ImportHevy` → `file.text()` → `parseCsv` → `hevyToSessions` (con alias e nome scheda) → anteprima (`mergeLog` per contare nuove/aggiornate) → conferma → `save(log)` → `PUT /api/file?path=log/allenamenti.json`.

**Chiedi a Claude**
`Claude.jsx` carica tutti i dati → `valoriIniziali(modello, ctx)` → a ogni modifica `modello.build(valori, ctx)` rigenera il testo (a meno che tu non l'abbia ritoccato a mano) → `navigator.clipboard.writeText`.

**Claude aggiorna un file**
Claude scrive su disco → torni sulla finestra della webapp → evento `focus` → `useJson` rifà la `GET` → la UI si aggiorna.

---

## 7. Comandi

```bash
nvm use            # Node 22 (da .nvmrc)
npm install        # prima volta (e dopo ogni modifica a package.json)
npm run dev        # sviluppo con hot reload: http://localhost:5173
npm run dev:rete   # come sopra, raggiungibile dal telefono sulla stessa rete
npm start          # build di produzione + preview: http://localhost:4173
npm test           # esegue i test una volta
npm run test:watch # test in modalità watch mentre modifichi il codice
```

### Test

I test (Vitest) sono in `tests/` e coprono la logica pura:
- `hevy.test.js`: parser CSV, date in italiano/inglese, conversione in sessioni (riscaldamento, failure/RPE, serie a tempo e distanza, alias, durata), merge idempotente;
- `utils.test.js`: settimane ISO, media peso, 1RM, formattazione delle serie, tipo di esercizio, stato di progressione;
- `prompts.test.js`: ogni modello di "Chiedi a Claude" genera un testo pulito (niente `undefined`, niente righe vuote doppie).

Quando cambi una di queste funzioni, lancia `npm test`. Per un nuovo caso aggiungi un `it(...)` nel file giusto.

### Installazione sul telefono (PWA)

`public/manifest.webmanifest`, le icone e i meta in `index.html` permettono di aggiungere la webapp alla schermata Home e aprirla a schermo intero. Non c'è un service worker: funzionerebbe solo su `localhost` o HTTPS, non sull'indirizzo di rete in HTTP, e comunque senza il Mac acceso i dati non sarebbero raggiungibili. La webapp si ricarica i dati anche su `visibilitychange`, così quando la riapri dalla Home vedi i dati aggiornati.

Con `npm run dev` ogni modifica ai file in `src/` si vede subito nel browser (HMR). Le modifiche a `server/coachApi.js` o `vite.config.js` richiedono il riavvio.

---

## 8. Dove mettere le mani

| Voglio… | File |
|---|---|
| aggiungere una richiesta per Claude | `src/prompts.js` → `MODELLI` (+ il test la copre da solo) |
| cambiare icona o nome dell'app sul telefono | `public/` + `public/manifest.webmanifest` |
| cambiare le regole di "fermo / in crescita" | `src/utils.js` → `progressStatus` |
| cambiare cosa si importa da Hevy (es. tenere il riscaldamento) | `src/hevy.js` → `hevyToSessions` |
| cambiare i fondamentali mostrati in Home | `src/pages/Home.jsx` → `ESERCIZI_CHIAVE` |
| aggiungere una categoria della spesa | `src/defaults.js` → `CATEGORIE_SPESA` |
| cambiare colori / tema | `src/styles.css` → variabili in `:root` |
| aggiungere un file di dati | `server/coachApi.js` (`ALLOWED`) + `defaults.js` + `hooks.js` |
| aggiungere una sezione | `src/App.jsx` (`SEZIONI`) + `src/pages/` |

---

## 9. Limiti noti e idee

- I test coprono la logica pura, non i componenti React (si potrebbe aggiungere Testing Library).
- Ogni hook fa la sua richiesta: nessuna cache condivisa tra componenti.
- La sessione è identificata da `data + titolo`: due allenamenti con lo stesso titolo nello stesso giorno collidono.
- L'API non ha autenticazione: va bene su `localhost`, meno con `dev:rete`.
- Nel form "A mano" non si inseriscono serie a tempo/distanza (quelle importate vengono comunque conservate).
- Possibili evoluzioni: sincronizzazione automatica con l'API di Hevy (serve Hevy PRO), un modello AI locale per il piano pasti.
