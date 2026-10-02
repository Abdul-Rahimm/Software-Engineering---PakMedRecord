const express = require('express');
const router = express.Router();
const a = require('../contollers/AdminController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { signinLimiter } = require('../middleware/rateLimit');

router.post('/signin', signinLimiter, a.signin);

router.use(requireAuth, requireRole('admin'));
router.get('/me', a.me);
router.get('/stats', a.stats);
router.get('/doctors', a.listDoctors);
router.get('/doctors/:doctorCNIC/document', a.doctorDocument);
router.post('/doctors/:doctorCNIC/review', a.reviewDoctor);
router.get('/users', a.users);
router.post('/users/:role/:cnic/disabled', a.setDisabled);
router.get('/reports', a.listReports);
router.post('/reports/:id', a.resolveReport);
router.get('/errors', a.errors);
router.get('/partners', a.listPartners);
router.post('/partners', a.createPartner);
router.patch('/partners/:id', a.updatePartner);

module.exports = router;
