import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, _test, saveFile, writeJson } from '../src/api.js'

// Finto server: un file con contenuto e mtime
function fakeServer(file) {
  const calls = []
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push({ url, opts })
    const method = opts.method || 'GET'
    const headers = new Map([['X-Mtime', file.mtime]])
    if (method === 'GET')
      return { ok: true, status: 200, headers: { get: (k) => headers.get(k) }, json: async () => structuredClone(file.data) }
    const atteso = opts.headers?.['X-If-Mtime']
    if (atteso && atteso !== file.mtime)
      return { ok: false, status: 409, json: async () => ({ errore: 'modificato' }) }
    file.data = JSON.parse(opts.body)
    file.mtime = String(Number(file.mtime) + 1)
    return { ok: true, status: 200, json: async () => ({ ok: true, mtime: file.mtime }) }
  })
  return calls
}

describe('cache condivisa e conflitti', () => {
  beforeEach(() => _test.reset())

  it('writeJson manda la versione letta e lancia ConflictError con 409', async () => {
    const file = { data: [1], mtime: '10' }
    const calls = fakeServer(file)
    expect(await writeJson('x.json', [2], '10')).toBe('11')
    expect(calls[0].opts.headers['X-If-Mtime']).toBe('10')
    await expect(writeJson('x.json', [3], '10')).rejects.toBeInstanceOf(ConflictError)
  })

  it('salvataggi in fila usano ognuno la versione aggiornata', async () => {
    const file = { data: [], mtime: '1' }
    fakeServer(file)
    await _test.load('log/a.json')
    await Promise.all([saveFile('log/a.json', [1]), saveFile('log/a.json', [1, 2])])
    expect(file.data).toEqual([1, 2])
    expect(_test.get('log/a.json').error).toBe(null)
  })

  it('se Claude modifica il file, il salvataggio non lo sovrascrive e i dati vengono ricaricati', async () => {
    const file = { data: ['vecchio'], mtime: '1' }
    fakeServer(file)
    await _test.load('spesa.json')
    // Claude scrive il file mentre la webapp è aperta
    file.data = ['di Claude']
    file.mtime = '5'
    await expect(saveFile('spesa.json', ['dalla webapp'])).rejects.toBeInstanceOf(ConflictError)
    expect(file.data).toEqual(['di Claude'])
    const e = _test.get('spesa.json')
    expect(e.data).toEqual(['di Claude'])
    expect(e.error).toMatch(/modificato da Claude/)
  })
})
