// Dumps every collection (including uploaded files in GridFS) to gzipped Extended JSON.
// Usage: MONGODB_URI=... node scripts/backup.js [outDir]   -> outDir/<timestamp>/<collection>.json.gz
// Restore with scripts/restore.js.

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pakmedrecord';
  const out = path.resolve(process.argv[2] || 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(out, { recursive: true });
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const gz = zlib.createGzip();
    const file = fs.createWriteStream(path.join(out, `${name}.json.gz`));
    gz.pipe(file);
    let count = 0;
    for await (const doc of db.collection(name).find()) {
      gz.write(`${EJSON.stringify(doc, { relaxed: false })}\n`);
      count += 1;
    }
    gz.end();
    await new Promise((resolve) => file.on('finish', resolve));
    console.log(`${name}: ${count}`);
  }
  await mongoose.disconnect();
  console.log(`Backup written to ${out}`);
})().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
