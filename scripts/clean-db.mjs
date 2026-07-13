/**
 * ONE-TIME DATABASE CLEANUP SCRIPT
 * Wipes all test data: design codes, colorways, and transaction history.
 * Run with: node scripts/clean-db.mjs
 */

import { MongoClient } from 'mongodb'

const MONGODB_URI = 'mongodb+srv://manderaafricanwear_db_user:zm4dZDlNqEVPwyyp@cluster0.k8dbtlz.mongodb.net/?appName=Cluster0'
const DB_NAME = 'mandera-african-wear'

async function cleanDatabase() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')

    const db = client.db(DB_NAME)

    // List collections to confirm what exists
    const collections = await db.listCollections().toArray()
    console.log('\n📦 Found collections:', collections.map(c => c.name).join(', '))

    // Delete all design codes
    const dcResult = await db.collection('designCodes').deleteMany({})
    console.log(`\n🗑️  Deleted ${dcResult.deletedCount} design codes`)

    // Delete all colorways
    const cwResult = await db.collection('colorways').deleteMany({})
    console.log(`🗑️  Deleted ${cwResult.deletedCount} colorways`)

    // Delete all activity history
    const actResult = await db.collection('activities').deleteMany({})
    console.log(`🗑️  Deleted ${actResult.deletedCount} activity records`)

    console.log('\n✅ Database is now clean and ready for the owner!')
    console.log('   PIN is still set to: 1234 (change in .env.local before handover)')

  } catch (error) {
    console.error('❌ Error cleaning database:', error)
  } finally {
    await client.close()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

cleanDatabase()
