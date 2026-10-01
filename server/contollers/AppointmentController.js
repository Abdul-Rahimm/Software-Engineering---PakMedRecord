const Appointment = require('../models/AppointmentModel');
const { notify } = require('../lib/notify');
const { ACTIVE, createAppointment, describe } = require('../lib/appointments');

// Book an appointment with a doctor in the patient's care team
const book = async (req, res) => {
    try {
        const { status, body } = await createAppointment({ ...req.body, patientCNIC: Number(req.params.patientCNIC) });
        res.status(status).json(body);
    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// Times already taken for a doctor on a day (so the booking UI can disable them)
const bookedSlots = async (req, res) => {
    try {
        const { doctorCNIC } = req.params;
        const { date } = req.query;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'date=YYYY-MM-DD is required' });
        const taken = await Appointment.find({ doctorCNIC, date, status: ACTIVE }).select('time -_id');
        res.status(200).json({ times: taken.map((a) => a.time) });
    } catch (error) {
        console.error('Error fetching booked slots:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

const getAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ doctorCNIC: req.params.doctorCNIC }).sort({ date: 1, time: 1 });
        res.status(200).json({ appointments });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// A patient's own appointments
const getPatientAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ patientCNIC: req.params.patientCNIC }).sort({ date: 1, time: 1 });
        res.status(200).json({ appointments });
    } catch (error) {
        console.error('Error fetching patient appointments:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

const getAppointmentTimes = async (req, res) => {
    try {
        const appointments = await Appointment.find({ doctorCNIC: req.params.doctorCNIC, status: ACTIVE });
        const appointmentData = appointments.map((appointment) => ({
            time: appointment.time,
            date: appointment.date,
            day: new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
        }));
        res.status(200).json({ appointmentData });
    } catch (error) {
        console.error('Error fetching appointments by time:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// Only the doctor the appointment is with can complete it
const completeAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.appointmentId);
        if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
        if (appointment.doctorCNIC !== req.user.cnic) return res.status(403).json({ error: 'Not allowed' });
        if (appointment.status === 'cancelled') return res.status(409).json({ error: 'This appointment was cancelled' });

        appointment.status = 'completed';
        await appointment.save();

        notify('patient', appointment.patientCNIC, {
            type: 'appointment',
            title: 'Visit completed',
            body: `Your appointment on ${describe(appointment)} was marked as completed.`,
            link: `/appointments/mine/${appointment.patientCNIC}`,
        });

        res.status(200).json({ message: 'Appointment status updated to completed', appointment });
    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Either side can cancel an upcoming appointment; the other side is notified
const cancelAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.appointmentId);
        if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

        const { role, cnic } = req.user;
        const owns = role === 'doctor' ? appointment.doctorCNIC === cnic : appointment.patientCNIC === cnic;
        if (!owns) return res.status(403).json({ error: 'Not allowed' });
        if (appointment.status !== 'pending') return res.status(409).json({ error: `This appointment is already ${appointment.status}` });

        appointment.status = 'cancelled';
        appointment.cancelledBy = role;
        appointment.cancelReason = req.body?.reason ? String(req.body.reason).trim().slice(0, 300) : undefined;
        await appointment.save();

        const other = role === 'doctor'
            ? ['patient', appointment.patientCNIC, `/appointments/mine/${appointment.patientCNIC}`]
            : ['doctor', appointment.doctorCNIC, `/appointments/fetch/${appointment.doctorCNIC}`];
        notify(other[0], other[1], {
            type: 'cancelled',
            title: 'Appointment cancelled',
            body: `The appointment on ${describe(appointment)} was cancelled by the ${role}${appointment.cancelReason ? `: ${appointment.cancelReason}` : '.'}`,
            link: other[2],
        });

        res.status(200).json({ message: 'Appointment cancelled', appointment });
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    book, bookedSlots, getAppointments, getPatientAppointments, completeAppointment, cancelAppointment, getAppointmentTimes,
};
