import { useEffect, useState } from 'react'

const API = 'http://localhost:3000'

type Data = {
  kpis: {
    conversations: number; conversationsOuvertes: number
    commandes: number; caAgent: number; annulees: number; conversion: number
    escalades: number; relancesEnvoyees: number; relancesEnAttente: number
  }
  dernieresCommandes: any[]
  escalades: any[]
  fils: any[]
}

const mad = (n: number) =>
  new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(n) + ' MAD'

const heure = (s: string) =>
  new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const STATUTS: Record<string, { fond: string; texte: string; libelle: string }> = {
  'annulée':        { fond: 'rgba(241,92,109,.15)', texte: '#f15c6d', libelle: 'annulée' },
  'en préparation': { fond: 'rgba(240,163,94,.15)', texte: '#f0a35e', libelle: 'en préparation' },
  'expédiée':       { fond: 'rgba(83,189,235,.15)', texte: '#53bdeb', libelle: 'expédiée' },
  'livrée':         { fond: 'rgba(0,168,132,.15)',  texte: '#00a884', libelle: 'livrée' },
}

export default function Dashboard() {
  const [d, setD] = useState<Data | null>(null)
  const [reponses, setReponses] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState<string | null>(null)

  const charger = async () => {
    try {
      const r = await fetch(`${API}/api/dashboard`)
      setD(await r.json())
    } catch { /* API pas prête */ }
  }

  useEffect(() => {
    charger()
    const t = setInterval(charger, 5000)
    return () => clearInterval(t)
  }, [])

  async function repondre(id: string) {
    const texte = (reponses[id] ?? '').trim()
    if (!texte) return
    setEnvoi(id)
    try {
      await fetch(`${API}/api/escalades/${id}/repondre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte }),
      })
      setReponses(r => ({ ...r, [id]: '' }))
      await charger()
    } finally { setEnvoi(null) }
  }

  async function ignorer(id: string) {
    setEnvoi(id)
    try {
      await fetch(`${API}/api/escalades/${id}/ignorer`, { method: 'POST' })
      await charger()
    } finally { setEnvoi(null) }
  }

  if (!d) return <div style={S.vide}>Chargement…</div>

  const k = d.kpis

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <div style={S.kpis}>
        <Tuile valeur={String(k.commandes)} label="commandes créées par l'agent" couleur="#00a884" />
        <Tuile valeur={mad(k.caAgent)} label="chiffre d'affaires" couleur="#e9edef" />
        <Tuile valeur={`${k.conversion} %`} label="taux de conversion" couleur="#53bdeb" />
        <Tuile valeur={String(k.annulees)} label="commandes annulées" couleur="#8696a0" />
        <Tuile valeur={String(k.relancesEnvoyees)} label="relances envoyées" couleur="#4dd0c1" />
        <Tuile valeur={String(k.conversationsOuvertes)} label="conversations ouvertes" couleur="#e9edef" />
        <Tuile valeur={String(k.escalades)} label="escalades en attente"
               couleur={k.escalades > 0 ? '#f0a35e' : '#8696a0'} />
      </div>

      <Bloc titre={`File d'escalade${k.escalades ? ` — ${k.escalades} en attente` : ''}`}>
        {d.escalades.length === 0 && <p style={S.rien}>Rien à traiter. L'agent gère tout seul.</p>}
        {d.escalades.map(e => (
          <div key={e.id} style={S.escalade}>
            <div style={S.escaladeHaut}>
              <span style={S.motif}>{e.motif}</span>
              <span style={S.faible}>{e.client_id ?? '—'} · {heure(e.created_at)}</span>
            </div>

            <div style={S.resume}>{e.contexte?.resume ?? ''}</div>

            {Array.isArray(e.messages) && e.messages.length > 0 && (
              <details style={S.details}>
                <summary style={S.summary}>voir la conversation</summary>
                <div style={S.extrait}>
                  {[...e.messages].reverse().map((m: any, i: number) => (
                    <div key={i} style={S.extraitLigne}>
                      <span style={{ ...S.qui, color: m.role === 'client' ? '#53bdeb' : '#8ed3c0' }}>
                        {m.role === 'client' ? 'client' : m.role === 'commercant' ? 'vous' : 'Kenza'}
                      </span>
                      <span>{m.contenu}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div style={S.actions}>
              <input
                style={S.champ}
                placeholder="Votre réponse au client…"
                value={reponses[e.id] ?? ''}
                disabled={envoi === String(e.id)}
                onChange={ev => setReponses(r => ({ ...r, [e.id]: ev.target.value }))}
                onKeyDown={ev => ev.key === 'Enter' && repondre(e.id)}
              />
              <button style={S.btnVert} onClick={() => repondre(e.id)}
                      disabled={envoi === String(e.id) || !(reponses[e.id] ?? '').trim()}>
                Répondre
              </button>
              <button style={S.btnGris} onClick={() => ignorer(e.id)}
                      disabled={envoi === String(e.id)}>
                Ignorer
              </button>
            </div>
          </div>
        ))}
      </Bloc>

      <div style={S.colonnes}>
        <Bloc titre="Dernières commandes">
          {d.dernieresCommandes.length === 0 && <p style={S.rien}>Aucune commande.</p>}
          {d.dernieresCommandes.map(c => {
            const st = STATUTS[c.statut] ?? { fond: 'rgba(134,150,160,.15)', texte: '#8696a0', libelle: c.statut }
            const annulee = c.statut === 'annulée'
            return (
              <div key={c.commande_id} style={{ ...S.ligne, opacity: annulee ? .55 : 1 }}>
                <div>
                  <div style={S.fort}>
                    {c.commande_id}
                    <span style={{ ...S.pastille, background: st.fond, color: st.texte }}>{st.libelle}</span>
                  </div>
                  <div style={S.faible}>{c.client_id} · {c.ville_livraison}</div>
                </div>
                <div style={S.droite}>
                  <div style={{ ...S.fort, textDecoration: annulee ? 'line-through' : 'none' }}>
                    {mad(Number(c.total_mad))}
                  </div>
                  <div style={S.faible}>{heure(c.created_at)}</div>
                </div>
              </div>
            )
          })}
          <p style={S.note}>
            Les commandes annulées sont exclues du chiffre d'affaires et du taux de conversion.
          </p>
        </Bloc>

        <Bloc titre="Conversations">
          {d.fils.map((f, i) => (
            <div key={i} style={S.ligne}>
              <div>
                <div style={S.fort}>
                  {f.client_id}
                  {f.statut === 'escalade' && (
                    <span style={{ ...S.pastille, background: 'rgba(240,163,94,.15)', color: '#f0a35e' }}>
                      chez le commerçant
                    </span>
                  )}
                </div>
                <div style={S.faible}>{f.canal} · {f.messages} messages</div>
              </div>
              <div style={S.droite}>
                <div style={S.faible}>{heure(f.updated_at)}</div>
              </div>
            </div>
          ))}
        </Bloc>
      </div>
    </div>
  )
}

function Tuile({ valeur, label, couleur }: { valeur: string; label: string; couleur: string }) {
  return (
    <div style={S.tuile}>
      <div style={{ ...S.valeur, color: couleur }}>{valeur}</div>
      <div style={S.label}>{label}</div>
    </div>
  )
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={S.bloc}>
      <div style={S.blocTitre}>{titre}</div>
      {children}
    </div>
  )
}

const CSS = `
  details > summary { list-style: none; cursor: pointer }
  details > summary::-webkit-details-marker { display: none }
  button:disabled { opacity: .4; cursor: default }
  input::placeholder { color: #8696a0 }
`

const S: Record<string, React.CSSProperties> = {
  page: { padding: 22, background: '#0b141a', minHeight: '100%', overflowY: 'auto',
          fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#e9edef' },
  vide: { padding: 24, color: '#8696a0', fontSize: 14, background: '#0b141a', minHeight: '100%' },

  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 11, marginBottom: 16 },
  tuile: { background: '#111b21', border: '1px solid rgba(134,150,160,.15)', borderRadius: 10, padding: '15px 17px' },
  valeur: { fontSize: 27, fontWeight: 600, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' },
  label: { fontSize: 11.5, color: '#8696a0', marginTop: 5 },

  colonnes: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 },
  bloc: { background: '#111b21', border: '1px solid rgba(134,150,160,.15)', borderRadius: 10, padding: 16 },
  blocTitre: { fontSize: 13, fontWeight: 600, color: '#e9edef', marginBottom: 12 },

  ligne: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0',
           borderTop: '1px solid rgba(134,150,160,.12)' },
  fort: { fontSize: 13, color: '#e9edef', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  faible: { fontSize: 11.5, color: '#8696a0', marginTop: 3 },
  droite: { textAlign: 'right', whiteSpace: 'nowrap' },
  rien: { fontSize: 13, color: '#8696a0', margin: 0 },
  note: { fontSize: 11, color: '#8696a0', marginTop: 12, marginBottom: 0, lineHeight: 1.5 },
  pastille: { fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' },

  escalade: { background: '#202c33', borderRadius: 8, padding: 12, marginBottom: 9 },
  escaladeHaut: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  motif: { fontSize: 12, fontWeight: 600, color: '#f0a35e', fontFamily: 'ui-monospace, monospace' },
  resume: { fontSize: 13, color: '#e9edef', margin: '6px 0 4px', lineHeight: 1.45 },

  details: { margin: '4px 0 8px' },
  summary: { fontSize: 11.5, color: '#8696a0', userSelect: 'none' },
  extrait: { background: '#111b21', borderRadius: 6, padding: 9, marginTop: 6,
             display: 'flex', flexDirection: 'column', gap: 5 },
  extraitLigne: { fontSize: 12, color: '#b9c4c9', lineHeight: 1.45 },
  qui: { fontWeight: 600, marginRight: 6 },

  actions: { display: 'flex', gap: 7, marginTop: 8 },
  champ: { flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none', outline: 'none',
           background: '#2a3942', color: '#e9edef', fontSize: 13 },
  btnVert: { padding: '9px 15px', borderRadius: 8, border: 'none', background: '#00a884',
             color: '#0b141a', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnGris: { padding: '9px 15px', borderRadius: 8, border: '1px solid rgba(134,150,160,.3)',
             background: 'transparent', color: '#8696a0', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
}