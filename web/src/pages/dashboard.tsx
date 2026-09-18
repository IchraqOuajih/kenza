import { useEffect, useState } from 'react'

const API = 'http://localhost:3000'

type Data = {
  kpis: {
    conversations: number; conversationsOuvertes: number
    commandes: number; caAgent: number; conversion: number
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

export default function Dashboard() {
  const [d, setD] = useState<Data | null>(null)

  useEffect(() => {
    const charger = async () => {
      try {
        const r = await fetch(`${API}/api/dashboard`)
        setD(await r.json())
      } catch { /* API pas prête */ }
    }
    charger()
    const t = setInterval(charger, 5000)
    return () => clearInterval(t)
  }, [])

  if (!d) return <div style={S.vide}>Chargement…</div>

  const k = d.kpis

  return (
    <div style={S.page}>
      <div style={S.kpis}>
        <Tuile valeur={String(k.commandes)} label="commandes créées par l'agent" accent />
        <Tuile valeur={mad(k.caAgent)} label="chiffre d'affaires" />
        <Tuile valeur={`${k.conversion} %`} label="taux de conversion" />
        <Tuile valeur={String(k.conversationsOuvertes)} label="conversations ouvertes" />
        <Tuile valeur={String(k.relancesEnvoyees)} label="relances envoyées" />
        <Tuile valeur={String(k.escalades)} label="escalades en attente" alerte={k.escalades > 0} />
      </div>

      <div style={S.colonnes}>
        <Bloc titre="Dernières commandes">
          {d.dernieresCommandes.length === 0 && <p style={S.rien}>Aucune commande.</p>}
          {d.dernieresCommandes.map(c => (
            <div key={c.commande_id} style={S.ligne}>
              <div>
                <div style={S.fort}>{c.commande_id}</div>
                <div style={S.faible}>{c.client_id} · {c.ville_livraison}</div>
              </div>
              <div style={S.droite}>
                <div style={S.fort}>{mad(Number(c.total_mad))}</div>
                <div style={S.faible}>{heure(c.created_at)}</div>
              </div>
            </div>
          ))}
        </Bloc>

        <Bloc titre="File d'escalade">
          {d.escalades.length === 0 && <p style={S.rien}>Rien à traiter.</p>}
          {d.escalades.map(e => (
            <div key={e.id} style={S.ligne}>
              <div>
                <div style={S.fort}>{e.motif}</div>
                <div style={S.faible}>{e.contexte?.resume ?? ''}</div>
              </div>
              <div style={S.droite}>
                <div style={S.faible}>{heure(e.created_at)}</div>
              </div>
            </div>
          ))}
        </Bloc>

        <Bloc titre="Conversations">
          {d.fils.map((f, i) => (
            <div key={i} style={S.ligne}>
              <div>
                <div style={S.fort}>{f.client_id}</div>
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

function Tuile({ valeur, label, accent, alerte }: {
  valeur: string; label: string; accent?: boolean; alerte?: boolean
}) {
  return (
    <div style={S.tuile}>
      <div style={{
        ...S.valeur,
        color: alerte ? '#b91c1c' : accent ? '#2563eb' : '#111827',
      }}>{valeur}</div>
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

const S: Record<string, React.CSSProperties> = {
  page: { padding: 24, background: '#f5f6f8', minHeight: '100%', overflowY: 'auto' },
  vide: { padding: 24, color: '#6b7280', fontSize: 14 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 },
  tuile: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px' },
  valeur: { fontSize: 28, fontWeight: 600, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' },
  label: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  colonnes: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 },
  bloc: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 },
  blocTitre: { fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 12 },
  ligne: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #f3f4f6' },
  fort: { fontSize: 13, color: '#111827' },
  faible: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  droite: { textAlign: 'right', whiteSpace: 'nowrap' },
  rien: { fontSize: 13, color: '#9ca3af', margin: 0 },
}