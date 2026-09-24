import { useJson } from '../api.js'
import { Card, Empty, Icon, Stat } from '../components/ui.jsx'
import { useFrigo, useImpostazioni, useLog, useMisure, usePianiList, useScheda } from '../hooks.js'
import { navigate } from '../nav.js'
import {
  GIORNI_SETTIMANA,
  addDays,
  exerciseHistory,
  formatDate,
  formatSet,
  formatSets,
  giornoScheda,
  parseGiorno,
  schedaAttiva,
  siglaGiorno,
  isExampleSession,
  isoDate,
  lastExercise,
  parseDate,
  round1,
  startOfWeek,
  topSet,
  validWeights,
  weekdayName,
  weeklyAvg,
} from '../utils.js'

const ESERCIZI_CHIAVE = [
  'Panca Piana (Bilanciere)',
  'Squat (Bilanciere)',
  'Lat Pulldown (Cavo)',
  'Lento in Avanti in Piedi (Bilanciere)',
]

function saluto() {
  const h = new Date().getHours()
  if (h < 13) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

export default function Home() {
  const { data: scheda } = useScheda()
  const { data: logRaw } = useLog()
  const { data: misure } = useMisure()
  const { data: imp } = useImpostazioni()
  const { data: frigo } = useFrigo()
  const { suggested } = usePianiList()
  const { data: piano } = useJson(suggested ? `piani-pasti/${suggested}` : null, null)

  const oggi = isoDate()
  const nomeOggi = weekdayName()
  const log = (logRaw || []).filter((s) => !isExampleSession(s))

  // Prima dell'inizio della scheda (pausa) non ci sono allenamenti previsti
  const attiva = (d) => !scheda?.inizio || d >= scheda.inizio
  const giornoNome = attiva(oggi) ? imp?.calendario?.[nomeOggi] : null
  const giorno = scheda?.giorni?.find((g) => g.nome === giornoNome)
  const sessioneOggi = log.find((s) => s.data === oggi)
  const ultimaSessione = [...log].sort((a, b) => b.data.localeCompare(a.data))[0]

  // Settimana della scheda
  let settimanaScheda = null
  if (scheda?.inizio) {
    const diff = Math.floor((new Date() - parseDate(scheda.inizio)) / 86400000)
    settimanaScheda = diff < 0 ? { prima: -diff } : { n: Math.floor(diff / 7) + 1, tot: scheda.settimane }
  }

  // Striscia settimanale
  const lun = startOfWeek()
  const settimana = GIORNI_SETTIMANA.map((nome, i) => {
    const d = isoDate(addDays(lun, i))
    return {
      nome,
      data: d,
      previsto: attiva(d) ? imp?.calendario?.[nome] : null,
      fatto: log.find((s) => s.data === d),
    }
  })
  const previsti = settimana.filter((g) => g.previsto).length
  const fattiPrevisti = settimana.filter((g) => g.previsto && g.fatto).length
  const extra = settimana.filter((g) => !g.previsto && g.fatto).length
  let riepilogo
  if (previsti) riepilogo = `${fattiPrevisti} di ${previsti} sessioni previste${extra ? ` · ${extra} extra` : ''}`
  else riepilogo = `${extra} ${extra === 1 ? 'allenamento' : 'allenamenti'} questa settimana`
  // Sigla da mostrare sotto il giorno: A, B, C… (anche per le sessioni importate da Hevy con un altro titolo)
  const sigla = (g) =>
    siglaGiorno(g.fatto ? giornoScheda(g.fatto.giorno, scheda, imp?.hevy_giorni) || '' : g.previsto) || ''
  const legenda = (scheda?.giorni || [])
    .map((g) => {
      const { sigla: s, descrizione } = parseGiorno(g.nome)
      return s ? `${s} ${descrizione}` : null
    })
    .filter(Boolean)
    .join(' · ')

  // Fondamentali: 1RM stimato (tiene conto di kg e ripetizioni) nelle ultime 6 settimane,
  // o dall'inizio della scheda se è più recente
  const seiSett = isoDate(addDays(new Date(), -42))
  const dal = schedaAttiva(scheda) && scheda.inizio > seiSett ? scheda.inizio : seiSett
  const fondamentali = ESERCIZI_CHIAVE.map((nome) => {
    const storia = exerciseHistory(log, nome).filter((h) => h.data >= dal)
    if (!storia.length) return null
    const ultimo = storia.at(-1)
    const diff = storia.length > 1 ? round1(ultimo.valore - storia[0].valore) : null
    return { nome, ultimo, diff }
  }).filter(Boolean)

  // Peso
  const pesi = validWeights(misure)
  const media = weeklyAvg(misure, oggi)
  const mediaPrec = weeklyAvg(misure, isoDate(addDays(new Date(), -7)))
  const delta = media != null && mediaPrec != null ? round1(media - mediaPrec) : null

  // Pasti di oggi
  const pastiOggi = piano?.giorni?.find((g) => g.giorno === nomeOggi)?.pasti ?? []

  // Frigo in scadenza (entro 2 giorni)
  const limite = isoDate(addDays(new Date(), 2))
  const inScadenza = (frigo?.articoli || []).filter((a) => a.scadenza && a.scadenza <= limite)

  return (
    <div className="page">
      <div className="hero">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1>{saluto()}, Luca</h1>
          {settimanaScheda && scheda && (
            <p className="muted">
              {scheda.nome} ·{' '}
              {settimanaScheda.prima
                ? `inizia tra ${settimanaScheda.prima} ${settimanaScheda.prima === 1 ? 'giorno' : 'giorni'}`
                : settimanaScheda.n > settimanaScheda.tot
                  ? 'scheda conclusa: chiedi a Claude la prossima'
                  : `settimana ${settimanaScheda.n} di ${settimanaScheda.tot}`}
            </p>
          )}
        </div>
      </div>

      <div className="grid-2">
        <Card
          title="Allenamento di oggi"
          className="card-accent"
          action={
            giorno && !sessioneOggi ? (
              <button className="btn btn-ghost" onClick={() => navigate('allenamento', { tab: 'scheda' })}>
                Scheda <Icon name="chevron" size={16} />
              </button>
            ) : null
          }
        >
          {sessioneOggi ? (
            <div className="done-box">
              <span className="done-check">
                <Icon name="check" />
              </span>
              <div>
                <strong>{sessioneOggi.giorno}</strong> completato
                <div className="muted small">
                  {sessioneOggi.esercizi.length} esercizi
                  {sessioneOggi.durata_min ? ` · ${sessioneOggi.durata_min} min` : ''}
                </div>
                <button className="btn btn-link" onClick={() => navigate('allenamento', { tab: 'storico' })}>
                  Vedi nello storico
                </button>
              </div>
            </div>
          ) : settimanaScheda?.prima ? (
            <Empty>
              Settimana di <strong>pausa</strong>. La scheda riparte{' '}
              {parseDate(scheda.inizio).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}.
              Continua a pesarti qualche mattina: il trend del peso serve anche adesso.
            </Empty>
          ) : giorno ? (
            <>
              <h3 className="day-title">{giorno.nome}</h3>
              <ul className="ex-list">
                {giorno.esercizi.map((e) => {
                  const last = lastExercise(log, e.nome)
                  return (
                    <li key={e.nome}>
                      <span className="ex-name">{e.nome}</span>
                      <span className="ex-meta">
                        {e.serie}×{e.reps}
                        {last && <span className="muted"> · ultima {formatSets([topSet(last.esercizio)])}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <Empty>
              Oggi è <strong>riposo</strong>.{' '}
              {(() => {
                for (let i = 1; i <= 7; i++) {
                  const n = weekdayName(addDays(new Date(), i))
                  if (imp?.calendario?.[n]) return `Prossima sessione: ${n}, ${imp.calendario[n]}.`
                }
                return ''
              })()}
            </Empty>
          )}
        </Card>

        <Card title="Questa settimana">
          <div className="week-strip">
            {settimana.map((g) => (
              <div
                key={g.nome}
                className={`week-day ${g.data === oggi ? 'today' : ''} ${g.fatto ? 'done' : g.previsto ? 'planned' : 'rest'}`}
                title={g.fatto?.giorno || g.previsto || 'Riposo'}
              >
                <span className="wd-name">{g.nome.slice(0, 3)}</span>
                <span className="wd-dot">{g.fatto ? <Icon name="check" size={14} /> : null}</span>
                <span className="wd-label">{sigla(g) || (g.fatto ? '' : '–')}</span>
              </div>
            ))}
          </div>
          <p className="week-summary">{riepilogo}</p>
          {legenda && <p className="muted small">{legenda}</p>}
          {ultimaSessione && (
            <p className="muted small">
              Ultima sessione: {formatDate(ultimaSessione.data)}.{' '}
              <button className="btn btn-link" onClick={() => navigate('allenamento', { tab: 'storico' })}>
                Importa da Hevy
              </button>
            </p>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card
          title="Pasti di oggi"
          action={
            <button className="btn btn-ghost" onClick={() => navigate('cibo')}>
              Vai al cibo <Icon name="chevron" size={16} />
            </button>
          }
        >
          {pastiOggi.length ? (
            <ul className="meal-list">
              {pastiOggi.map((p, i) => (
                <li key={i}>
                  <span className="meal-type">{p.tipo}</span>
                  <span className={p.fatto ? 'muted' : ''}>{p.piatto}</span>
                  {p.fatto && (
                    <span className="done-mini" aria-label="mangiato">
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nessun pasto pianificato per oggi: aggiungilo in Cibo → Piano pasti o chiedi a Claude.</Empty>
          )}
          {inScadenza.length > 0 && (
            <div className="warn-box">
              In scadenza nel frigo: {inScadenza.map((a) => a.nome).join(', ')}
            </div>
          )}
          {imp?.target && (
            <p className="muted small">
              Target indicativo: ~{imp.target.kcal} kcal · {imp.target.proteine_g} g proteine
            </p>
          )}
        </Card>

        <Card
          title="Progressi"
          action={
            <button className="btn btn-ghost" onClick={() => navigate('allenamento', { tab: 'progressi' })}>
              Dettagli <Icon name="chevron" size={16} />
            </button>
          }
        >
          <div className="stats stats-link" role="link" tabIndex={0} title="Peso e misure"
            onClick={() => navigate('salute')} onKeyDown={(e) => e.key === 'Enter' && navigate('salute')}>
            <Stat
              label="Media peso 7 gg"
              value={media != null ? round1(media) : null}
              unit="kg"
              hint={pesi.length ? `ultima pesata ${pesi[pesi.length - 1].peso_kg} kg` : 'nessuna pesata'}
            />
            <Stat
              label="vs settimana prima"
              value={delta != null ? `${delta > 0 ? '+' : ''}${delta}` : null}
              unit="kg"
              hint={
                delta == null
                  ? 'servono 2 settimane di dati'
                  : delta < -0.9
                    ? 'calo rapido: occhio al recupero'
                    : delta <= -0.2
                      ? 'ritmo giusto'
                      : 'stabile'
              }
            />
          </div>
          <div className="lifts">
            {fondamentali.map(({ nome, ultimo, diff }) => (
              <div className="lift" key={nome}>
                <span>{nome}</span>
                <span className="lift-val">
                  {formatSet(ultimo.top)}
                  {diff != null && (
                    <span className={`delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
                      {diff > 0 ? `+${diff}` : diff} kg
                    </span>
                  )}
                </span>
              </div>
            ))}
            {!fondamentali.length && <p className="muted small">Nessuna sessione recente dei fondamentali.</p>}
            <p className="muted small">
              Serie migliore e variazione del 1RM stimato {dal === seiSett ? 'nelle ultime 6 settimane' : 'da inizio scheda'}.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
