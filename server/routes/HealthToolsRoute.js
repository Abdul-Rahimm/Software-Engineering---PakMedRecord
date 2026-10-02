const express = require('express');
const h = require('../contollers/HealthToolsController');
const { requireAuth, requireSelf, requirePatientAccess } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');

// Mounted at /meds, /vaccines, /labs and /followups
const meds = express.Router();
meds.use(requireAuth);
meds.get('/:patientCNIC', requirePatientAccess('patientCNIC'), h.medsDay);
meds.get('/:patientCNIC/adherence', requirePatientAccess('patientCNIC'), h.adherence);
meds.post('/:patientCNIC/dose', requireSelf('patient', 'patientCNIC'), h.logDose);

const vaccines = express.Router();
vaccines.use(requireAuth);
vaccines.get('/:patientCNIC', requirePatientAccess('patientCNIC'), h.vaccines);
vaccines.post('/:patientCNIC', requirePatientAccess('patientCNIC'), h.markVaccine);
vaccines.delete('/:patientCNIC/:code', requirePatientAccess('patientCNIC'), h.unmarkVaccine);

const labs = express.Router();
labs.use(requireAuth);
labs.get('/:patientCNIC', requirePatientAccess('patientCNIC'), h.labs);

const followups = express.Router();
followups.use(requireAuth);
followups.get('/:patientCNIC', requirePatientAccess('patientCNIC'), aiLimiter, h.followups);

module.exports = { meds, vaccines, labs, followups };
