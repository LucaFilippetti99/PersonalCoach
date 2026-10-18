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
| Stato | un hook per file JSON (`useJson`) con cache condivisa | i file *sono* lo stato: niente Redux/Context |
| Grafici | SVG scritto a mano | due grafici semplici, nessuna libreria |
| Stile | un solo `styles.css` con variabili CSS | tema automatico, chiaro o scuro (a scelta) |
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
├── spesa.json, frigo.json           ← lista della spesa; frigo + dispensa (campo `dove`)
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
        ├── api.js                   ← fetch verso l'API, cache condivisa + hook useJson
        ├── tema.js                  ← tema Automatico / Chiaro / Scuro (localStorage + data-theme)
        ├── clipboard.js             ← copia negli appunti (anche senza HTTPS, dal telefono)
        ├── hooks.js                 ← un hook per ogni file di dati
        ├── defaults.js              ← valori di default per file non ancora creati
        ├── utils.js                 ← date, medie peso, progressi, 1RM…
        ├── hevy.js                  ← parser del CSV di Hevy → sessioni
        ├── editor.js                ← logica dei pop-up di modifica (giorni di scheda, sessioni)
        ├── muscoli.js               ← esercizio → muscoli, serie per muscolo, livelli di colore
        ├── piano.js                 ← logica del piano pasti (ricettario, ingredienti mancanti…)
        ├── cibo.js                  ← regole piano ↔ spesa ↔ frigo/dispensa
        ├── prompts.js               ← modelli della pagina "Chiedi a Claude"
        ├── styles.css               ← tutto lo stile
        ├── components/
        │   ├── ui.jsx               ← Card, Tabs, Stat, Icon, Empty, toast…
        │   ├── WeightChart.jsx      ← grafico peso + media 7 gg + fascia obiettivo
        │   ├── TrendChart.jsx       ← grafico generico a una serie (progressi)
        │   ├── RestTimer.jsx        ← timer di recupero (+ sbloccaAudio per iPhone)
        │   ├── EserciziMappa.jsx    ← elenco esercizi + mappa collegati, ChipMuscoli
        │   ├── EditorGiorno.jsx     ← pop-up: modifica/crea un giorno della scheda
        │   ├── EditorSessione.jsx   ← pop-up: modifica una sessione dello storico
        │   ├── MappaMuscoli.jsx     ← figura fronte/retro con i muscoli colorati
        │   ├── corpo.js             ← disegno SVG della figura (metà sinistra, specchiata)
        │   ├── useWidth.js          ← larghezza di un elemento per i grafici
        │   └── useWakeLock.js       ← schermo acceso durante la registrazione
        └── pages/
            ├── Home.jsx
            ├── Allenamento.jsx      ← Scheda, Storico+Import, Progressi, A mano
            ├── Cibo.jsx             ← piano, spesa, frigo e dispensa nella stessa pagina
            ├── Salute.jsx           ← Peso e misure, Impostazioni
            └── Claude.jsx           ← form → prompt da copiare
