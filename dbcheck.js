const { MongoClient } = require('mongodb'); 
async function run() { 
  const client = new MongoClient('mongodb+srv://manderaafricanwear_db_user:zm4dZDlNqEVPwyyp@cluster0.k8dbtlz.mongodb.net/?appName=Cluster0'); 
  await client.connect(); 
  const db = client.db('mandera-african-wear'); 
  const cats = await db.collection('designCodes').distinct('category'); 
  console.log('Categories in designCodes:', cats); 
  
  const colorwayCategories = await db.collection('colorways').aggregate([
    { $addFields: { designCodeIdObj: { $toObjectId: "$designCodeId" } } }, 
    { $lookup: { from: "designCodes", localField: "designCodeIdObj", foreignField: "_id", as: "design" } }, 
    { $unwind: "$design" }, 
    { $group: { _id: "$design.category", count: { $sum: 1 } } }
  ]).toArray(); 
  console.log('Categories in Colorways (Inventory API returns these items):', JSON.stringify(colorwayCategories, null, 2)); 
  await client.close(); 
} 
run().catch(console.dir);
