const express = require('express');
const router = express.Router();
const p = require('../contollers/PaymentController');
const { requireAuth, requireRole } = require('../middleware/auth');

// JazzCash redirects the customer's browser here with a form post (no session)
router.post('/jazzcash/return', express.urlencoded({ extended: false, limit: '20kb' }), p.jazzcashReturn);

router.use(requireAuth);
router.post('/checkout', requireRole('patient'), p.checkout);
router.post('/test/:txnRef', requireRole('patient'), p.testComplete);
router.get('/mine', requireRole('patient'), p.mine);
router.get('/:txnRef', p.byRef);

module.exports = router;
