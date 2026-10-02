const express = require('express');
const c = require('../contollers/ClinicController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { signinLimiter } = require('../middleware/rateLimit');

// /clinics (doctors)
const clinics = express.Router();
clinics.use(requireAuth, requireRole('doctor'));
clinics.get('/mine', c.mine);
clinics.post('/', c.create);
clinics.put('/:id', c.update);
clinics.post('/:id/invite', c.invite);
clinics.post('/:id/respond', c.respond);
clinics.delete('/:id/doctors/:doctorCNIC', c.removeMember);
clinics.post('/:id/staff', c.addStaff);
clinics.patch('/:id/staff/:staffId', c.setStaff);

// /desk (front-desk staff)
const desk = express.Router();
desk.post('/signin', signinLimiter, c.staffSignin);
desk.use(requireAuth, requireRole('staff'));
desk.get('/day', c.deskDay);
desk.get('/patient/:cnic', c.deskPatient);
desk.post('/book', c.deskBook);
desk.post('/appointments/:id', c.deskUpdate);

module.exports = { clinics, desk };
