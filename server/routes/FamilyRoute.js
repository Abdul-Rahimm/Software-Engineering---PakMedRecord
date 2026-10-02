const express = require('express');
const router = express.Router();
const f = require('../contollers/FamilyController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('patient'));
router.get('/', f.list);
router.post('/', f.add);
router.post('/:cnic/switch', f.switchTo);
router.post('/:cnic/handover', f.handover);
router.delete('/:cnic', f.remove);

module.exports = router;
