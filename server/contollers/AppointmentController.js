// Import necessary modules
const express = require('express');
const router = express.Router();
const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Affiliation = require('../models/AffiliationModel');

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
// Export the router
module.exports = { book, getAppointments, completeAppointment };
