const express = require('express');
const router = express.Router();
const p = require('../contollers/PaymentController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Safepay sends the customer's browser back here (GET or form POST), no session
router.get('/safepay/return/:txnRef', p.safepayReturn);
router.post('/safepay/return/:txnRef', express.urlencoded({ extended: false, limit: '20kb' }), p.safepayReturn);
router.get('/safepay/cancel/:txnRef', p.safepayCancel);
router.post('/safepay/cancel/:txnRef', express.urlencoded({ extended: false, limit: '20kb' }), p.safepayCancel);
// (Safepay webhooks are mounted in index.js, before the JSON body parser)

router.use(requireAuth);
router.post('/checkout', requireRole('patient'), p.checkout);
router.post('/test/:txnRef', requireRole('patient'), p.testComplete);
router.get('/mine', requireRole('patient'), p.mine);
router.get('/options', requireRole('patient'), p.options);
router.get('/account/:scope(doctor)', requireRole('doctor'), p.getAccount);
router.put('/account/:scope(doctor)', requireRole('doctor'), p.saveAccount);
router.delete('/account/:scope(doctor)', requireRole('doctor'), p.removeAccount);
router.get('/account/:scope(clinic)/:id', requireRole('doctor'), p.getAccount);
router.put('/account/:scope(clinic)/:id', requireRole('doctor'), p.saveAccount);
router.delete('/account/:scope(clinic)/:id', requireRole('doctor'), p.removeAccount);
router.post('/:id/refunded', requireRole('doctor', 'staff'), p.markRefunded);
router.get('/:txnRef', p.byRef);

module.exports = router;
