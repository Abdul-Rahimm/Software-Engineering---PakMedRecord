const express = require('express');
const identity = require('../contollers/IdentityController');
const router = express.Router();
const a = require('../contollers/AdminController');
const billing = require('../contollers/BillingController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { signinLimiter } = require('../middleware/rateLimit');

router.post('/signin', signinLimiter, a.signin);

router.use(requireAuth, requireRole('admin'));
router.get('/me', a.me);
router.get('/stats', a.stats);
router.get('/doctors', a.listDoctors);
router.get('/doctors/:doctorCNIC/document', a.doctorDocument);
router.post('/doctors/:doctorCNIC/review', a.reviewDoctor);
router.get('/users', a.users);
router.post('/users/:role/:cnic/disabled', a.setDisabled);
router.get('/reports', a.listReports);
router.post('/reports/:id', a.resolveReport);
router.get('/errors', a.errors);
router.post('/danger/reset', a.resetAllData);
router.get('/orgs', a.listOrgs);
router.get('/identity', identity.list);
router.get('/identity/:id/:file', identity.file);
router.post('/identity/:id/review', identity.review);
router.get('/orgs/:orgId/document', a.orgDocument);
router.post('/orgs/:orgId/review', a.reviewOrg);
router.get('/partners', a.listPartners);
router.post('/partners', a.createPartner);
router.patch('/partners/:id', a.updatePartner);
router.get('/billing/summary', billing.summary);
router.get('/billing/payments', billing.payments);
router.get('/billing/invoices', billing.listInvoices);
router.post('/billing/invoices', billing.createInvoice);
router.post('/billing/invoices/:id', billing.updateInvoice);

module.exports = router;
