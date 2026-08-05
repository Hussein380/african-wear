const { MongoClient } = require('mongodb'); 
async function run() { 
  const client = new MongoClient('mongodb+srv://manderaafricanwear_db_user:zm4dZDlNqEVPwyyp@cluster0.k8dbtlz.mongodb.net/?appName=Cluster0'); 
  await client.connect(); 
  const db = client.db('mandera-african-wear'); 
  
  const activities = await db.collection('activities').find({}).sort({ timestamp: -1 }).limit(10).toArray();
  console.log('Recent activities:', JSON.stringify(activities, null, 2));
  
  await client.close(); 
} 
run().catch(console.dir);
