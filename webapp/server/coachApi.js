// Mini API locale: legge e scrive i file JSON della cartella coach.
// Funziona sia con `vite` (dev) sia con `vite preview`.
import fs from 'node:fs/promises'
import path from 'node:path'

// Solo questi file sono accessibili dalla webapp.
const ALLOWED = [
  /^log\/[\w.-]+\.json$/,
  /^schede\/[\w.-]+\.json$/,
  /^piani-pasti\/[\w.-]+\.json$/,
  /^spesa\.json$/,
  /^frigo\.json$/,
  /^impostazioni\.json$/,
]
const LISTABLE = ['piani-pasti', 'schede', 'log']

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

/** Versione del file (data di modifica), 'none' se non esiste */
async function mtimeOf(abs) {
  try {
    return String((await fs.stat(abs)).mtimeMs)
  } catch {
    return 'none'
  }
}

function safePath(root, rel) {
  if (!rel || rel.includes('..') || !ALLOWED.some((r) => r.test(rel))) return null
  const abs = path.resolve(root, rel)
  if (!abs.startsWith(path.resolve(root) + path.sep)) return null
  return abs
}

function handler(root) {
  return async (req, res, next) => {
    if (!req.url.startsWith('/api/')) return next()
    const url = new URL(req.url, 'http://localhost')
    try {
      if (url.pathname === '/api/file') {
        const rel = url.searchParams.get('path')
        const abs = safePath(root, rel)
        if (!abs) return send(res, 403, { errore: `Percorso non consentito: ${rel}` })

        if (req.method === 'GET') {
          try {
            // mtime letto prima del contenuto: se il file cambia in mezzo, il prossimo PUT va in conflitto (sicuro)
            const mtime = await mtimeOf(abs)
            const txt = await fs.readFile(abs, 'utf8')
            res.setHeader('X-Mtime', mtime)
            return send(res, 200, JSON.parse(txt))
          } catch (e) {
            if (e.code === 'ENOENT') {
              res.statusCode = 204 // non esiste ancora: la webapp usa i valori di default
              return res.end()
            }
            throw e
          }
        }
        if (req.method === 'PUT') {
          const body = await readBody(req)
          const parsed = JSON.parse(body) // rifiuta JSON non valido
          // Controllo conflitti: se la webapp dice quale versione aveva letto e il file nel frattempo
          // è cambiato (es. l'ha modificato Claude), rifiuta invece di sovrascrivere.
          const atteso = req.headers['x-if-mtime']
          if (atteso && atteso !== (await mtimeOf(abs))) {
            return send(res, 409, { errore: `${rel} è stato modificato da un'altra parte` })
          }
          await fs.mkdir(path.dirname(abs), { recursive: true })
          const tmp = `${abs}.tmp-${process.pid}`
          await fs.writeFile(tmp, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
          await fs.rename(tmp, abs) // scrittura atomica
          return send(res, 200, { ok: true, mtime: await mtimeOf(abs) })
        }
        return send(res, 405, { errore: 'Metodo non supportato' })
      }

      if (url.pathname === '/api/list' && req.method === 'GET') {
        const dir = url.searchParams.get('dir')
        if (!LISTABLE.includes(dir)) return send(res, 403, { errore: 'Cartella non consentita' })
        const files = await fs.readdir(path.join(root, dir)).catch(() => [])
        return send(res, 200, files.filter((f) => f.endsWith('.json')).sort())
      }

      if (url.pathname === '/api/profilo' && req.method === 'GET') {
        const txt = await fs.readFile(path.join(root, 'profilo.md'), 'utf8').catch(() => '')
        return send(res, 200, { testo: txt })
      }

      return send(res, 404, { errore: 'Endpoint sconosciuto' })
    } catch (e) {
      return send(res, 500, { errore: e.message })
    }
  }
}

export function coachApi({ root }) {
  return {
    name: 'coach-api',
    configureServer(server) {
      server.middlewares.use(handler(root))
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler(root))
    },
  }
}
