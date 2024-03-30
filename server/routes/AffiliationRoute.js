const express = require('express');
const router= express.Router();
const {affiliate} = require('../contollers/AffiliationController');

router.route('/affiliate').post(affiliate);

module.exports = router;