```

---

## 3. Backend: `server/coachApi.js`

Plugin Vite che aggiunge un middleware su `configureServer` (dev) e `configurePreviewServer` (preview). `root` è la cartella `coach/`, calcolata in `vite.config.js` come cartella padre di `webapp/`.

| Metodo | Endpoint | Cosa fa |
|---|---|---|
| `GET` | `/api/file?path=<rel>` | restituisce il JSON e la versione nell'header `X-Mtime`; **204** se il file non esiste ancora |
| `PUT` | `/api/file?path=<rel>` | valida il body come JSON e lo scrive (indentato a 2 spazi); risponde `{ ok, mtime }`. Con l'header `X-If-Mtime` risponde **409** se il file è cambiato dopo la lettura |
| `GET` | `/api/list?dir=<dir>` | elenco dei `.json` in `piani-pasti`, `schede` o `log` |
| `GET` | `/api/profilo` | `{ testo }` con il contenuto di `profilo.md` (sola lettura) |

**Sicurezza** (è solo locale, ma comunque):
- `ALLOWED` è una whitelist di regex: solo `log/*.json`, `schede/*.json`, `piani-pasti/*.json`, `spesa.json`, `frigo.json`, `impostazioni.json`. Tutto il resto → 403.
- `safePath` rifiuta `..` e verifica che il percorso risolto resti dentro `root`.
- Scrittura **atomica**: scrive `file.tmp-<pid>` e poi `rename`, così un crash non lascia file a metà.
- **Niente modifiche perse**: la versione di un file è la sua data di modifica (`mtimeMs`). La webapp manda in `X-If-Mtime` la versione che aveva letto; se nel frattempo Claude ha riscritto il file, il `PUT` viene rifiutato (409) invece di sovrascrivere il lavoro di Claude. `'none'` indica un file che non esisteva.

> Con `npm run dev:rete` (`vite --host`) l'API è raggiungibile da tutta la rete Wi-Fi, **senza autenticazione**. Usalo solo su reti di cui ti fidi.

Per aggiungere un nuovo file di dati: aggiungi la regex in `ALLOWED`, un default in `defaults.js` e un hook in `hooks.js`.

---

## 4. Frontend

### 4.1 Avvio e routing: `main.jsx`, `App.jsx`, `nav.js`

- `main.jsx` monta `<App/>` in `StrictMode` e importa `styles.css`.
- `App.jsx` definisce `SEZIONI` (id, etichetta, icona) e legge l'hash: `#/cibo?tab=frigo` → `{ id: 'cibo', params: { tab: 'frigo' } }`.
- `<main key={window.location.hash}>`: cambiando hash la pagina **si rimonta**, quindi ogni pagina può leggere `params` solo nello stato iniziale (es. la tab da aprire).
- `navigate(id, params)` (in `nav.js`) cambia l'hash. Esempio: `navigate('claude', { t: 'fermo' })`.
- `ricordaTab(tab)` (chiamata da `Tabs`) scrive la tab aperta nell'hash con `history.replaceState`, senza rimontare la pagina: ricaricando riapri la stessa tab.

**Aggiungere una sezione:** crea `pages/Nuova.jsx`, aggiungila a `SEZIONI` e al blocco di render in `App.jsx`, eventualmente un'icona in `components/ui.jsx` (`PATHS`).

### 4.2 Accesso ai dati: `api.js`, `hooks.js`, `defaults.js`

`useJson(path, fallback)` è il cuore dello stato:

```js
const { data, save, reload, loading, error } = useJson('log/misure.json', [])
```

- **una sola copia dei dati per file**, condivisa da tutti i componenti (cache in `api.js`): se l'import da Hevy salva il log, lo storico sotto si aggiorna subito;
- al primo uso fa `GET`; se il file non esiste usa una copia di `fallback`;
- quando la finestra torna in primo piano (`focus` o `visibilitychange`) si rileggono tutti i file in uso, così vedi le modifiche fatte da Claude;
- `save(next)` aggiorna subito la cache (UI ottimistica) e poi fa `PUT` con la versione letta. I salvataggi dello stesso file sono **in fila**: ognuno usa la versione restituita dal precedente;
- se il server risponde 409 (file cambiato da Claude), i dati vengono ricaricati, `error` spiega cosa è successo e `save` rilancia l'eccezione: l'ultima modifica va ripetuta sui dati aggiornati. Gli altri errori impostano `error` e rilanciano;
- `saveFile(path, data)` fa lo stesso fuori dai componenti (es. creare il piano della settimana).

`hooks.js` espone un hook per file (`useScheda`, `useLog`, `useMisure`, `useSpesa`, `useFrigo`, `useImpostazioni`) più `usePianiList()`, che elenca i piani e sceglie quello della settimana corrente (o il più recente). `useImpostazioni` unisce i valori salvati con `IMPOSTAZIONI_DEFAULT`, così le chiavi nuove hanno sempre un valore.

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

**`cibo.js`**: regole che tengono allineati piano, spesa, frigo e dispensa (volutamente semplici)
1. Aggiungi o modifichi un pasto → gli ingredienti che non sono in frigo/dispensa, né "sempre in casa", né già in lista vanno in spesa con `auto: true` (`aggiornaSpesa` con `aggiungiDa: [pasto]`).
2. Modifichi, elimini o mangi un pasto → gli articoli `auto` che non servono più a nessun pasto da mangiare escono dalla spesa. Gli articoli senza `auto` (scritti a mano) non si toccano.
3. "Mangiato" → `consumaPasto`: escono dal frigo (non dalla dispensa) gli ingredienti del pasto e si ricordano in `consumati`; togliendo la spunta `ripristinaPasto` li rimette.
4. "Comprato" → `compra`: fuori dalla spesa, dentro frigo o dispensa (`doveAuto`: carboidrati, grassi e scatolame in dispensa).
- Pasti che contano (`giorniDaConsiderare`): per la settimana corrente da oggi in poi, per le future tutti, per le passate nessuno.
- Nomi: `chiave()` = minuscolo, senza accenti, ogni parola senza vocale finale → singolare = plurale ("uovo" = "uova"); "pollo" ≠ "petto di pollo".
- `categoriaAuto(nome)`: reparto indovinato da parole chiave, prima sulla parola principale ("Pane per hamburger" = carboidrati). `CATEGORIE` è nell'ordine dei reparti del supermercato.
- `sempreInCasa(nome, lista)`: "Olio" copre anche "Olio extravergine"; lista in `impostazioni.sempre_in_casa`.
- Altro: `statoIngrediente` (frigo / dispensa / sempre / spesa / manca), `giorniAllaScadenza`, `ingredientiNecessari` (con "per quali pasti"), `finito`, `raggruppaPerReparto`, `testoSpesa` (lista da copiare), `nomiIngredienti` (suggerimenti).

**`piano.js`**: piano pasti
- `pianoVuoto(settimana)`, `conTuttiIGiorni(piano)` (aggiunge i giorni mancanti per poterci mettere pasti), `ordinaPasti` (colazione → pranzo → spuntino → cena);
- `ricettario(piani)`: tutti i piatti con ingredienti presenti nei piani passati (l'ultima versione vince), usati nel menu "Scegli un piatto già fatto";
- `ingredientiMancanti(pasto, frigo, spesa)` / `ingredientiInFrigo(pasto, frigo)`: confronto per nome con `chiave()` di `cibo.js`;
- `pulisciPasto`: normalizza un pasto uscito dal form (niente righe vuote, ricetta come array).

**`prompts.js`**: modelli per "Chiedi a Claude". Ogni modello:

```js
{
  id: 'fermo', sezione: 'allenamento', titolo: 'Esercizio fermo', descrizione: '…',
  campi: [{ id: 'esercizio', label: 'Esercizio', tipo: 'select', opzioni: (ctx) => [...] }, …],
  build: (valori, ctx) => 'testo del prompt',
}
```

`ctx` contiene tutti i dati caricati (`scheda, log, misure, imp, frigo, spesa`), così il prompt può includere dati veri (es. le ultime 3 sessioni di un esercizio). `righe(...)` compone il testo scartando i campi vuoti; `SEP` è una riga vuota voluta. **Per aggiungere un modello basta aggiungere un oggetto a `MODELLI`**: la UI si genera da sola.

**`editor.js`**: logica pura dei pop-up (form ↔ dati salvati, controlli, spostamenti, rinomina giorni, ciclo dei muscoli personalizzati, salvataggio della sessione nel log senza doppioni).

**`muscoli.js`**: mappa dei muscoli
- `MUSCOLI`: i 18 gruppi disegnati (petto, spalle anteriori/laterali/posteriori, trapezi, schiena alta, dorsali, lombari, bicipiti, tricipiti, avambracci, addominali, obliqui, glutei, quadricipiti, femorali, adduttori, polpacci).
- `muscoliEsercizio(nome, override)` → `{ primari, secondari, riconosciuto }`. Usa `REGOLE`, regex sui nomi Hevy in italiano: **vince la prima che corrisponde**, quindi le più specifiche stanno in alto ("leg curl" prima di "curl", "croci inverse" prima di "croci"). Stretching e riscaldamento sono riconosciuti ma senza muscoli; la corsa ha solo secondari (gambe).
- `overrideMuscoli(scheda, imp)`: correzioni manuali da `impostazioni.muscoli_esercizi` e dal campo facoltativo `muscoli` di un esercizio in scheda.
- `caricoMuscoli(esercizi, override)`: serie "pesate", 1 per i primari e 0,5 per i secondari; restituisce anche `contributi` (per ogni muscolo gli esercizi che lo hanno lavorato, usati nell'elenco di Progressi) e gli esercizi `sconosciuti`. Il campo `muscoli` di un esercizio vale come override.
- `livelli(carico, modo)`: colore 0-4. `relativo` (una sessione, un giorno) = in proporzione al muscolo più lavorato; `settimana` = soglie fisse 1 / 3 / 6 / 10 serie (`SOGLIE_SETTIMANA`), dove 10+ è il volume settimanale di riferimento.

### 4.4 Componenti: `components/`

- `ui.jsx`: `Icon` (SVG inline, set in `PATHS`), `Card`, `Tabs`, `Stat`, `Empty`, `PageHeader`, `ErrorBanner`, `useFlash()` (toast: `const [node, flash] = useFlash(); flash('Salvato')`).
- `WeightChart.jsx`: peso giornaliero (punti grigi) + media mobile 7 gg (linea) + fascia obiettivo; `ResizeObserver` per la larghezza, crosshair con tooltip su mouse/touch.
- `TrendChart.jsx`: versione generica a una serie (`punti: [{ data, valore, dettaglio }]`), usata nei Progressi. Il passo dell'asse Y si sceglie tra valori "tondi" (1, 2, 2.5, 5…).
- `RestTimer.jsx`: countdown in basso a partire da un timestamp di fine (resta preciso anche se il tab va in background), `+30 s` / `Salta`, vibrazione (Android) e beep a fine recupero. Su iPhone l'audio parte solo se il contesto audio è stato creato durante un tocco: per questo chi avvia il timer chiama prima `sbloccaAudio()`.
- `MappaMuscoli.jsx`: `<MappaMuscoli carico={…} modo="relativo|settimana" elenco compatta />`. Disegna fronte e retro da `corpo.js` (metà sinistra + copia specchiata con `matrix(-1 0 0 1 200 0)`), colora ogni muscolo con le classi `lv0`…`lv4` (variabili `--m0`…`--m4` e `--corpo` in `:root` e nei due blocchi scuri). Toccando un muscolo si vedono nome e serie; con `elenco` mostra anche la classifica, `compatta` nasconde legenda e didascalia. Per ritoccare il disegno modifica le forme in `corpo.js` (coordinate in un riquadro 200 × 440).
- `EserciziMappa.jsx`: elenco di esercizi con la mappa accanto (sticky). Toccando un esercizio la mappa mostra solo i suoi muscoli (`focus` = `livelliEsercizio`: principali pieni, secondari chiari) e le altre righe si attenuano; toccando un muscolo (sulla mappa o sui chip) restano evidenziati gli esercizi che lo allenano. Per togliere la selezione basta toccare un punto vuoto (o premere Esc): lo fa `useDeseleziona.js`, che ascolta i tocchi sul documento e ignora solo quelli sugli elementi selezionabili del componente; un tocco su un esercizio di un'altra card sposta lì la selezione. Lo stesso vale per l'elenco dei muscoli in Progressi. `ChipMuscoli` = i chip sotto ogni esercizio (pieni i principali, contornati quelli che aiutano). Usato in Scheda, Storico e Home.
- `ui.jsx` → `Modal`: pop-up con portal su `body`, chiusura con Esc / X / tocco fuori, pulsanti in fondo sempre visibili; sul telefono si apre dal basso a tutto schermo. `onClose` è tenuto in un ref, così il focus non salta mentre scrivi.
- `EditorGiorno.jsx`: nome del giorno, esercizi (nome con suggerimenti da scheda e storico, serie, reps, RIR, recupero in secondi con anteprima «2 min 30 s», note), ordine ↑↓, aggiungi/elimina, muscoli personalizzati (un tocco: principale → aiuta → nessuno, salvati nel campo `muscoli`). Se il giorno cambia nome (o viene eliminato) si aggiornano anche calendario e `hevy_giorni` (`rinominaGiornoImpostazioni`).
- `EditorSessione.jsx`: data, titolo, durata, note, esercizi e serie (kg con virgola, reps, RIR); le serie a tempo/distanza importate da Hevy si conservano. Blocca il salvataggio se data + titolo coincidono con un'altra sessione (`salvaSessioneLog`).
- `useWidth(min)`: callback ref + `ResizeObserver`. Il grafico si disegna solo dopo aver misurato lo spazio disponibile e si ricollega anche se all'inizio mostrava un messaggio (es. "servono almeno 2 pesate"). Nelle griglie servono colonne `minmax(0, 1fr)`, altrimenti un SVG largo allarga la colonna.
- `useWakeLock(attivo)`: Screen Wake Lock API, tiene lo schermo acceso nella tab "A mano" (solo HTTPS/localhost, altrimenti non fa nulla).

### 4.5 Pagine: `pages/`

| Pagina | Componenti interni | Legge | Scrive |
|---|---|---|---|
| `Home.jsx` | n/a | scheda, log, misure, impostazioni, frigo, piano corrente | n/a |
| `Allenamento.jsx` | `SchedaView`, `Storico`, `ImportHevy`, `Progressi`, `Registra` | scheda, log, impostazioni | log |
| `Cibo.jsx` | `Piano`, `GiornoCard`, `PastoView`, `PastoEditor`, `Spesa`, `Casa`, `SempreInCasa` | piani, spesa, frigo, impostazioni | piano, spesa, frigo, impostazioni (`sempre_in_casa`) |
| `Salute.jsx` | `Peso`, `Impostazioni`, `AliasForm` | misure, impostazioni, scheda, profilo.md | misure, impostazioni |
| `Claude.jsx` | `Form`, `ChiediClaude` (menu compatto nell'intestazione delle altre pagine) | tutto | nessuno (copia negli appunti o Condividi) |

Dettagli utili:
- **Home**: l'allenamento del giorno arriva da `impostazioni.calendario[giorno della settimana]`. La striscia della settimana conta le sessioni **previste e fatte** più quelle extra, e mostra la sigla del giorno di scheda (anche per le sessioni Hevy, tramite `giornoScheda`); la legenda A/B/C… viene dalla scheda. I fondamentali (`ESERCIZI_CHIAVE`) mostrano la serie migliore e la variazione del **1RM stimato** nelle ultime 6 settimane (o da inizio scheda, se più recente).
- **Registra (a mano)**: il form si costruisce dalla scheda (`buildForm`) e salva una **bozza in `localStorage`** (chiave `coach-bozza:<data>:<giorno>`) a ogni modifica. Al salvataggio vengono tenute solo le serie con le ripetizioni compilate.
  - kg precompilati (`emptySets`): alla prima sessione della scheda (o se l'esercizio non è mai stato fatto) vale il carico della scheda (`kgDaScheda`), poi quello dell'ultima sessione. I suggerimenti grigi delle reps usano solo sessioni della scheda in corso.
  - **✓ serie fatta**: compila le reps (dalla volta scorsa o dal minimo del range), avvia il recupero; ritoccato di nuovo, riapre la serie. Con "max" mette il cursore nel campo.
  - Una sessione importata da Hevy con un altro titolo viene riconosciuta come la stessa del giorno di scheda (`stessoGiorno`), così modificarla non crea un doppione.
- **Modifiche a mano**: in Scheda ogni giorno ha «Modifica» (pop-up `EditorGiorno`), c'è «Aggiungi un giorno» e «Modifica» su nome/inizio/settimane della scheda; nello Storico «Modifica» apre `EditorSessione`. Il form «A mano» resta per registrare la sessione in palestra.
- **Mappa dei muscoli**: in Home (allenamento di oggi), in Scheda (ogni giorno), in "A mano" (esercizi della sessione), nello Storico (sessione aperta) e in cima a Progressi (`MuscoliPeriodo`: questa settimana / ultimi 7 giorni / media delle ultime 4 settimane, con elenco delle serie e degli esercizi non riconosciuti).
- **Progressi**: con la scheda in corso, "fermo / in crescita" considera solo le sessioni da `scheda.inizio`. Su telefono il grafico sta sopra l'elenco degli esercizi.
- **Cibo** (una sola pagina, niente tab): su desktop il piano sta a sinistra e a destra, fisse mentre scorri, Spesa e «In casa» (frigo + dispensa + «Sempre in casa»); sotto i 900 px l'ordine è oggi → spesa → in casa → resto della settimana, con scorciatoie in alto e i conteggi. I link `#/cibo?tab=spesa|frigo` scorrono alla sezione.
  - Ogni azione passa da `applica()`: salva piano, spesa e frigo (solo quelli cambiati) e mostra un avviso con **Annulla**, che rimette i tre file com'erano.
  - Gli ingredienti del piano mostrano dove sono (frigo, dispensa, sempre, spesa, manca) e se scadono entro 2 giorni; mentre scrivi un pasto vedi già cosa finirà in spesa. I nomi si suggeriscono da casa, spesa, "sempre in casa" e ricettario (datalist `nomi-ingredienti`).
  - In spesa: «Comprato» (casella), reparto automatico, "per ven · cena" sotto gli articoli che servono a un pasto, «Spesa della settimana» (aggiunge tutto quello che manca ai pasti da mangiare), «Copia lista» / «Condividi».
  - In casa: frigo e dispensa separati, scadenza (icona calendario), sposta frigo ↔ dispensa, «finito» e «finito, ricompra».
- **Piano pasti**: si può **modificare dalla webapp**: aggiungi / modifica / elimina un pasto (`PastoEditor`), scegli un piatto dal ricettario, segna "mangiato" (`fatto: true`).
  - Se non esiste il piano della settimana corrente si può creare vuoto (`pianoVuoto`). Nel file si salvano solo i giorni con almeno un pasto.
  - `useRicettario(files)` legge tutti i piani della cartella per costruire il ricettario.
- **Home**: se la scheda non è ancora iniziata (`inizio` nel futuro) mostra la settimana di pausa e non segna allenamenti previsti.

### 4.6 Stile: `styles.css`

- Tutti i colori sono **variabili CSS** in `:root`. I valori scuri stanno in due blocchi identici: `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` (automatico) e `:root[data-theme='dark']` (scelto a mano). Se cambi un colore scuro, cambialo in entrambi. Per cambiare il colore principale modifica `--accent`.
- **Tema**: `src/tema.js` salva la scelta in `localStorage` (`coach-tema`, preferenza del dispositivo, non un dato del coach) e la applica come `data-theme` su `<html>`; `index.html` la applica già prima del primo render per evitare il lampo di colore. Si cambia dal pulsante in alto (Automatico → Chiaro → Scuro) o da Salute → Impostazioni → Aspetto.
- Layout: contenuto max 1080 px; sotto i 760 px la navigazione diventa una barra in basso (`.nav` fixed) e le griglie vanno a una colonna.
- Il file è diviso per sezioni commentate (`/* ---------- Home ---------- */` ecc.).

---

## 5. Schemi dei dati

Tutte le date sono `AAAA-MM-GG`. Non aggiungere campi senza aggiornare anche la webapp (e `ISTRUZIONI.md`).

**`schede/attuale.json`**
```json
{ "nome": "Scheda 1 — …", "inizio": "2026-09-28", "settimane": 5,
  "giorni": [ { "nome": "Giorno A — Push",
    "esercizi": [ { "nome": "Panca Piana (Bilanciere)", "serie": 3, "reps": "6-8", "rir": 2, "recupero_s": 150, "note": "Sett. 1: 47,5 kg. …" } ] } ] }
