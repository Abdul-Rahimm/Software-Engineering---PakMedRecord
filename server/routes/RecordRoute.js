const express = require('express');
const router = express.Router();
const { addRecord, getRecords, removeRecords} = require('../contollers/RecordControler');

// Routes
router.route('/create').post(addRecord);
router.route('/getrecords/:patientCNIC').get(getRecords);
router.route('remove/:doctorCNIC').delete(removeRecords);

module.exports = router;
