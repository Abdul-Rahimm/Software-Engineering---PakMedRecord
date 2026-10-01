const express = require('express');
const router = express.Router();
const { addRecord, getRecords, removeRecords} = require('../contollers/RecordControler');
const { requireAuth, requireRole, requirePatientAccess } = require('../middleware/auth');

// Routes
router.use(requireAuth);
router.route('/create').post(requireRole('doctor'), addRecord);
router.route('/getrecords/:patientCNIC').get(requirePatientAccess('patientCNIC'), getRecords);
router.route('/remove/:recordId').delete(requireRole('doctor'), removeRecords);

module.exports = router;
