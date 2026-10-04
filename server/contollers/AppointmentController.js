const mongoose = require('mongoose');
const Appointment = require('../models/AppointmentModel');
const { notify } = require('../lib/notify');
const Doctor = require('../models/DoctorModel');
const Payment = require('../models/PaymentModel');
const { orgAccess, canUseFacility, doctorLocations } = require('../lib/tenancy');
const Organization = require('../models/OrganizationModel');
const Facility = require('../models/FacilityModel');
const { ACTIVE, createAppointment, describe, resolveLocation } = require('../lib/appointments');
const { blockedSlots } = require('../lib/conflicts');
const { flagRefund } = require('./PaymentController');
const { scheduleOf } = require('../lib/availability');

// Book an appointment with a doctor in the patient's care team
const book = async (req, res) => {
    try {
        const { status, body } = await createAppointment({ ...req.body, patientCNIC: Number(req.params.patientCNIC), bookedBy: { role: 'patient' } });
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

// Open slots for a doctor on a day: the doctor's hours minus booked times
const availability = async (req, res) => {
    try {
        const { date } = req.query;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'date=YYYY-MM-DD is required' });
        const doctor = await Doctor.findOne({ doctorCNIC: Number(req.params.doctorCNIC) });
        if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
        // ?orgId=&facilityId= for a hospital branch; neither for private practice
        const place = await resolveLocation(doctor, { orgId: req.query.orgId, facilityId: req.query.facilityId }, date);
        if (place.error) return res.status(400).json({ error: place.error });
        // slots that clash with the doctor's visits anywhere (visit length + travel time)
        const taken = await blockedSlots({ doctor, date, slots: place.slots, durationMinutes: place.slotMinutes, place: { facilityId: place.facility?._id || null } });
        let workingDays;
        let holidays;
        let slotMinutes;
        if (place.membership) {
            const a = place.membership.availability || {};
            workingDays = [...new Set((a.blocks || []).filter((b) => String(b.facilityId) === String(place.facility._id)).map((b) => b.day))];
            holidays = a.holidays || [];
            slotMinutes = a.slotMinutes || 30;
        } else {
            const s = scheduleOf(doctor);
            workingDays = [...new Set(s.days.map((d) => d.day))];
            holidays = s.holidays;
            slotMinutes = s.slotMinutes;
        }
        res.status(200).json({ slots: place.slots, taken, slotMinutes, videoConsults: place.videoConsults, fee: place.fee ?? null, workingDays, holidays, place: place.label });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// POST /appointments/:appointmentId/move { orgId?, facilityId?, date, time, mode }
// The patient moves a booking to another time or place with the same doctor in one step. A paid
// fee travels with it when the same hospital (or the doctor's private practice) gets the money;
// otherwise the old payment is refunded and the new visit is paid separately.
const moveAppointment = async (req, res) => {
    try {
        const old = mongoose.isValidObjectId(req.params.appointmentId) && await Appointment.findById(req.params.appointmentId);
        if (!old || old.patientCNIC !== req.user.cnic) return res.status(404).json({ error: 'Appointment not found' });
        if (old.status !== 'pending') return res.status(409).json({ error: `This appointment is ${old.status}` });
        const sameSlot = String(old.facilityId || '') === String(req.body?.facilityId || '') && old.date.toISOString().slice(0, 10) === req.body?.date && old.time === req.body?.time;
        if (sameSlot) return res.status(400).json({ error: 'That is already your appointment time and place' });
        const { status, body } = await createAppointment({
            patientCNIC: old.patientCNIC, doctorCNIC: old.doctorCNIC, date: req.body?.date, time: req.body?.time, mode: req.body?.mode || old.mode,
            orgId: req.body?.orgId || undefined, facilityId: req.body?.facilityId || undefined, reason: old.reason, bookedBy: { role: 'patient' }, excludeId: old._id,
        });
        if (status !== 201) return res.status(status).json(body);
        const fresh = body.appointment;
        const samePayee = String(old.orgId || '') === String(fresh.orgId || '');
        old.status = 'cancelled';
        old.cancelledBy = 'patient';
        old.cancelReason = 'Moved to a new time or place';
        old.notice = '';
        old.movedTo = fresh._id;
        let paymentNote = '';
        if (old.payment?.status === 'paid') {
            if (samePayee) {
                fresh.payment = old.payment.toObject();
                await fresh.save();
                if (old.payment.paymentId) await Payment.updateOne({ _id: old.payment.paymentId }, { appointmentId: fresh._id });
                old.payment = { status: 'unpaid', method: '' };
                paymentNote = ' Your payment was carried over.';
            } else {
                await flagRefund(old);
                paymentNote = ' Your earlier payment will be refunded; pay the new visit separately.';
            }
        }
        await old.save();
        notify('doctor', old.doctorCNIC, { type: 'appointment', title: 'Appointment moved', body: `A patient moved their ${describe(old)} appointment to ${describe(fresh)}.`, link: `/appointments/fetch/${old.doctorCNIC}` });
        res.status(201).json({ message: `Appointment moved.${paymentNote}`, appointment: fresh });
    } catch (error) {
        console.error('Error moving appointment:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// GET /appointments/locations/:doctorCNIC - every hospital branch (and private practice) where the doctor can be booked
const locations = async (req, res) => {
    try {
        res.status(200).json(await doctorLocations(Number(req.params.doctorCNIC)));
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// Adds place: { orgName, facilityName, address } to appointments at a hospital branch
const withPlaces = async (appointments) => {
    const [orgs, facilities] = await Promise.all([
        Organization.find({ _id: { $in: [...new Set(appointments.map((a) => a.orgId).filter(Boolean))] } }).select('name').lean(),
        Facility.find({ _id: { $in: [...new Set(appointments.map((a) => a.facilityId).filter(Boolean))] } }).select('name address city').lean(),
    ]);
    return appointments.map((a) => {
        const o = a.orgId && orgs.find((x) => String(x._id) === String(a.orgId));
        const f = a.facilityId && facilities.find((x) => String(x._id) === String(a.facilityId));
        return o ? { ...a, place: { orgName: o.name, facilityName: f?.name, address: [f?.address, f?.city].filter(Boolean).join(', ') } } : a;
    });
};

const getAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ doctorCNIC: req.params.doctorCNIC }).sort({ date: 1, time: 1 }).lean();
        res.status(200).json({ appointments: await withPlaces(appointments) });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// A patient's own appointments
const getPatientAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ patientCNIC: req.params.patientCNIC }).sort({ date: 1, time: 1 }).lean();
        res.status(200).json({ appointments: await withPlaces(appointments) });
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

        // { status: 'no-show' } marks a missed visit instead
        if (req.body?.status === 'no-show') {
            appointment.status = 'no-show';
            await appointment.save();
            return res.status(200).json({ message: 'Marked as no-show', appointment });
        }
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
        await flagRefund(appointment);
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

// Doctor records a fee paid at the clinic (cash / card machine)
const markPaid = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.appointmentId);
        if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
        let allowed = req.user.role === 'doctor' && appointment.doctorCNIC === req.user.cnic;
        if (req.user.role === 'staff' && req.user.clinicId) {
            // front desk / billing of the organization where the visit happens
            const access = await orgAccess(req.user, req.user.clinicId);
            allowed = Boolean(access && appointment.orgId && String(appointment.orgId) === access.orgId
                && (access.isAdmin || access.roles.some((r) => ['reception', 'billing', 'facility_admin'].includes(r)))
                && canUseFacility(access, appointment.facilityId));
        }
        if (!allowed) return res.status(403).json({ error: 'Not allowed' });
        if (appointment.payment?.status === 'paid') return res.status(409).json({ error: 'Already paid' });
        const amount = Number(req.body?.amount) || appointment.fee;
        if (!amount || amount < 1) return res.status(400).json({ error: 'Enter the amount received' });
        const payment = await Payment.create({
            appointmentId: appointment._id, patientCNIC: appointment.patientCNIC, doctorCNIC: appointment.doctorCNIC,
            amount, provider: 'clinic', status: 'paid', txnRef: `CASH${Date.now()}${Math.floor(Math.random() * 1000)}`, paidAt: new Date(),
        });
        appointment.fee = amount;
        appointment.payment = { status: 'paid', method: 'clinic', paidAt: new Date(), paymentId: payment._id };
        await appointment.save();
        res.status(200).json({ message: 'Payment recorded', appointment });
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    availability, markPaid, locations, moveAppointment,
    book, bookedSlots, getAppointments, getPatientAppointments, completeAppointment, cancelAppointment, getAppointmentTimes,
};
