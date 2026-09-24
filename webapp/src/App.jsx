import { useEffect, useState } from 'react'
import Home from './pages/Home.jsx'
import Allenamento from './pages/Allenamento.jsx'
import Cibo from './pages/Cibo.jsx'
import Salute from './pages/Salute.jsx'
import Claude from './pages/Claude.jsx'
import { Icon } from './components/ui.jsx'
import { TEMI, prossimoTema, useTema } from './tema.js'

const SEZIONI = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'allenamento', label: 'Allenamento', icon: 'dumbbell' },
  { id: 'cibo', label: 'Cibo', icon: 'food' },
  { id: 'salute', label: 'Salute', icon: 'heart' },
  { id: 'claude', label: 'Claude', icon: 'chat' },
]

// Routing minimale via hash: #/sezione?param=valore
function parseHash() {
  const [p, q] = window.location.hash.replace(/^#\/?/, '').split('?')
  const id = SEZIONI.some((s) => s.id === p) ? p : 'home'
  return { id, params: Object.fromEntries(new URLSearchParams(q || '')) }
}

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [tema, setTema] = useTema()
  const infoTema = TEMI.find((t) => t.id === tema)
  const infoProssimo = TEMI.find((t) => t.id === prossimoTema(tema))

  useEffect(() => {
    const on = () => {
      setRoute(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <Icon name="dumbbell" />
          </span>
          Coach
        </div>
        <nav className="nav" aria-label="Sezioni">
          {SEZIONI.map((s) => (
            <a
              key={s.id}
              href={`#/${s.id}`}
              className={`nav-item ${route.id === s.id ? 'active' : ''}`}
              aria-current={route.id === s.id ? 'page' : undefined}
            >
              <Icon name={s.icon} />
              <span>{s.label}</span>
            </a>
          ))}
        </nav>
        <button
          className="theme-btn"
          onClick={() => setTema(prossimoTema(tema))}
          title={`Tema: ${infoTema.label.toLowerCase()}. Tocca per passare a ${infoProssimo.label.toLowerCase()}`}
          aria-label={`Tema ${infoTema.label.toLowerCase()}, passa a ${infoProssimo.label.toLowerCase()}`}
        >
          <Icon name={infoTema.icon} size={18} />
          <span className="theme-label">{infoTema.label}</span>
        </button>
      </header>
      <main className="content" key={window.location.hash}>
        {route.id === 'home' && <Home />}
        {route.id === 'allenamento' && <Allenamento params={route.params} />}
        {route.id === 'cibo' && <Cibo params={route.params} />}
        {route.id === 'salute' && <Salute params={route.params} />}
        {route.id === 'claude' && <Claude params={route.params} />}
      </main>
    </div>
  )
}
