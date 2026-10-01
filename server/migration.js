// One-off migration: rename the old `cnic` field to `patientCNIC` / `doctorCNIC`.
// Run with: npm run migrate
const mongoose = require('mongoose');
const Patient = require('./models/PatientModel');
const Doctor = require('./models/DoctorModel');
const { connection_string } = require('./config');

async function migrate() {
    await mongoose.connect(connection_string);
    try {
        // `cnic` is not in the schemas anymore, so rename it on the raw collections
        const patients = await Patient.collection.updateMany(
            { cnic: { $exists: true }, patientCNIC: { $exists: false } },
            { $rename: { cnic: 'patientCNIC' } }
        );
        console.log(`Patient migration completed (${patients.modifiedCount} updated).`);

        const doctors = await Doctor.collection.updateMany(
            { cnic: { $exists: true }, doctorCNIC: { $exists: false } },
            { $rename: { cnic: 'doctorCNIC' } }
        );
        console.log(`Doctor migration completed (${doctors.modifiedCount} updated).`);
    } catch (error) {
        console.error('Error during migration:', error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

migrate();
