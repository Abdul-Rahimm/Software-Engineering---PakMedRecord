// Import necessary modules
const express = require('express');
const router = express.Router();
const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Affiliation = require('../models/AffiliationModel');
// const tf = require('@tensorflow/tfjs-node');


// Endpoint to book an appointment
const book = async (req, res) => {
    try {
        // Extract appointment details from request body
        const { doctorCNIC, date, time, status } = req.body;
        const {patientCNIC} = req.params;

        // Check if patient exists
        const existingPatient = await Patient.findOne({ patientCNIC });
        if (!existingPatient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Check if doctor exists
        const existingDoctor = await Doctor.findOne({ doctorCNIC });
        if (!existingDoctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Check if doctor is affiliated with the patient
        const affiliation = await Affiliation.findOne({ patientCNIC, doctorCNIC });
        if (!affiliation) {
            return res.status(403).json({ error: 'Patient and doctor are not affiliated' });
        }

        // Check if appointment already exists for the specified doctor at the given date and time
        const existingAppointment = await Appointment.findOne({ doctorCNIC, date, time });
        if (existingAppointment) {
            return res.status(409).json({ error: 'Appointment already booked at this time' });
        }

        // Create a new appointment
        const appointment = new Appointment({
            patientCNIC: patientCNIC,
            doctorCNIC: doctorCNIC,
            date,
            time, 
            status
        });

        // Save the appointment to the database
        await appointment.save();

        res.status(201).json({ message: "Appointment booked successfully.", appointment });
    } catch (error) {
        console.error("Error booking appointment:", error);
        res.status(500).json({ error: "Internal server error." });
    }
};



const getAppointments = async (req, res) => {
    try {
        // Extract doctorCNIC from request parameters
        const { doctorCNIC } = req.params;

        // Find appointments with the given doctorCNIC
        const appointments = await Appointment.find({ doctorCNIC });

        // Return the appointments
        res.status(200).json({ appointments });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ error: "Internal server error." });
    }
};

const getAppointmentTimes = async (req, res) => {
    try {
        // Extract doctorCNIC from request parameters
        const { doctorCNIC } = req.params;

        // Find appointments with the given doctorCNIC
        const appointments = await Appointment.find({ doctorCNIC });

        // Extract appointment times, dates, and corresponding days
        const appointmentData = appointments.map(appointment => {
            const date = new Date(appointment.date);
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
            return {
                time: appointment.time,
                date: appointment.date,
                day: dayOfWeek
            };
        });

        // Return the appointment data
        res.status(200).json({ appointmentData });
    } catch (error) {
        console.error("Error fetching appointments by time:", error);
        res.status(500).json({ error: "Internal server error." });
    }
};




const completeAppointment = async (req, res) => {
    try {
        // Extract appointment ID from request parameters
        const { appointmentId } = req.params;

        // Find the appointment by ID
        const appointment = await Appointment.findById(appointmentId);

        // Check if appointment exists
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Update the status of the appointment to completed
        appointment.status = 'completed';
        await appointment.save();

        // Return a success response
        res.status(200).json({ message: 'Appointment status updated to completed', appointment });
    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// Define controller function for recommendation
// const recommendAppointment = async (req, res) => {
//     try {
//         // Extract doctorCNIC from request parameters
//         const { doctorCNIC } = req.params;

//         // Find appointments with the given doctorCNIC
//         const appointments = await Appointment.find({ doctorCNIC });

//         // Extract appointment times
//         const appointmentTimes = appointments.map(appointment => [appointment.date, appointment.time]);

//         // Load TensorFlow model
//         const model = await tf.loadLayersModel('path/to/saved/model.json');

//         // Convert appointmentTimes to tensor format
//         const inputTensor = tf.tensor(appointmentTimes);

//         // Normalize inputTensor (if necessary)
//         // const normalizedInput = inputTensor;

//         // Make predictions using TensorFlow model
//         const predictions = model.predict(inputTensor);

//         // Convert predictions tensor to JavaScript array
//         const predictedTimes = predictions.arraySync();

//         // Find the least busy time (e.g., minimum predicted value)
//         const leastBusyIndex = predictedTimes.indexOf(Math.min(...predictedTimes));

//         // Return the least busy time
//         const leastBusyTime = appointmentTimes[leastBusyIndex];

//         res.status(200).json({ leastBusyTime });
//     } catch (error) {
//         console.error("Error recommending appointment time:", error);
//         res.status(500).json({ error: "Internal server error." });
//     }
// };

// Export the router
module.exports = { book, getAppointments, completeAppointment, getAppointmentTimes };
