import { useState, useEffect } from 'react'

type Trace = { etape: string; outil?: string; entree?: any; sortie?: any; decision: string }
type Msg = { role: 'client' | 'kenza'; text: string }

const CLIENT_ID = 'demo'
const API = 'http://localhost:3000'

export default function App() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Sonde la base : c'est ainsi qu'une relance décidée par l'agent apparaît toute seule.
  useEffect(() => {
    const t = setInterval(async () => {
      if (loading) return
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
  }, [msgs.length, loading])

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
    <div style={S.page}>
      <div style={S.chat}>
        <h2 style={S.h}>Kenza</h2>
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
        <h2 style={S.h}>Raisonnement de l'agent</h2>
        {traces.length === 0 && <p style={S.vide}>Les étapes s'afficheront ici.</p>}
        {traces.map((t, i) => (
          <div key={i} style={S.trace}>
            <div style={S.traceTitre}>
              {t.etape}{t.outil ? ` · ${t.outil}` : ''}
            </div>
            <div style={S.decision}>{t.decision}</div>
            {t.entree && <pre style={S.pre}>{JSON.stringify(t.entree)}</pre>}
            {t.sortie && <pre style={S.pre}>{JSON.stringify(t.sortie).slice(0, 300)}</pre>}
          </div>
        ))}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f5f6f8' },
  chat: { flex: 1, display: 'flex', flexDirection: 'column', padding: 20, borderRight: '1px solid #ddd', background: '#fff' },
  panneau: { width: 420, padding: 20, overflowY: 'auto', background: '#fafbfc' },
  h: { fontSize: 16, margin: '0 0 16px', color: '#111' },
  msgs: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 },
  bulle: { maxWidth: '75%', padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' },
  client: { alignSelf: 'flex-end', background: '#2563eb', color: '#fff' },
  kenza: { alignSelf: 'flex-start', background: '#eef0f3', color: '#111' },
  saisie: { display: 'flex', gap: 8, marginTop: 16 },
  input: { flex: 1, padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14 },
  btn: { padding: '10px 18px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 14, cursor: 'pointer' },
  vide: { color: '#888', fontSize: 13 },
  trace: { border: '1px solid #e3e5e8', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fff' },
  traceTitre: { fontSize: 12, fontWeight: 600, color: '#2563eb' },
  decision: { fontSize: 13, margin: '4px 0' },
  pre: { fontSize: 11, background: '#f6f7f9', padding: 6, borderRadius: 4, overflowX: 'auto', margin: '4px 0 0' },
}