import { useCallback, useEffect, useState } from 'react'
import { listDir, useJson } from './api.js'
import { FRIGO_DEFAULT, IMPOSTAZIONI_DEFAULT, SPESA_DEFAULT } from './defaults.js'
import { isoWeek } from './utils.js'

export const useScheda = () => useJson('schede/attuale.json', null)
export const useLog = () => useJson('log/allenamenti.json', [])
export const useMisure = () => useJson('log/misure.json', [])
export const useSpesa = () => useJson('spesa.json', SPESA_DEFAULT)
export const useFrigo = () => useJson('frigo.json', FRIGO_DEFAULT)

export function useImpostazioni() {
  const r = useJson('impostazioni.json', IMPOSTAZIONI_DEFAULT)
  // Unisce i default per eventuali chiavi mancanti
  const data = r.data && {
    ...IMPOSTAZIONI_DEFAULT,
    ...r.data,
    calendario: { ...IMPOSTAZIONI_DEFAULT.calendario, ...r.data.calendario },
    target: { ...IMPOSTAZIONI_DEFAULT.target, ...r.data.target },
    peso_obiettivo_kg: { ...IMPOSTAZIONI_DEFAULT.peso_obiettivo_kg, ...r.data.peso_obiettivo_kg },
  }
  return { ...r, data }
}

/** Elenco dei piani pasti e file suggerito (settimana corrente, altrimenti il più recente) */
export function usePianiList() {
  const [files, setFiles] = useState(null)
  const key = (f) => (f.match(/\d{4}-W\d{2}/)?.[0] ?? '') + (/esempio/i.test(f) ? '0' : '1')
  const load = useCallback(
    () => listDir('piani-pasti').then((fs) => setFiles([...fs].sort((a, b) => key(a).localeCompare(key(b))))),
    [],
  )
  useEffect(() => {
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])
  const week = isoWeek()
  // Il file di esempio non conta come piano della settimana
  const current = files?.find((f) => f.includes(week) && !/esempio/i.test(f)) ?? null
  const reali = files?.filter((f) => !/esempio/i.test(f)) ?? []
  const latest = reali.length ? reali[reali.length - 1] : files?.length ? files[files.length - 1] : null
  return { files, current, suggested: current ?? latest, reload: load }
}
