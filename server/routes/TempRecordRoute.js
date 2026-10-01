const express = require('express');
const router = express.Router();

const {submit, pending, approve, remove, mine} = require('../contollers/TempRecordController');
const { requireAuth, requireRole, requireSelf } = require('../middleware/auth');

router.use(requireAuth);
router.route('/submit/:patientCNIC').post(requireSelf('patient', 'patientCNIC'), submit);
router.route('/pending/:doctorCNIC').get(requireSelf('doctor', 'doctorCNIC'), pending);
router.route('/mine/:patientCNIC').get(requireSelf('patient', 'patientCNIC'), mine);
router.route('/approve/:recordId').patch(requireRole('doctor'), approve);
router.route('/remove/:recordId').delete(remove);

module.exports = router;
