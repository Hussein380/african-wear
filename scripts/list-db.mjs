/**
 * Lists all collections and document counts in the database.
 */

import { MongoClient } from 'mongodb'

const MONGODB_URI = 'mongodb+srv://manderaafricanwear_db_user:zm4dZDlNqEVPwyyp@cluster0.k8dbtlz.mongodb.net/?appName=Cluster0'

async function listDatabases() {
  const client = new MongoClient(MONGODB_URI)
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB\n')

    // List all databases
    const adminDb = client.db().admin()
    const { databases } = await adminDb.listDatabases()
    console.log('📂 Databases:')
    
    for (const dbInfo of databases) {
      if (dbInfo.name === 'admin' || dbInfo.name === 'local') continue
      console.log(`\n  [DB] ${dbInfo.name}`)
      const db = client.db(dbInfo.name)
      const collections = await db.listCollections().toArray()
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments()
        console.log(`    └── ${col.name}: ${count} documents`)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await client.close()
  }
}

listDatabases()
