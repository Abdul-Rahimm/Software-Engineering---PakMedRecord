const express = require('express');
const router = express.Router();
const p = require('../contollers/PrescriptionController');
const { requireAuth, requireRole, requirePatientAccess, requireVerifiedDoctor } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);
router.post('/check', requireRole('doctor'), requireVerifiedDoctor, aiLimiter, p.check);
router.post('/', requireRole('doctor'), requireVerifiedDoctor, p.create);
router.get('/patient/:patientCNIC', requirePatientAccess('patientCNIC'), p.forPatient);
router.post('/:code/cancel', requireRole('doctor'), p.cancel);

module.exports = router;
