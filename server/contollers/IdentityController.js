// Identity checks: CNIC photos + a live face check done in the browser, reviewed by an admin.
// Also "this CNIC is mine": someone locked out because another account uses their CNIC.

const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const IdentityCheck = require('../models/IdentityCheckModel');
const { MODELS } = require('../lib/session');
const { saveFile, openFileStream, deleteFile } = require('../lib/files');
const { cnicProblem, isEmail } = require('../lib/validate');
const { notify } = require('../lib/notify');
const { startPasswordReset } = require('../lib/accounts');
const { mailEnabled, sendMail, brandedEmail } = require('../lib/mailer');
const { forgetAccountStatus } = require('../middleware/auth');

const MAX_IMAGE = 1.5 * 1024 * 1024;
const sniff = (b) => {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
};
// "data:image/jpeg;base64,...." -> Buffer, or throws
const decode = (dataUrl, what) => {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error(`${what} is missing`);
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_IMAGE) throw new Error(`${what} is too large`);
  if (!sniff(buf)) throw new Error(`${what} is not an image`);
  return buf;
};
const num01 = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : undefined);

// Validates the capture payload and stores the photos. Returns { files, device } or throws.
const storeCapture = async (body, meta) => {
  const front = decode(body.cnicFront, 'The front of the CNIC');
  const back = body.cnicBack ? decode(body.cnicBack, 'The back of the CNIC') : null;
  const selfie = decode(body.selfie, 'The live photo');
  const frames = (Array.isArray(body.frames) ? body.frames : []).slice(0, 4).map((f, i) => decode(f, `Live check photo ${i + 1}`));
  if (frames.length < 2) throw new Error('Finish the live check (follow the on-screen steps)');
  const save = (buf, name) => saveFile(buf, { name, mime: sniff(buf), metadata: { ...meta, kind: 'identity' } });
  const files = {
    cnicFront: await save(front, 'cnic-front'),
    cnicBack: back ? await save(back, 'cnic-back') : undefined,
    selfie: await save(selfie, 'selfie'),
    frames: await Promise.all(frames.map((f, i) => save(f, `frame-${i + 1}`))),
  };
  const d = body.device || {};
  const ocr = String(d.ocrCnic || '').replace(/\D/g, '').slice(0, 13);
  return {
    files,
    device: {
      faceMatch: num01(d.faceMatch), liveness: num01(d.liveness), realness: num01(d.realness),
      challenges: (Array.isArray(d.challenges) ? d.challenges : []).map((c) => String(c).slice(0, 40)).slice(0, 8),
      ocrCnic: ocr || undefined,
      ocrMatches: ocr ? ocr === String(meta.cnic) : undefined,
      userAgent: String(meta.userAgent || '').slice(0, 300),
    },
  };
};

const removeFiles = async (check) => {
  const f = check.files || {};
  await Promise.all([f.cnicFront, f.cnicBack, f.selfie, ...(f.frames || [])].filter(Boolean).map((id) => deleteFile(id).catch(() => {})));
};

