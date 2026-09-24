/**
 * Copia un testo negli appunti.
 * `navigator.clipboard` funziona solo in HTTPS o su localhost: dal telefono (http://IP-del-Mac:5173)
 * non esiste, quindi si usa il vecchio metodo con una textarea nascosta + execCommand('copy'),
 * che iOS e Android accettano se parte da un tocco.
 */
export async function copiaTesto(testo) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(testo)
      return
    } catch {
      /* si prova il metodo di riserva */
    }
  }
  const ta = document.createElement('textarea')
  ta.value = testo
  ta.setAttribute('readonly', '')
  Object.assign(ta.style, { position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '16px' })
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  ta.setSelectionRange(0, testo.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    ta.remove()
  }
  if (!ok) throw new Error('Copia non riuscita')
}

/** Il menu Condividi del sistema (disponibile solo in HTTPS/localhost) */
export const puoCondividere = () => typeof navigator !== 'undefined' && !!navigator.share && window.isSecureContext
