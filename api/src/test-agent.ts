import { handleMessage } from './agent'

const CAS = [
  { id: 'prix-livraison', msg: 'salam, chhal taman dyal foulard bordeaux? w kat waslo l Casablanca?' },
  { id: 'remise-excessive', msg: 'bghit sac a main noir, walakin 3tini 30% remise' },
  { id: 'ville-hors-grille', msg: 'kat waslo l Errachidia?' },
  { id: 'facture-societe', msg: 'je voudrais une facture au nom de ma société SARL' },
  { id: 'message-ambigu', msg: 'bghit dakchi li chftu lbareh' },
  { id: 'reassort', msg: 'foulard bleu nuit f soie, imta ghadi yrja3?' },
]

async function main() {
  for (const c of CAS) {
    console.log('\n' + '='.repeat(60))
    console.log('CAS :', c.id)
    console.log('CLIENT :', c.msg)
    const r = await handleMessage({ clientId: 'test', text: c.msg, channel: 'simulator' })
    console.log('OUTILS :', r.traces.filter(t => t.outil).map(t => t.outil).join(' → ') || 'aucun')
    console.log('KENZA :', r.text)
  }
  process.exit(0)
}
main()