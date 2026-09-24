import { useEffect } from 'react'

/**
 * Tiene lo schermo acceso finché `attivo` è vero (es. mentre registri una sessione in palestra).
 * Il blocco si perde quando l'app va in background: lo si richiede di nuovo al ritorno.
 * Funziona solo in HTTPS/localhost e sui browser che supportano la Screen Wake Lock API.
 */
export function useWakeLock(attivo) {
  useEffect(() => {
    if (!attivo || !('wakeLock' in navigator)) return
    let lock = null
    let vivo = true
    const richiedi = async () => {
      try {
        if (document.visibilityState === 'visible' && (!lock || lock.released)) lock = await navigator.wakeLock.request('screen')
        if (!vivo) lock?.release()
      } catch {
        /* non concesso */
      }
    }
    richiedi()
    document.addEventListener('visibilitychange', richiedi)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', richiedi)
      lock?.release().catch(() => {})
    }
  }, [attivo])
}
