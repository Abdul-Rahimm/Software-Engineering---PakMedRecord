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
app.use(express.json());
app.use(cors());
app.use('/doctor', DoctorRoutes);
app.use('/patient', PatientRoutes);
app.use('/affiliation', AffiliationRoutes);
app.use('/record', recordRoutes);
app.use('/appointments', AppointmentRoutes);
app.use('/tempRecords', TempRecordsRoutes);

mongoose.connect(connection_string)
    .then(() => {
        console.log('App is connected to database!');
        app.listen(port, () => {
            console.log(`App is running on port: ${port}`)
        })
    })
    .catch((err) => {
        console.log(err);
    });
