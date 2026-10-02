const express = require('express');
const analytics = require('../contollers/AnalyticsController');
const reports = require('../contollers/ReportController');
const cron = require('../contollers/CronController');
const { requireAuth, requireRole, requireSelf } = require('../middleware/auth');

const analyticsRouter = express.Router();
analyticsRouter.use(requireAuth, requireRole('doctor'));
analyticsRouter.get('/doctor/:doctorCNIC', requireSelf('doctor', 'doctorCNIC'), analytics.doctor);
analyticsRouter.get('/clinic/:id', analytics.clinic);

const reportsRouter = express.Router();
reportsRouter.post('/', requireAuth, requireRole('doctor', 'patient'), reports.create);

const cronRouter = express.Router();
cronRouter.get('/daily', cron.requireCron, cron.run);

module.exports = { analyticsRouter, reportsRouter, cronRouter };
