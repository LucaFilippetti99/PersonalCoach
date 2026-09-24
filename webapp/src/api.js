import { useCallback, useEffect, useState } from 'react'

export async function readJson(path) {
  const r = await fetch(`/api/file?path=${encodeURIComponent(path)}`)
  if (r.status === 204 || r.status === 404) return undefined
  if (!r.ok) throw new Error((await r.json()).errore || r.statusText)
  return r.json()
}

export async function writeJson(path, data) {
  const r = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) throw new Error((await r.json()).errore || r.statusText)
}

export async function listDir(dir) {
  const r = await fetch(`/api/list?dir=${encodeURIComponent(dir)}`)
  return r.ok ? r.json() : []
}

/**
 * Carica un file JSON e restituisce { data, save, reload, loading, error }.
 * `fallback` è usato se il file non esiste ancora (verrà creato al primo salvataggio).
 */
export function useJson(path, fallback) {
  const [data, setData] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!path) return
    setLoading(true)
    try {
      const d = await readJson(path)
      setData(d === undefined ? structuredClone(fallback) : d)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  useEffect(() => {
    reload()
  }, [reload])

  // Ricarica quando la finestra torna in primo piano (es. Claude ha aggiornato i file)
  useEffect(() => {
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  const save = useCallback(
    async (next) => {
      setData(next)
      try {
        await writeJson(path, next)
        setError(null)
      } catch (e) {
        setError(e.message)
        throw e
      }
    },
    [path],
  )

  return { data, save, reload, loading, error }
}
