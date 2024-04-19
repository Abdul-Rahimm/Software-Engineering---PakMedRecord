const express = require('express');
const router = express.Router();

const {submit, pending, approve, remove} = require('../contollers/TempRecordController');

router.route('/submit/:patientCNIC').post(submit);
router.route('/pending/:doctorCNIC').get(pending);
router.route('/approve/:recordId').patch(approve);
router.route('/remove/:recordId').delete(remove);

module.exports = router;