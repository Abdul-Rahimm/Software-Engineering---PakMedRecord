const express = require('express');
const router = express.Router();
const p = require('../contollers/PartnerController');

router.post('/lab/results', express.json({ limit: '5mb' }), p.requirePartner('lab'), p.labResults);
router.get('/pharmacy/prescriptions/:code', p.requirePartner('pharmacy'), p.pharmacyGet);
router.post('/pharmacy/prescriptions/:code/dispense', p.requirePartner('pharmacy'), p.pharmacyDispense);

module.exports = router;
