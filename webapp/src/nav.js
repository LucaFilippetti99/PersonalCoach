export function navigate(id, params = {}) {
  const q = new URLSearchParams(params).toString()
  window.location.hash = `/${id}${q ? `?${q}` : ''}`
}
