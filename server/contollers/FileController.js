const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Attachment = require('../models/AttachmentModel');
const Affiliation = require('../models/AffiliationModel');
const { saveFile, readFile, openFileStream, deleteFile } = require('../lib/files');
const { logAccess } = require('../lib/accessLog');
const { ocrEnabled, extractDocument, friendlyOcrError } = require('../ai/ocr');

const MAX_BYTES = 4 * 1024 * 1024; // keeps every upload under the hosting request limit

// Identify the real file type from its first bytes rather than trusting the browser
const sniff = (buf) => {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
};

const canAccess = async (user, att) => {
  if (user.role === 'patient') return att.patientCNIC === user.cnic;
  if (user.role !== 'doctor' || !user.verified) return false;
  return Boolean(await Affiliation.findOne({ patientCNIC: att.patientCNIC, doctorCNIC: user.cnic }));
};

const isUploader = (user, att) => att.uploadedBy.role === user.role && att.uploadedBy.cnic === user.cnic;

const loadAttachment = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'File not found' });
    return null;
  }
  const att = await Attachment.findById(req.params.id);
  if (!att || !(await canAccess(req.user, att))) {
    res.status(404).json({ error: 'File not found' });
    return null;
  }
  return att;
};

const runOcr = async (att, buffer) => {
  if (!ocrEnabled()) {
    att.ocr = { status: 'failed', error: 'Automatic reading is not configured on the server.' };
  } else {
    try {
      att.ocr = { status: 'done', ...(await extractDocument(buffer, att.mime)), error: '' };
    } catch (err) {
      console.error('OCR failed:', err.statusCode || '', err.message);
      att.ocr = { status: 'failed', error: friendlyOcrError(err) };
    }
  }
  await att.save();
  return att;
};

// POST /files/:patientCNIC  (raw file bytes; X-File-Name header) -> stored + read by AI
const upload = expressAsyncHandler(async (req, res) => {
  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return res.status(400).json({ error: 'No file received' });
  if (buffer.length > MAX_BYTES) return res.status(413).json({ error: 'File is larger than 4 MB. Try a smaller scan or photo.' });
  const mime = sniff(buffer);
  if (!mime) return res.status(415).json({ error: 'Only PDF, JPG, PNG or WebP files are supported.' });

  const name = decodeURIComponent(String(req.get('x-file-name') || 'document')).replace(/[\r\n"]/g, '').slice(0, 200) || 'document';
  const patientCNIC = Number(req.params.patientCNIC);
  const gridId = await saveFile(buffer, { name, mime, metadata: { patientCNIC } });
  const att = await Attachment.create({
    gridId, patientCNIC, name, mime, size: buffer.length,
    uploadedBy: { role: req.user.role, cnic: req.user.cnic },
  });
  await runOcr(att, buffer);
  res.status(201).json({ attachment: att });
});

const meta = expressAsyncHandler(async (req, res) => {
  const att = await loadAttachment(req, res);
  if (att) res.status(200).json({ attachment: att });
});

// Streams the original file (inline, or as a download with ?download=1)
const content = expressAsyncHandler(async (req, res) => {
  const att = await loadAttachment(req, res);
  if (!att) return;
  if (req.user.role === 'doctor') logAccess(att.patientCNIC, { role: 'doctor', cnic: req.user.cnic }, `Opened "${att.name}"`, req.ip);
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.set({
    'Content-Type': att.mime,
    'Content-Length': att.size,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(att.name)}`,
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  openFileStream(att.gridId)
    .on('error', () => !res.headersSent && res.status(404).end())
    .pipe(res);
});

// Try reading the file again (e.g. after a rate-limit)
const retryOcr = expressAsyncHandler(async (req, res) => {
  const att = await loadAttachment(req, res);
  if (!att) return;
  if (!isUploader(req.user, att)) return res.status(403).json({ error: 'Only the uploader can do this' });
  await runOcr(att, await readFile(att.gridId));
  res.status(200).json({ attachment: att });
});

// Uploader can delete a file until it's part of a record
const remove = expressAsyncHandler(async (req, res) => {
  const att = await loadAttachment(req, res);
  if (!att) return;
  if (!isUploader(req.user, att)) return res.status(403).json({ error: 'Only the uploader can delete this file' });
  if (att.linked) return res.status(409).json({ error: 'This file is part of a record and can no longer be deleted' });
  await deleteFile(att.gridId);
  await att.deleteOne();
  res.status(200).json({ message: 'File removed' });
});

// Marks uploads as part of a record. Only the uploader's own, unlinked files for that patient qualify.
const claimAttachments = async (ids, user, patientCNIC) => {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => mongoose.isValidObjectId(id)).slice(0, 5);
  if (!list.length) return [];
  const found = await Attachment.find({
    _id: { $in: list }, patientCNIC: Number(patientCNIC), linked: false, 'uploadedBy.role': user.role, 'uploadedBy.cnic': user.cnic,
  });
  if (found.length !== list.length) throw Object.assign(new Error('One or more attached files are invalid'), { status: 400 });
  await Attachment.updateMany({ _id: { $in: found.map((a) => a._id) } }, { linked: true });
  return found;
};

module.exports = { upload, meta, content, retryOcr, remove, claimAttachments, MAX_BYTES };
