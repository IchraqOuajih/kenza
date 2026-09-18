import { handleMessage } from './agent'

async function main() {
  const r = await handleMessage({
    clientId: 'test',
    text: 'salam, chhal taman dyal foulard bordeaux? w kat waslo l Casablanca?',
    channel: 'simulator',
  })
  console.log('\n--- TRACES ---')
  for (const t of r.traces) console.log(JSON.stringify(t, null, 2))
  console.log('\n--- RÉPONSE ---\n', r.text)
  process.exit(0)
}
main()