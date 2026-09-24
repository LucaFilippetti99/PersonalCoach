import { useEffect, useState } from 'react'
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
  useEffect(() => {
    const key = (f) => (f.match(/\d{4}-W\d{2}/)?.[0] ?? '') + (/esempio/i.test(f) ? '0' : '1')
    const load = () =>
      listDir('piani-pasti').then((fs) => setFiles([...fs].sort((a, b) => key(a).localeCompare(key(b)))))
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])
  const week = isoWeek()
  const current = files?.find((f) => f.includes(week)) ?? null
  const latest = files?.length ? files[files.length - 1] : null
  return { files, current, suggested: current ?? latest }
}
