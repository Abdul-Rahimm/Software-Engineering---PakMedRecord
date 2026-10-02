const express = require('express');
const router = express.Router();
const s = require('../contollers/ShareController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('patient'));
router.get('/', s.list);
router.post('/', s.create);
router.delete('/:id', s.revoke);
router.get('/emergency', s.getEmergencySettings);
router.put('/emergency', s.setEmergency);

module.exports = router;
