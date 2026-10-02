// Restores a backup made by scripts/backup.js. Existing documents with the same _id are replaced.
// Usage: MONGODB_URI=... node scripts/restore.js <backupDir>

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

(async () => {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: node scripts/restore.js <backupDir>');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pakmedrecord');
  const db = mongoose.connection.db;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json.gz'))) {
    const name = f.replace(/\.json\.gz$/, '');
    const lines = readline.createInterface({ input: fs.createReadStream(path.join(dir, f)).pipe(zlib.createGunzip()) });
    let batch = [];
    let count = 0;
    const flush = async () => {
      if (!batch.length) return;
      await db.collection(name).bulkWrite(batch.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })));
      count += batch.length;
      batch = [];
    };
    for await (const line of lines) {
      if (!line.trim()) continue;
      batch.push(EJSON.parse(line, { relaxed: false }));
      if (batch.length >= 500) await flush();
    }
    await flush();
    console.log(`${name}: ${count}`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
