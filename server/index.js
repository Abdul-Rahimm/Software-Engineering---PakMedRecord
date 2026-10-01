const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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

// Behind a proxy (e.g. in production), trust it so rate limits see real client IPs
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(cors());
app.use('/doctor', DoctorRoutes);
app.use('/patient', PatientRoutes);
app.use('/affiliation', AffiliationRoutes);
app.use('/record', recordRoutes);
app.use('/appointments', AppointmentRoutes);
app.use('/tempRecords', TempRecordsRoutes);
app.use('/vitals', VitalRoutes);
app.use('/notifications', NotificationRoutes);
app.use('/ai', AIRoutes);

mongoose.connect(connection_string)
    .then(() => {
        console.log('PakMedRecord is connected to database!');
        app.listen(port, () => {
            console.log(`PakMedRecord is running on port: ${port}`)
        })
    })
    .catch((err) => {
        console.log(err);
    });
