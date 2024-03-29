const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const { port, connection_string } = require('./config');
const DoctorRoutes = require('./routes/DoctorRoutes');
const PatientRoutes = require('./routes/PatientRoutes');

app.use(express.json());
app.use(cors());
app.use('/doctor', DoctorRoutes);
app.use('/patient', PatientRoutes);

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
