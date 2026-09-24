import { useCallback, useEffect, useReducer } from 'react'

/** Legge un file: { data, mtime }. data è undefined se il file non esiste ancora. */
export async function readFile(path) {
  const r = await fetch(`/api/file?path=${encodeURIComponent(path)}`)
  if (r.status === 204 || r.status === 404) return { data: undefined, mtime: 'none' }
  if (!r.ok) throw new Error((await r.json()).errore || r.statusText)
  return { data: await r.json(), mtime: r.headers.get('X-Mtime') || null }
}

export async function readJson(path) {
  return (await readFile(path)).data
}

export class ConflictError extends Error {}

/**
 * Scrive un file. Se `mtime` è indicato, il server rifiuta la scrittura (409) quando il file
 * è cambiato nel frattempo (es. l'ha modificato Claude): così non si cancellano le sue modifiche.
 * Restituisce il nuovo mtime.
 */
export async function writeJson(path, data, mtime) {
  const headers = { 'Content-Type': 'application/json' }
  if (mtime) headers['X-If-Mtime'] = mtime
  const r = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  })
  const body = await r.json().catch(() => ({}))
  if (r.status === 409) throw new ConflictError(body.errore || 'File modificato nel frattempo')
  if (!r.ok) throw new Error(body.errore || r.statusText)
  return body.mtime || null
}

export async function listDir(dir) {
  const r = await fetch(`/api/list?dir=${encodeURIComponent(dir)}`)
  return r.ok ? r.json() : []
}

/* ---------------------------------------------------------------------------
 * Cache condivisa: una sola copia dei dati per file, condivisa da tutti i componenti.
 * Così, se un componente salva (es. l'import da Hevy), tutti gli altri che leggono lo
 * stesso file (es. lo storico) si aggiornano subito.
 * ------------------------------------------------------------------------- */

const store = new Map() // path -> { data, mtime, loaded, error, fallback, listeners, inflight, queue }

function entry(path) {
  let e = store.get(path)
  if (!e) {
    e = { data: undefined, mtime: null, loaded: false, error: null, fallback: undefined, listeners: new Set(), inflight: null, queue: Promise.resolve() }
    store.set(path, e)
  }
  return e
}

function notify(e) {
  for (const l of e.listeners) l()
}

function load(path) {
  const e = entry(path)
  if (e.inflight) return e.inflight
  e.inflight = readFile(path)
    .then(({ data, mtime }) => {
      e.data = data === undefined ? structuredClone(e.fallback ?? null) : data
      e.mtime = mtime
      e.error = null
    })
    .catch((err) => {
      e.error = err.message
    })
    .finally(() => {
      e.loaded = true
      e.inflight = null
      notify(e)
    })
  return e.inflight
}

/** Ricarica tutti i file in uso (quelli con almeno un componente montato) */
function reloadAll() {
  for (const [path, e] of store) if (e.listeners.size) load(path)
}

if (typeof window !== 'undefined') {
  // Quando la finestra torna in primo piano (es. Claude ha aggiornato i file) si rileggono i dati.
  // `visibilitychange` copre anche l'app aperta dalla schermata Home del telefono.
  window.addEventListener('focus', reloadAll)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reloadAll())
  // Gli errori di salvataggio sono già mostrati nella pagina (banner): non serve anche l'errore in console
  window.addEventListener('unhandledrejection', (ev) => ev.reason?.giaMostrato && ev.preventDefault())
}

/**
 * Salva un file: aggiorna subito la cache (UI ottimistica) e poi scrive su disco.
 * I salvataggi dello stesso file vengono messi in fila, così ognuno usa l'mtime aggiornato.
 */
function saveEntry(path, next) {
  const e = entry(path)
  e.data = next
  notify(e)
  const run = e.queue.then(async () => {
    try {
      e.mtime = await writeJson(path, next, e.mtime)
      e.error = null
    } catch (err) {
      if (err instanceof ConflictError) {
        await load(path) // prima si ricarica (load azzera l'errore), poi si spiega cosa è successo
        e.error = 'Il file è stato modificato da Claude mentre avevi la pagina aperta: ho ricaricato i dati, ripeti l\'ultima modifica.'
      } else {
        e.error = err.message
      }
      notify(e)
      err.giaMostrato = true
      throw err
    }
    notify(e)
  })
  e.queue = run.catch(() => {})
  return run
}

/**
 * Carica un file JSON e restituisce { data, save, reload, loading, error }.
 * `fallback` è usato se il file non esiste ancora (verrà creato al primo salvataggio).
 */
export function useJson(path, fallback) {
  const [, rerender] = useReducer((x) => x + 1, 0)

  useEffect(() => {
    if (!path) return
    const e = entry(path)
    if (e.fallback === undefined) e.fallback = fallback
    e.listeners.add(rerender)
    if (!e.loaded) load(path)
    else rerender()
    return () => e.listeners.delete(rerender)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  const reload = useCallback(() => (path ? load(path) : Promise.resolve()), [path])
  const save = useCallback((next) => saveEntry(path, next), [path])

  const e = path ? store.get(path) : null
  return { data: e?.loaded ? e.data : undefined, save, reload, loading: !e?.loaded, error: e?.error ?? null }
}

/** Salva un file passando dalla cache condivisa (anche fuori dai componenti) */
export const saveFile = saveEntry

/** Solo per i test */
export const _test = {
  reset: () => store.clear(),
  load,
  get: (path) => store.get(path),
}
