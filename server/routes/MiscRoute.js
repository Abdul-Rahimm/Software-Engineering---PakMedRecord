const express = require('express');
const analytics = require('../contollers/AnalyticsController');
const reports = require('../contollers/ReportController');
const cron = require('../contollers/CronController');
const { requireAuth, requireRole, requireSelf } = require('../middleware/auth');
const { requireOrg } = require('../lib/tenancy');

const analyticsRouter = express.Router();
analyticsRouter.use(requireAuth);
analyticsRouter.get('/doctor/:doctorCNIC', requireRole('doctor'), requireSelf('doctor', 'doctorCNIC'), analytics.doctor);
analyticsRouter.get('/clinic/:orgId', requireOrg('org_admin', 'billing'), analytics.clinic);

const reportsRouter = express.Router();
reportsRouter.post('/', requireAuth, requireRole('doctor', 'patient'), reports.create);

const cronRouter = express.Router();
cronRouter.get('/daily', cron.requireCron, cron.run);

module.exports = { analyticsRouter, reportsRouter, cronRouter };