// POST /identity  { cnic? (staff only), cnicFront, cnicBack?, selfie, frames[], device{} }
const submit = expressAsyncHandler(async (req, res) => {
  const { role } = req.user;
  if (!['doctor', 'patient', 'staff'].includes(role) || req.user.guardian) return res.status(403).json({ error: 'Not available for this account' });
  const { Model, key } = MODELS[role];
  const account = await Model.findOne(key === '_id' ? { _id: req.user.id } : { [key]: req.user.cnic });
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (account.identity?.status === 'verified') return res.status(409).json({ error: 'Your identity is already verified' });
  const cnic = role === 'staff' ? String(req.body?.cnic || '').replace(/\D/g, '') : String(req.user.cnic);
  const problem = cnicProblem(cnic, role === 'patient' ? account.gender : undefined);
  if (problem) return res.status(400).json({ error: problem });
  let capture;
  try {
    capture = await storeCapture(req.body || {}, { cnic, role, userAgent: req.get('user-agent') });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  // one open check per account: replace the previous one
  const previous = await IdentityCheck.findOne({ purpose: 'account', role, subject: String(req.user.cnic ?? req.user.id), status: 'pending' });
  if (previous) {
    await removeFiles(previous);
    await previous.deleteOne();
  }
  const check = await IdentityCheck.create({
    purpose: 'account', role, subject: String(req.user.cnic ?? req.user.id), cnic: Number(cnic),
    name: account.name || `${account.firstName} ${account.lastName}`, ...capture, ip: req.ip,
  });
  // update just these fields (older accounts may have other fields that no longer validate)
  const identity = { status: 'pending', checkId: check._id };
  await Model.updateOne({ _id: account._id }, { $set: { identity, ...(role === 'staff' && { cnic: Number(cnic) }) } });
  res.status(201).json({ message: 'Submitted. Our team will review it, usually within one working day.', identity, device: check.device });
});

// GET /identity/me
const mine = expressAsyncHandler(async (req, res) => {
  const { Model, key } = MODELS[req.user.role] || {};
  if (!Model) return res.status(404).json({ error: 'Not found' });
  const account = await Model.findOne(key === '_id' ? { _id: req.user.id } : { [key]: req.user.cnic }).select('identity').lean();
  res.status(200).json({ identity: account?.identity || { status: 'none' } });
});

// POST /public/cnic-claim { role, cnic, name, email, phone, message, cnicFront, cnicBack, selfie, frames, device }
// For someone whose CNIC is already used by another account (a relative, or misuse).
const claim = expressAsyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!['doctor', 'patient'].includes(b.role)) return res.status(400).json({ error: 'Choose patient or doctor' });
  const cnic = String(b.cnic || '').replace(/\D/g, '');
  const problem = cnicProblem(cnic);
  if (problem) return res.status(400).json({ error: problem });
  if (!String(b.name || '').trim() || !isEmail(b.email)) return res.status(400).json({ error: 'Enter your name and email so we can reach you' });
  const { Model, key } = MODELS[b.role];
  if (!(await Model.exists({ [key]: Number(cnic) }))) return res.status(404).json({ error: 'No account uses this CNIC, so you can simply sign up.' });
  if ((await IdentityCheck.countDocuments({ purpose: 'claim', cnic: Number(cnic), status: 'pending' })) >= 3) {
    return res.status(429).json({ error: 'There are already claims waiting for this CNIC. We will contact you.' });
  }
  let capture;
  try {
    capture = await storeCapture(b, { cnic, role: b.role, userAgent: req.get('user-agent') });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  await IdentityCheck.create({
    purpose: 'claim', role: b.role, subject: cnic, cnic: Number(cnic), name: String(b.name).trim().slice(0, 120),
    contact: { email: String(b.email).trim(), phone: String(b.phone || '').slice(0, 30), message: String(b.message || '').slice(0, 1000) },
    ...capture, ip: req.ip,
  });
  res.status(201).json({ message: 'Thank you. Our team will compare your CNIC and live photo with the account and email you, usually within two working days.' });
});

// ---------- admin ----------

// GET /admin/identity?status=pending&purpose=account|claim
const list = expressAsyncHandler(async (req, res) => {
  const filter = {};
  if (['pending', 'verified', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
  if (['account', 'claim'].includes(req.query.purpose)) filter.purpose = req.query.purpose;
  const checks = await IdentityCheck.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  // the account each check is about, to compare names
  const out = [];
  for (const c of checks) {
    const { Model, key } = MODELS[c.role];
    const acc = await Model.findOne(key === '_id' ? { _id: c.subject } : { [key]: Number(c.subject) }).select('firstName lastName name email gender dateOfBirth disabled createdAt').lean();
    out.push({ ...c, account: acc ? { name: acc.name || `${acc.firstName} ${acc.lastName}`, email: acc.email, gender: acc.gender, dateOfBirth: acc.dateOfBirth, disabled: acc.disabled, createdAt: acc.createdAt } : null });
  }
  res.status(200).json(out);
});

// GET /admin/identity/:id/:file  file = cnicFront | cnicBack | selfie | frame0..3
const file = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const c = await IdentityCheck.findById(req.params.id).lean();
  const name = req.params.file;
  const id = c && (name.startsWith('frame') ? c.files.frames?.[Number(name.slice(5))] : c.files[name]);
  if (!id) return res.status(404).end();
  res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': 'image/jpeg' });
  openFileStream(id).on('error', () => !res.headersSent && res.status(404).end()).pipe(res);
});

