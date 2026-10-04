const express = require('express');
const o = require('../contollers/OrgController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireOrg } = require('../lib/tenancy');
const { signinLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// public: a hospital registers itself (creates the organization + its administrator login)
router.post('/signup', signinLimiter, o.signup);

router.use(requireAuth);
router.get('/mine', requireRole('staff', 'doctor'), o.mine);
router.post('/', requireRole('doctor'), o.createByDoctor);

// doctor's own side of a membership
router.post('/:orgId/membership/respond', requireRole('doctor'), o.respond);
router.delete('/:orgId/membership', requireRole('doctor'), o.leave);
router.put('/:orgId/membership/hours', requireRole('doctor'), o.myHours);

// tenant routes: every one passes the organization guard
router.get('/:orgId', requireOrg('any'), o.overview);
router.put('/:orgId', requireOrg('org_admin'), o.update);
router.post('/:orgId/verification', requireOrg('org_admin'), express.raw({ type: () => true, limit: 4 * 1024 * 1024 + 1024 }), o.submitVerification);
router.post('/:orgId/facilities', requireOrg('org_admin'), o.addFacility);
router.put('/:orgId/facilities/:facilityId', requireOrg('org_admin'), o.updateFacility);
router.post('/:orgId/departments', requireOrg('org_admin'), o.addDepartment);
router.delete('/:orgId/departments/:departmentId', requireOrg('org_admin'), o.removeDepartment);
router.get('/:orgId/doctors', requireOrg('org_admin', 'facility_admin', 'reception', 'billing'), o.doctors);
router.post('/:orgId/doctors', requireOrg('org_admin'), o.inviteDoctor);
router.put('/:orgId/doctors/:doctorCNIC', requireOrg('org_admin'), o.updateDoctor);
router.get('/:orgId/staff', requireOrg('org_admin'), o.staffList);
router.post('/:orgId/staff', requireOrg('org_admin'), o.addStaff);
router.patch('/:orgId/staff/:staffId', requireOrg('org_admin'), o.updateStaff);
router.get('/:orgId/desk', requireOrg('org_admin', 'facility_admin', 'reception'), o.deskDay);
router.get('/:orgId/desk/patient/:cnic', requireOrg('org_admin', 'facility_admin', 'reception'), o.deskPatient);
router.post('/:orgId/desk/consent', requireOrg('org_admin', 'facility_admin', 'reception'), o.deskConsent);
router.post('/:orgId/desk/book', requireOrg('org_admin', 'facility_admin', 'reception'), o.deskBook);
router.post('/:orgId/desk/appointments/:id', requireOrg('org_admin', 'facility_admin', 'reception'), o.deskUpdate);

module.exports = router;
