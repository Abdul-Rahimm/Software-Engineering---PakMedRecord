const express = require('express');
const router= express.Router();
const {affiliate, getMyDoctors, removeDoctor} = require('../contollers/AffiliationController');

router.route('/affiliate').post(affiliate);
router.route('/getmydoctors/:patientCNIC').get(getMyDoctors);
router.route('/remove/:patientCNIC/:doctorCNIC').delete(removeDoctor);

module.exports = router;
