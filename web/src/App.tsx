import { useState, useEffect, useRef } from 'react'
import Dashboard from './pages/dashboard'

type Trace = { etape: string; outil?: string; entree?: any; sortie?: any; decision: string }
type Msg = { role: 'client' | 'kenza' | 'commercant'; text: string; at?: string; image?: string }

const API = 'http://localhost:3000'

const COURANTES = [
  'salam, bghit nchri chi haja',
  'chnou kayn 3andkom?',
  'wach kayn chi promotion?',
  'chhal katsswa livraison?',
  'f chhal katwsel lcommande?',
  'bonjour, je cherche un cadeau',
]

const LIMITES = [
  '3tini chi remise',
  'wach momkin nrejje3 chi haja?',
  'bghit nlghi lcommande dyali',
]

const FAMILLES: Record<string, string> = {
  apercu_catalogue: '#8ed3c0',
  rechercher_produit: '#53bdeb',
  rechercher_par_apparence: '#c084fc',
  analyse_image: '#c084fc',
  verifier_stock: '#53bdeb',
  alternatives: '#53bdeb',
  historique_client: '#53bdeb',
  commandes_annulables: '#53bdeb',
  promotions_en_cours: '#f0a35e',
  infos_boutique: '#8ed3c0',
  infos_livraison: '#4dd0c1',
  calculer_devis: '#7f9cf5',
  creer_commande: '#00a884',
  annuler_commande: '#f97316',
  planifier_relance: '#4dd0c1',
  escalader: '#f15c6d',
}

/** Le modèle décide et rédige · le code calcule et engage. */
function acteur(t: Trace): 'modele' | 'code' {
  if (t.etape === 'vision') return 'modele'
  if (t.outil) return 'modele'
  if (t.etape === 'réponse') return 'modele'
  return 'code'
}

function heure(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const Coches = () => (
  <svg viewBox="0 0 17 11" width="16" height="11" style={{ marginLeft: 4, verticalAlign: -1 }}>
    <path fill="#53bdeb" d="M11.4.6a.5.5 0 0 0-.71.05L5.6 6.95 3.4 4.6a.5.5 0 1 0-.73.68l2.6 2.78a.5.5 0 0 0 .75-.02L11.46 1.3a.5.5 0 0 0-.06-.7z" />
    <path fill="#53bdeb" d="M16.1.6a.5.5 0 0 0-.7.05l-5.1 6.3-.63-.67-.73.92.98 1.04a.5.5 0 0 0 .75-.02l5.5-6.92a.5.5 0 0 0-.07-.7z" />
  </svg>
)

const Trombone = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="#8696a0">
    <path d="M16.5 6v11.5a4 4 0 1 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 1 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 1 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z" />
  </svg>
)

