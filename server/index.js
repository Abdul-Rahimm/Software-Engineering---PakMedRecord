const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const app = express();
const { port, connection_string } = require('./config');
const DoctorRoutes = require('./routes/DoctorRoutes');
const PatientRoutes = require('./routes/PatientRoutes');
const AffiliationRoutes = require('./routes/AffiliationRoute');
const recordRoutes = require('./routes/RecordRoute');
const AppointmentRoutes = require('./routes/AppointmentRoute');
const TempRecordsRoutes = require('./routes/TempRecordRoute');
const VitalRoutes = require('./routes/VitalRoute');
const NotificationRoutes = require('./routes/NotificationRoute');
const AIRoutes = require('./routes/AIRoute');
const AuthRoutes = require('./routes/AuthRoute');
const FileRoutes = require('./routes/FileRoute');
const AccountRoutes = require('./routes/AccountRoute');
const AdminRoutes = require('./routes/AdminRoute');
const FamilyRoutes = require('./routes/FamilyRoute');
const PrescriptionRoutes = require('./routes/PrescriptionRoute');
const ShareRoutes = require('./routes/ShareRoute');
const PublicRoutes = require('./routes/PublicRoute');
const HealthTools = require('./routes/HealthToolsRoute');
const OrgRoutes = require('./routes/OrgRoute');
const { staffSignin } = require('./contollers/ClinicController');
const { signinLimiter } = require('./middleware/rateLimit');
const CallRoutes = require('./routes/CallRoute');
const PaymentRoutes = require('./routes/PaymentRoute');
const PartnerRoutes = require('./routes/PartnerRoute');
const { analyticsRouter, reportsRouter, cronRouter } = require('./routes/MiscRoute');
const { errorHandler, recordError } = require('./lib/errors');
const { runMigrations } = require('./lib/migrations');
const { safepayWebhook } = require('./contollers/PaymentController');

// One shared connection per process; serverless instances reuse it across requests
let dbReady;
const connectDB = () => {
    if (!dbReady) {
        dbReady = mongoose.connect(connection_string)
            .then(() => console.log('PakMedRecord is connected to database!'))
            .then(() => runMigrations());
        dbReady.catch(() => { dbReady = undefined; }); // retry on the next request
    }
    return dbReady;
};

// Browsers may only call the API from the app itself (CORS_ORIGINS adds more, comma-separated).
// Without APP_URL (local development) any origin is allowed.
const allowedOrigins = [process.env.APP_URL, ...(process.env.CORS_ORIGINS || '').split(',')]
    .map((o) => (o || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
const corsOptions = {
    origin: (origin, cb) => cb(null, !origin || !allowedOrigins.length || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)),
};

// Behind a proxy (e.g. in production), trust it so rate limits see real client IPs
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));

// Liveness check for uptime monitors (no database needed to answer)
app.get('/health', (req, res) => {
    res.status(200).json({ ok: true, db: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown', time: new Date() });
});

app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('Database connection failed:', err.message);
        res.status(503).json({ error: 'Database unavailable, please try again shortly.' });
    }
});
// partner API accepts larger JSON bodies (lab reports), so it parses its own
app.use('/partners', PartnerRoutes);
// Safepay webhooks are verified against the exact raw body, so they skip the JSON parser
app.post('/payments/safepay/webhook/:accountId', express.raw({ type: () => true, limit: '100kb' }), safepayWebhook);
app.use(express.json({ limit: '200kb' }));
app.use('/doctor', DoctorRoutes);
app.use('/patient', PatientRoutes);
app.use('/affiliation', AffiliationRoutes);
app.use('/record', recordRoutes);
app.use('/appointments', AppointmentRoutes);
app.use('/tempRecords', TempRecordsRoutes);
app.use('/vitals', VitalRoutes);
app.use('/notifications', NotificationRoutes);
app.use('/ai', AIRoutes);
app.use('/auth', AuthRoutes);
app.use('/files', FileRoutes);
app.use('/account', AccountRoutes);
app.use('/admin', AdminRoutes);
app.use('/family', FamilyRoutes);
app.use('/prescriptions', PrescriptionRoutes);
app.use('/share', ShareRoutes);
app.use('/public', PublicRoutes);
app.use('/meds', HealthTools.meds);
app.use('/vaccines', HealthTools.vaccines);
app.use('/labs', HealthTools.labs);
app.use('/followups', HealthTools.followups);
app.use('/orgs', OrgRoutes);
app.post('/desk/signin', signinLimiter, staffSignin); // hospital staff sign-in
app.use('/calls', CallRoutes);
app.use('/payments', PaymentRoutes);
app.use('/analytics', analyticsRouter);
app.use('/reports', reportsRouter);
app.use('/cron', cronRouter);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    recordError(reason instanceof Error ? reason : new Error(String(reason)));
});

// Vercel imports the app; locally (npm start / npm run dev) we listen ourselves
if (!process.env.VERCEL) {
    connectDB()
        .then(() => app.listen(port, () => console.log(`PakMedRecord is running on port: ${port}`)))
        .catch((err) => console.log(err));
}

module.exports = app;
