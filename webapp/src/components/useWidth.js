import { useCallback, useRef, useState } from 'react'

/**
 * Larghezza di un elemento, aggiornata con ResizeObserver.
 * Si usa un "callback ref": l'osservatore si collega ogni volta che l'elemento compare,
 * anche se all'inizio il componente mostrava un messaggio al posto del grafico.
 * La larghezza è null finché non è stata misurata (così il grafico non parte con una misura inventata).
 */
export function useWidth(min = 0) {
  const [width, setWidth] = useState(null)
  const ro = useRef(null)
  const ref = useCallback(
    (el) => {
      ro.current?.disconnect()
      ro.current = null
      if (!el) return
      setWidth(Math.max(min, el.getBoundingClientRect().width))
      ro.current = new ResizeObserver(([e]) => setWidth(Math.max(min, e.contentRect.width)))
      ro.current.observe(el)
    },
    [min],
  )
  return [ref, width]
}