const DOODLE = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
<g fill="none" stroke="#ffffff" stroke-opacity="0.028" stroke-width="1.5" stroke-linecap="round">
<circle cx="26" cy="30" r="10"/>
<path d="M68 22 l11 11 -11 11 -11 -11 z"/>
<path d="M118 20 q9 -9 18 0 t18 0"/>
<rect x="20" y="76" width="20" height="15" rx="3"/>
<path d="M70 80 h26 M70 87 h16"/>
<circle cx="138" cy="84" r="8"/>
<path d="M24 128 l9 9 16 -18"/>
<circle cx="82" cy="132" r="11"/>
<path d="M124 126 h26 v18 h-26 z"/>
</g></svg>`

const FOND = `url("data:image/svg+xml,${encodeURIComponent(DOODLE)}")`

/** Redimensionne avant l'envoi : une photo de téléphone fait 4 Mo, on n'en a pas besoin. */
function lireEtRedimensionner(file: File, max = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('lecture impossible'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('image illisible'))
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * r)
        c.height = Math.round(img.height * r)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.8))
      }
      img.src = fr.result as string
    }
    fr.readAsDataURL(file)
  })
}

export default function App() {
  const [onglet, setOnglet] = useState<'chat' | 'bord'>('chat')
  const [clientId, setClientId] = useState(() => '06' + Math.floor(10000000 + Math.random() * 89999999))
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [statut, setStatut] = useState<'ouverte' | 'escalade'>('ouverte')
  const [input, setInput] = useState('')
  const [enAttente, setEnAttente] = useState(0)

  const finRef = useRef<HTMLDivElement>(null)
  const fichierRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length, enAttente])

  useEffect(() => {
    const t = setInterval(async () => {
      if (enAttente > 0 || onglet !== 'chat') return
      try {
        const r = await fetch(`${API}/api/messages?clientId=${clientId}`)
        const data = await r.json()
        setStatut(data.statut)
        if (Array.isArray(data.messages) && data.messages.length !== msgs.length) {
          setMsgs(data.messages.map((m: any) => ({
            role: m.role === 'client' ? 'client' : m.role === 'commercant' ? 'commercant' : 'kenza',
            text: m.contenu,
            at: m.created_at,
          })))
        }
      } catch { /* API pas prête */ }
    }, 3000)
    return () => clearInterval(t)
  }, [msgs.length, enAttente, onglet, clientId])

  async function envoyerTexte(text: string, image?: string) {
    if ((!text.trim() && !image) || statut === 'escalade') return
    setMsgs(m => [...m, { role: 'client', text, at: new Date().toISOString(), image }])
    setEnAttente(n => n + 1)
    try {
      const r = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, text, image }),
      })
      const data = await r.json()
      if (data.text) {
        setMsgs(m => [...m, { role: 'kenza', text: data.text, at: new Date().toISOString() }])
        setTraces(data.traces ?? [])
      } else if (data.traces?.length) {
        setTraces(data.traces)
      }
    } catch {
      setMsgs(m => [...m, { role: 'kenza', text: "(erreur de connexion à l'API)", at: new Date().toISOString() }])
    }
    setEnAttente(n => n - 1)
  }

  async function envoyer() {
    const text = input.trim()
    if (!text) return
    setInput('')
    await envoyerTexte(text)
  }

  async function choisirPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const texte = input.trim()
    setInput('')
    try {
      const dataUrl = await lireEtRedimensionner(f)
      await envoyerTexte(texte, dataUrl)
    } catch {
      setMsgs(m => [...m, { role: 'kenza', text: '(impossible de lire cette image)', at: new Date().toISOString() }])
    }
  }

  function nouveauClient() {
    setClientId('06' + Math.floor(10000000 + Math.random() * 89999999))
    setMsgs([]); setTraces([]); setStatut('ouverte')
  }

  const occupe = enAttente > 0

  return (
    <div style={S.app}>
      <style>{CSS}</style>

      <header style={S.topbar}>
        <div style={S.identite}>
          <div style={S.avatar}>K</div>
          <div>
            <div style={S.nom}>Kenza</div>
            <div style={S.etat}>{occupe ? 'en train d’écrire…' : 'en ligne'}</div>
          </div>
        </div>

        <nav style={S.nav}>
          <button style={{ ...S.onglet, ...(onglet === 'chat' ? S.actif : {}) }}
                  onClick={() => setOnglet('chat')}>Conversation</button>
          <button style={{ ...S.onglet, ...(onglet === 'bord' ? S.actif : {}) }}
                  onClick={() => setOnglet('bord')}>Tableau de bord</button>
        </nav>

        <div style={{ flex: 1 }} />
        <span style={S.numero}>{clientId}</span>
        <button style={S.btnGhost} onClick={nouveauClient}>Nouveau client</button>
      </header>

      {onglet === 'bord' ? (
        <div style={S.bord}><Dashboard /></div>
      ) : (
        <div style={S.corps}>
          <div style={S.chat}>
            <div style={S.fil} className="scroll">
              <div style={S.systeme}>
                Simulateur WhatsApp — les messages passent par l’agent, pas par un script.
              </div>

              {statut === 'escalade' && (
                <div style={{ ...S.systeme, ...S.systemeAlerte }}>
                  Un conseiller a pris le relais. Répondez depuis le tableau de bord,
                  ou cliquez sur « Nouveau client ».
                </div>
              )}

              {msgs.map((m, i) => {
                const moi = m.role === 'client'
                return (
                  <div key={i} style={{ ...S.rang, justifyContent: moi ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      ...S.bulle,
                      ...(moi ? S.sortant : m.role === 'commercant' ? S.commercant : S.entrant),
                    }}>
                      {m.role === 'commercant' && <div style={S.auteur}>Le commerçant</div>}
                      {m.image && <img src={m.image} alt="" style={S.photo} />}
                      {m.text && <span>{m.text}</span>}
                      <span style={S.meta}>
                        {heure(m.at)}
                        {moi && <Coches />}
                      </span>
                    </div>
                  </div>
                )
              })}

              {occupe && (
                <div style={{ ...S.rang, justifyContent: 'flex-start' }}>
                  <div style={{ ...S.bulle, ...S.entrant, ...S.frappe }}>
                    <span className="pt" /><span className="pt" /><span className="pt" />
                  </div>
                </div>
              )}

              <div ref={finRef} />
            </div>

            <div style={S.suggestions}>
              {COURANTES.map(s => (
                <button key={s} style={S.puce} onClick={() => envoyerTexte(s)}
                        disabled={occupe || statut === 'escalade'}>{s}</button>
              ))}
              <span style={S.separateur} />
              {LIMITES.map(s => (
                <button key={s} style={{ ...S.puce, ...S.puceLimite }} onClick={() => envoyerTexte(s)}
                        disabled={occupe || statut === 'escalade'}>{s}</button>
              ))}
            </div>

            <div style={S.barreSaisie}>
              <input ref={fichierRef} type="file" accept="image/*"
                     style={{ display: 'none' }} onChange={choisirPhoto} />
              <button style={S.trombone} onClick={() => fichierRef.current?.click()}
                      disabled={statut === 'escalade' || occupe} aria-label="Envoyer une photo">
                <Trombone />
              </button>
              <input
                style={S.champ}
                value={input}
                disabled={statut === 'escalade'}
                placeholder={statut === 'escalade' ? 'Le conseiller va vous répondre…' : 'Écrivez un message'}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && envoyer()}
              />
              <button style={S.envoi} onClick={envoyer} aria-label="Envoyer">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#0b141a">
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>

          <aside style={S.panneau} className="scroll">
            <div style={S.panneauTitre}>Raisonnement de l’agent</div>
            <div style={S.legende}>
              <span style={S.legItem}><i style={{ ...S.carre, background: '#a78bfa' }} /> le modèle décide</span>
              <span style={S.legItem}><i style={{ ...S.carre, background: '#8696a0' }} /> le code calcule</span>
            </div>

            {traces.length === 0 && (
              <p style={S.vide}>Les étapes du dernier message s’afficheront ici.</p>
            )}

            {traces.map((t, i) => {
              const teinte = acteur(t) === 'modele' ? '#a78bfa' : '#8696a0'
              const etiquette = t.outil ?? (t.etape === 'vision' ? 'analyse_image' : null)
              const cOutil = etiquette ? (FAMILLES[etiquette] ?? '#8696a0') : null
              return (
                <div key={i} style={{ ...S.trace, borderLeft: `3px solid ${teinte}` }}>
                  <div style={S.traceHaut}>
                    <span style={S.etape}>{t.etape}</span>
                    {etiquette && (
                      <span style={{ ...S.badge, color: cOutil!, border: `1px solid ${cOutil}44` }}>
                        {etiquette}
                      </span>
                    )}
                  </div>
                  <div style={S.decision}>{t.decision}</div>
                  {(t.entree || t.sortie) && (
                    <details style={{ marginTop: 6 }}>
                      <summary style={S.summary}>données</summary>
                      {t.entree && <pre style={S.pre}><b>entrée </b>{JSON.stringify(t.entree)}</pre>}
                      {t.sortie && <pre style={S.pre}><b>sortie </b>{JSON.stringify(t.sortie).slice(0, 600)}</pre>}
                    </details>
                  )}
                </div>
              )
            })}
          </aside>
        </div>
      )}
    </div>
  )
}

const CSS = `
  * { box-sizing: border-box }
  body { margin: 0; background: #0b141a }
  @keyframes pulseDot {
    0%, 60%, 100% { opacity: .3; transform: translateY(0) }
    30%           { opacity: 1;  transform: translateY(-3px) }
  }
  .pt { display:inline-block; width:6px; height:6px; margin-right:4px; border-radius:50%;
        background:#8696a0; animation: pulseDot 1.2s infinite }
  .pt:nth-child(2) { animation-delay:.15s }
  .pt:nth-child(3) { animation-delay:.3s; margin-right:0 }

  .scroll::-webkit-scrollbar { width: 6px }
  .scroll::-webkit-scrollbar-thumb { background: #374248; border-radius: 3px }

  details > summary { list-style:none; cursor:pointer }
  details > summary::-webkit-details-marker { display:none }

  button:disabled { opacity:.4; cursor:default }
  input::placeholder { color:#8696a0 }
`

const S: Record<string, React.CSSProperties> = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0b141a',
         fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif', color: '#e9edef' },

  topbar: { display: 'flex', alignItems: 'center', gap: 18, height: 60, padding: '0 16px',
            background: '#202c33', borderBottom: '1px solid rgba(134,150,160,.15)', flexShrink: 0 },
  identite: { display: 'flex', alignItems: 'center', gap: 11 },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: '#00a884', color: '#0b141a',
            display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700 },
  nom: { fontSize: 15, fontWeight: 500, color: '#e9edef', lineHeight: 1.25 },
  etat: { fontSize: 12, color: '#8696a0' },
  nav: { display: 'flex', gap: 2, marginLeft: 8 },
  onglet: { border: 'none', background: 'none', padding: '6px 13px', borderRadius: 8,
            fontSize: 13.5, color: '#8696a0', cursor: 'pointer' },
  actif: { background: 'rgba(0,168,132,.15)', color: '#00a884', fontWeight: 600 },
  numero: { fontSize: 12, color: '#8696a0', fontFamily: 'ui-monospace, monospace' },
  btnGhost: { padding: '7px 13px', borderRadius: 8, border: '1px solid rgba(134,150,160,.3)',
              background: 'transparent', color: '#e9edef', fontSize: 13, cursor: 'pointer' },

  corps: { display: 'flex', flex: 1, minHeight: 0 },

  chat: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
          background: `${FOND} repeat, #0b141a`, backgroundSize: '360px 360px' },

  fil: { flex: 1, overflowY: 'auto', padding: '18px 6% 8px' },
  systeme: { margin: '0 auto 14px', maxWidth: 460, textAlign: 'center', fontSize: 12.5,
             color: '#8696a0', background: '#182229', padding: '7px 13px', borderRadius: 8,
             lineHeight: 1.5 },
  systemeAlerte: { background: '#2b2312', color: '#f3c677' },

  rang: { display: 'flex', marginBottom: 6 },
  bulle: { maxWidth: '68%', padding: '7px 9px 6px 11px', borderRadius: 9, fontSize: 14.2,
           lineHeight: 1.42, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
           boxShadow: '0 1px 1px rgba(11,20,26,.35)', position: 'relative' },
  sortant: { background: '#005c4b', color: '#e9edef', borderTopRightRadius: 2 },
  entrant: { background: '#202c33', color: '#e9edef', borderTopLeftRadius: 2 },
  commercant: { background: '#3a2e18', color: '#f3c677', borderTopLeftRadius: 2 },
  auteur: { fontSize: 11.5, fontWeight: 600, marginBottom: 3, color: '#f0b429' },
  photo: { display: 'block', maxWidth: 220, borderRadius: 7, marginBottom: 5 },
  meta: { float: 'right', fontSize: 11, color: 'rgba(233,237,239,.5)',
          marginLeft: 10, marginTop: 6, whiteSpace: 'nowrap' },
  frappe: { padding: '11px 14px', display: 'flex', alignItems: 'center' },

  suggestions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7,
                 padding: '10px 6% 4px', flexShrink: 0 },
  puce: { flexShrink: 0, padding: '6px 13px', borderRadius: 999, fontSize: 12.5,
          background: 'rgba(32,44,51,.92)', color: '#8ed3c0',
          border: '1px solid rgba(0,168,132,.35)', cursor: 'pointer', whiteSpace: 'nowrap' },
  puceLimite: { color: '#c7b2f0', border: '1px solid rgba(167,139,250,.35)' },
  separateur: { flexShrink: 0, width: 1, height: 18, background: 'rgba(134,150,160,.25)', margin: '0 4px' },

  barreSaisie: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 6% 14px', flexShrink: 0 },
  trombone: { width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'transparent',
              display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  champ: { flex: 1, padding: '11px 16px', borderRadius: 9, border: 'none', outline: 'none',
           background: '#2a3942', color: '#e9edef', fontSize: 14.5 },
  envoi: { width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#00a884',
           display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },

  panneau: { width: 400, flexShrink: 0, overflowY: 'auto', padding: 18,
             background: '#111b21', borderLeft: '1px solid rgba(134,150,160,.15)' },
  panneauTitre: { fontSize: 13.5, fontWeight: 600, color: '#e9edef' },
  legende: { display: 'flex', gap: 14, margin: '9px 0 14px' },
  legItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#8696a0' },
  carre: { width: 8, height: 8, borderRadius: 2, display: 'inline-block' },
  vide: { color: '#8696a0', fontSize: 13, lineHeight: 1.5 },

  trace: { background: '#202c33', borderRadius: 8, padding: '9px 11px', marginBottom: 8 },
  traceHaut: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  etape: { fontSize: 10.5, textTransform: 'uppercase', letterSpacing: .6, color: '#8696a0', fontWeight: 600 },
  badge: { fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
           fontFamily: 'ui-monospace, monospace' },
  decision: { fontSize: 13, color: '#e9edef', lineHeight: 1.45 },
  summary: { fontSize: 11, color: '#8696a0', userSelect: 'none' },
  pre: { fontSize: 10.5, background: '#111b21', color: '#b9c4c9', padding: 7, borderRadius: 5,
         overflowX: 'auto', margin: '5px 0 0', lineHeight: 1.4 },

  bord: { flex: 1, overflowY: 'auto', background: '#0b141a' },
}