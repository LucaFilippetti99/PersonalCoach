export function navigate(id, params = {}) {
  const q = new URLSearchParams(params).toString()
  window.location.hash = `/${id}${q ? `?${q}` : ''}`
}

/**
 * Ricorda la tab aperta nell'indirizzo (#/cibo?tab=spesa) senza ricaricare la pagina:
 * ricaricando o tornando da un'altra sezione riapri la stessa tab.
 */
export function ricordaTab(tab) {
  const sezione = window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'home'
  history.replaceState(null, '', `#/${sezione}?tab=${encodeURIComponent(tab)}`)
}
