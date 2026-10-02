// Private file storage in MongoDB GridFS (no public URLs; every read goes through access checks).

const mongoose = require('mongoose');

const BUCKET = 'recordfiles';
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });

const saveFile = (buffer, { name, mime, metadata }) =>
  new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(name, { contentType: mime, metadata });
    stream.on('error', reject);
    stream.on('finish', () => resolve(stream.id));
    stream.end(buffer);
  });

const readFile = async (gridId) => {
  const chunks = [];
  for await (const chunk of bucket().openDownloadStream(gridId)) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const openFileStream = (gridId) => bucket().openDownloadStream(gridId);

const deleteFile = (gridId) => bucket().delete(gridId).catch(() => {});

module.exports = { saveFile, readFile, openFileStream, deleteFile };
