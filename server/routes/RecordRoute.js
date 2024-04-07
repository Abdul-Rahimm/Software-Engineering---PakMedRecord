const express = require('express');
const router = express.Router();
const { addRecord, getRecords} = require('../contollers/RecordControler');

// Routes
router.route('/create').post(addRecord);
router.route('/getrecords/:patientCNIC').get(getRecords);



module.exports = router;