```
I nomi degli esercizi sono quelli della **libreria di Hevy**, così l'import li riconosce. I giorni si chiamano `Giorno <sigla> — <descrizione>`: la sigla finisce in Home e la descrizione serve a riconoscere i titoli Hevy ("Push" → Giorno A). Il carico di partenza si legge dalle note nel formato `Sett. N: X kg` (anche `35-40 kg`, vale il minimo); in alternativa un campo opzionale `"kg"` numerico.

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
      "ricetta": [ "passo 1", "passo 2" ], "note": "", "fatto": true } ] } ],
  "da_comprare_extra": [ { "nome": "…", "categoria": "proteine", "quantita": "2", "motivo": "…" } ] }
```

`fatto` è opzionale: c'è solo sui pasti già mangiati. `consumati` (opzionale, solo sui pasti mangiati) = articoli tolti dal frigo, da rimettere se si toglie la spunta.

**`spesa.json`**: `{ "aggiornata", "articoli": [ { "nome", "categoria", "quantita", "auto"? } ] }` — `auto: true` = aggiunto per un pasto (esce da solo se il pasto cambia)
**`frigo.json`**: `{ "aggiornato", "articoli": [ { "nome", "categoria", "quantita", "scadenza", "dove" } ] }` — `dove` = `"frigo"` o `"dispensa"`; se manca si deduce dalla categoria

