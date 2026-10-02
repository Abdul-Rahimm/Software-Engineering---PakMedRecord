const express = require('express');
const router = express.Router();
const c = require('../contollers/CallController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('doctor', 'patient'));
router.get('/:appointmentId', c.info);
router.post('/:appointmentId/signal', c.send);
router.get('/:appointmentId/signal', c.poll);

module.exports = router;