// POST /admin/identity/:id/review { decision: 'verified'|'rejected', note, action?: 'hand_over'|'freeze' (claims) }
const review = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const c = await IdentityCheck.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.status !== 'pending') return res.status(409).json({ error: `Already ${c.status}` });
  const { decision, note = '', action } = req.body || {};
  if (!['verified', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Choose approve or reject' });
  if (decision === 'rejected' && !String(note).trim()) return res.status(400).json({ error: 'Add a note explaining why' });
  const { Model, key } = MODELS[c.role];
  const account = await Model.findOne(key === '_id' ? { _id: c.subject } : { [key]: Number(c.subject) });
  c.status = decision;
  c.note = String(note).trim().slice(0, 500);
  c.reviewedAt = new Date();
  let message = decision === 'verified' ? 'Identity verified' : 'Rejected';

  if (c.purpose === 'account' && account) {
    await Model.updateOne({ _id: account._id }, { $set: { identity: decision === 'verified'
      ? { status: 'verified', checkId: c._id, verifiedAt: new Date() }
      : { status: 'rejected', checkId: c._id, note: c.note } } });
    if (c.role !== 'staff') {
      notify(c.role, Number(c.subject), {
        type: 'verification',
        title: decision === 'verified' ? 'Identity verified' : 'Identity check needs attention',
        body: decision === 'verified' ? 'Your CNIC and live photo were confirmed.' : `Reason: ${c.note}. Please try again.`,
        link: '/verify-identity',
      });
    }
  }

  if (c.purpose === 'claim' && decision === 'verified' && account) {
    if (!['hand_over', 'freeze'].includes(action)) return res.status(400).json({ error: 'Choose to hand the account over or freeze it' });
    if (action === 'hand_over') {
      // the rightful owner gets the account: new email, everyone signed out, reset link to the new email
      await Model.updateOne({ _id: account._id }, { $set: { email: c.contact.email, disabled: false, passwordChangedAt: new Date(), identity: { status: 'verified', checkId: c._id, verifiedAt: new Date() } } });
      const fresh = await Model.findById(account._id);
      await startPasswordReset(fresh, c.role).catch((err) => console.error('Handover reset email failed:', err.message));
      message = 'Account handed over. A password reset link was emailed to the claimant.';
    } else {
      await Model.updateOne({ _id: account._id }, { $set: { disabled: true, disabledReason: 'Identity dispute under review' } });
      message = 'Account frozen while the dispute is resolved.';
    }
    forgetAccountStatus(c.role, String(c.subject));
    c.outcome = action === 'hand_over' ? 'handed_over' : 'frozen';
  }
  if (c.purpose === 'claim' && mailEnabled() && c.contact?.email) {
    sendMail({
      to: c.contact.email,
      ...brandedEmail({
        subject: 'Your CNIC claim on PakMedRecord',
        name: c.name,
        paragraphs: decision === 'verified'
          ? [c.outcome === 'handed_over' ? 'We confirmed the CNIC is yours and moved the account to your email. Use the link in our other email to set a password.' : 'We confirmed the CNIC is yours. The account using it has been frozen and our team will contact you about next steps.']
          : ['We could not confirm the CNIC is yours from the photos you sent.', `Reason: ${c.note}`],
      }),
    }).catch((err) => console.error('Claim email failed:', err.message));
  }
  await c.save();
  res.status(200).json({ message, check: c });
});

module.exports = { submit, mine, claim, list, file, review };