**`impostazioni.json`**
```json
{ "calendario": { "lunedì": "Giorno A — Push", "martedì": null, … },
  "target": { "kcal": 2150, "proteine_g": 150 },
  "peso_obiettivo_kg": { "min": 70, "max": 75 },
  "hevy_alias": { "Nome in Hevy": "Nome in scheda" },
  "hevy_giorni": { "Titolo allenamento in Hevy": "Giorno A — Push" },
  "muscoli_esercizi": { "Nome esercizio": { "primari": ["petto"], "secondari": ["tricipiti"] } },
  "sempre_in_casa": ["Sale", "Pepe", "Olio", "Aceto", "Acqua"] }
```
`muscoli_esercizi` (facoltativo) corregge o aggiunge i muscoli di un esercizio che le regole di `muscoli.js` non riconoscono; gli id sono quelli di `MUSCOLI`. Lo stesso oggetto si può mettere come campo `muscoli` di un esercizio in scheda.
`hevy_giorni` serve solo per i titoli che `giornoScheda` non riconosce da solo.

---

## 6. Flussi principali

**Import da Hevy**
`ImportHevy` → `file.text()` → `parseCsv` → `hevyToSessions` (con alias, nome scheda e — dall'inizio della scheda — titolo → giorno di scheda) → anteprima (con i titoli non collegati) (`mergeLog` per contare nuove/aggiornate) → conferma → `save(log)` → `PUT /api/file?path=log/allenamenti.json`.

**Chiedi a Claude**
`Claude.jsx` carica tutti i dati → `valoriIniziali(modello, ctx)` → a ogni modifica `modello.build(valori, ctx)` rigenera il testo (a meno che tu non l'abbia ritoccato a mano) → `copiaTesto` (in `clipboard.js`: `navigator.clipboard` in HTTPS/localhost, altrimenti textarea nascosta + `execCommand('copy')`, che funziona anche dal telefono in HTTP).

**Claude aggiorna un file**
Claude scrive su disco → torni sulla finestra della webapp → evento `focus` / `visibilitychange` → la cache rilegge i file in uso → la UI si aggiorna. Se salvi dalla webapp prima di rileggere, il server risponde 409 e i dati si ricaricano (niente sovrascritture).

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
- `utils.test.js`: settimane ISO ed etichette leggibili, media peso, 1RM, formattazione delle serie, tipo di esercizio, stato di progressione (anche da inizio scheda), riconoscimento dei giorni di scheda, carico dalla scheda;
- `editor.test.js`: pulizia dei form, controlli, rinomina giorni nel calendario, muscoli personalizzati, sessioni senza doppioni;
- `muscoli.test.js`: muscoli di tutti gli esercizi della scheda e dei più usati nel log, override, serie pesate, livelli relativi e settimanali;
- `api.test.js`: cache condivisa con un `fetch` finto: versione inviata, salvataggi in fila, conflitto 409 che non sovrascrive e ricarica;
- `cibo.test.js`: nomi (singolare/plurale), reparto e posto automatici, sempre in casa, pasti che contano, spesa automatica (aggiungi, togli, settimana), mangiato / togli la spunta, comprato, finito, lista da condividere;
- `piano.test.js`: piano vuoto, giorni mancanti, ordinamento, ricettario, ingredienti mancanti / in frigo, pulizia del form;
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
- La sessione è identificata da `data + giorno`: due allenamenti dello stesso giorno di scheda nella stessa data collidono.
- Dopo un conflitto (409) l'ultima modifica va ripetuta a mano: non c'è un merge automatico.
- Wake Lock e il pulsante Condividi funzionano solo in HTTPS/localhost: dal telefono via `dev:rete` (HTTP) non sono disponibili.
- L'API non ha autenticazione: va bene su `localhost`, meno con `dev:rete`.
- Nel form "A mano" non si inseriscono serie a tempo/distanza (quelle importate vengono comunque conservate).
- Possibili evoluzioni: sincronizzazione automatica con l'API di Hevy (serve Hevy PRO), un modello AI locale per il piano pasti.
