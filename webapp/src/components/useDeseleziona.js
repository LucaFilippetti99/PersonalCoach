import { useEffect, useRef } from 'react'

// Elementi che si possono selezionare: un tocco su di loro lo gestiscono loro stessi
const SELEZIONABILI = '.es-riga-btn, .chip-m, .muscolo, .mappa-riga, .mappa-contributi'

/**
 * Deseleziona toccando "sul nulla": mentre `attivo` è vero, un tocco ovunque che non sia un elemento
 * selezionabile di questo componente (`ref`) chiama `deseleziona`. Anche Esc deseleziona.
 * Un tocco su un elemento selezionabile di un ALTRO componente (es. un'altra card) deseleziona questo.
 */
export function useDeseleziona(ref, attivo, deseleziona) {
  const cb = useRef(deseleziona)
  cb.current = deseleziona
  useEffect(() => {
    if (!attivo) return
    const suTocco = (e) => {
      const el = e.target.closest?.(SELEZIONABILI)
      if (el && ref.current?.contains(el)) return
      cb.current()
    }
    const suTasto = (e) => e.key === 'Escape' && cb.current()
    document.addEventListener('pointerdown', suTocco)
    document.addEventListener('keydown', suTasto)
    return () => {
      document.removeEventListener('pointerdown', suTocco)
      document.removeEventListener('keydown', suTasto)
    }
  }, [attivo, ref])
}
