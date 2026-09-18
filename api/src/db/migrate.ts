import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import 'dotenv/config'

async function main() {
  const sql = readFileSync('api/src/db/schema.sql', 'utf8')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(sql)
  await client.end()
  console.log('Schéma créé.')
}

main().catch((e) => { console.error(e); process.exit(1) })