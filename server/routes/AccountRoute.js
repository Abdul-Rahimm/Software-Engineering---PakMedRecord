const express = require('express');
const router = express.Router();
const c = require('../contollers/AccountController');
const { requireAuth } = require('../middleware/auth');
const { signinLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);
router.get('/2fa', c.twoFactorStatus);
router.post('/2fa/setup', c.noDependents, c.twoFactorSetup);
router.post('/2fa/enable', c.noDependents, signinLimiter, c.twoFactorEnable);
router.post('/2fa/disable', c.noDependents, signinLimiter, c.twoFactorDisable);
router.post('/password', c.noDependents, signinLimiter, c.changePassword);
router.get('/export', c.exportData);
router.get('/access-log', c.accessLog);
router.put('/avatar', express.raw({ type: () => true, limit: '700kb' }), c.setAvatar);
router.delete('/avatar', c.removeAvatar);
router.post('/delete', signinLimiter, c.deleteAccount);

module.exports = router;
