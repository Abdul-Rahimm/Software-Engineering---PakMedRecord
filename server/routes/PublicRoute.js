// Endpoints that work without signing in. Every response is deliberately minimal.
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const directory = require('../contollers/DirectoryController');
const identity = require('../contollers/IdentityController');
const { signinLimiter } = require('../middleware/rateLimit');
const share = require('../contollers/ShareController');
const rx = require('../contollers/PrescriptionController');

// Tokens are long and random, but slow down scanning anyway
router.use(rateLimit({ windowMs: 60 * 1000, limit: Number(process.env.PUBLIC_RATE_LIMIT) || 60, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests, please slow down.' } }));
router.get('/doctors', directory.search);
router.get('/doctors/:id', directory.profile);
router.get('/hospitals', directory.hospitals);
router.post('/cnic-claim', signinLimiter, identity.claim);
router.get('/hospitals/:id', directory.hospital);
router.get('/emergency/:token', share.viewEmergency);
router.get('/share/:token', share.viewShare);
router.get('/share/:token/files/:fileId', share.shareFile);
router.get('/rx/:code', rx.verifyPublic);

module.exports = router;
