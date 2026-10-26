// Read-only backup of all collections to ./backups/<timestamp>/*.json
// Usage: node --env-file=.env.local scripts/backup-db.mjs
import { MongoClient } from 'mongodb'
import { mkdirSync, writeFileSync } from 'node:fs'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI missing (run with --env-file=.env.local)')

const client = new MongoClient(uri)
await client.connect()
const db = client.db('mandera-african-wear')

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dir = `backups/${stamp}`
mkdirSync(dir, { recursive: true })

for (const { name } of await db.listCollections().toArray()) {
  const docs = await db.collection(name).find({}).toArray()
  writeFileSync(`${dir}/${name}.json`, JSON.stringify(docs, null, 2))
  console.log(`${name}: ${docs.length} documents`)
}
console.log(`Backup saved to ${dir}`)
await client.close()
