import { useState, useEffect } from 'react'
import Dashboard from './pages/dashboard'

type Trace = { etape: string; outil?: string; entree?: any; sortie?: any; decision: string }
type Msg = { role: 'client' | 'kenza'; text: string }

const CLIENT_ID = 'demo'
const API = 'http://localhost:3000'

export default function App() {
  const [onglet, setOnglet] = useState<'chat' | 'bord'>('chat')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Sonde la base : c'est ainsi qu'une relance décidée par l'agent apparaît toute seule.
  useEffect(() => {
    const t = setInterval(async () => {
      if (loading || onglet !== 'chat') return
      try {
        const r = await fetch(`${API}/api/messages?clientId=${CLIENT_ID}`)
        const rows = await r.json()
        if (Array.isArray(rows) && rows.length !== msgs.length) {
          setMsgs(rows.map((m: any) => ({
            role: m.role === 'client' ? 'client' : 'kenza',
            text: m.contenu,
          })))
        }
      } catch { /* API pas encore prête */ }
    }, 3000)
    return () => clearInterval(t)
  }, [msgs.length, loading, onglet])

  async function envoyer() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMsgs(m => [...m, { role: 'client', text }])
    setLoading(true)
    setTraces([])
    try {
      const r = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: CLIENT_ID, text }),
      })
      const data = await r.json()
      setMsgs(m => [...m, { role: 'kenza', text: data.text }])
      setTraces(data.traces)
    } catch {
      setMsgs(m => [...m, { role: 'kenza', text: "(erreur de connexion à l'API)" }])
    }
    setLoading(false)
  }

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.marque}>Kenza</div>
        <nav style={S.nav}>
          <button
            style={{ ...S.onglet, ...(onglet === 'chat' ? S.actif : {}) }}
            onClick={() => setOnglet('chat')}
          >Conversation</button>
          <button
            style={{ ...S.onglet, ...(onglet === 'bord' ? S.actif : {}) }}
            onClick={() => setOnglet('bord')}
          >Tableau de bord</button>
        </nav>
      </header>

      {onglet === 'bord' ? <Dashboard /> : (
        <div style={S.corps}>
          <div style={S.chat}>
            <div style={S.msgs}>
              {msgs.map((m, i) => (
                <div key={i} style={{ ...S.bulle, ...(m.role === 'client' ? S.client : S.kenza) }}>
                  {m.text}
                </div>
              ))}
              {loading && <div style={{ ...S.bulle, ...S.kenza, opacity: .5 }}>…</div>}
            </div>
            <div style={S.saisie}>
              <input
                style={S.input}
                value={input}
                placeholder="chhal taman dyal…"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && envoyer()}
              />
              <button style={S.btn} onClick={envoyer}>Envoyer</button>
            </div>
          </div>

          <div style={S.panneau}>
            <div style={S.panneauTitre}>Raisonnement de l'agent</div>
            {traces.length === 0 && <p style={S.vide}>Les étapes s'afficheront ici.</p>}
            {traces.map((t, i) => (
              <div key={i} style={S.trace}>
                <div style={S.traceTitre}>{t.etape}{t.outil ? ` · ${t.outil}` : ''}</div>
                <div style={S.decision}>{t.decision}</div>
                {t.entree && <pre style={S.pre}>{JSON.stringify(t.entree)}</pre>}
                {t.sortie && <pre style={S.pre}>{JSON.stringify(t.sortie).slice(0, 300)}</pre>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f5f6f8' },
  header: { display: 'flex', alignItems: 'center', gap: 24, padding: '0 20px', height: 52, background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 },
  marque: { fontSize: 15, fontWeight: 600, color: '#111827' },
  nav: { display: 'flex', gap: 4 },
  onglet: { border: 'none', background: 'none', padding: '6px 12px', borderRadius: 7, fontSize: 13, color: '#6b7280', cursor: 'pointer' },
  actif: { background: '#eff6ff', color: '#2563eb', fontWeight: 600 },
  corps: { display: 'flex', flex: 1, minHeight: 0 },
  chat: { flex: 1, display: 'flex', flexDirection: 'column', padding: 20, background: '#fff', borderRight: '1px solid #e5e7eb' },
  msgs: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 },
  bulle: { maxWidth: '75%', padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' },
  client: { alignSelf: 'flex-end', background: '#2563eb', color: '#fff' },
  kenza: { alignSelf: 'flex-start', background: '#eef0f3', color: '#111827' },
  saisie: { display: 'flex', gap: 8, marginTop: 16 },
  input: { flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  btn: { padding: '10px 18px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 14, cursor: 'pointer' },
  panneau: { width: 420, padding: 20, overflowY: 'auto', background: '#fafbfc' },
  panneauTitre: { fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 12 },
  vide: { color: '#9ca3af', fontSize: 13 },
  trace: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fff' },
  traceTitre: { fontSize: 12, fontWeight: 600, color: '#2563eb' },
  decision: { fontSize: 13, margin: '4px 0', color: '#111827' },
  pre: { fontSize: 11, background: '#f6f7f9', padding: 6, borderRadius: 4, overflowX: 'auto', margin: '4px 0 0' },
}