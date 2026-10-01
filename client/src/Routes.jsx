import React from 'react';
import { Routes as RouterRoutes, Route } from 'react-router-dom';
import Signup from './components/Doctor/Signup';
import Signin from './components/Doctor/Signin';
import HeroPage from './components/HeroPage';
import Home from './components/Doctor/Home';
import Sign_up from './components/Patient/Signup';
import Sign_in from './components/Patient/Signin';
import HomePage from './components/Patient/Home';
import DoctorList from './components/Patient/doctorList';
import ViewMyDoctors from './components/Patient/viewDoctors';
import Notes from './components/Patient/Notes';
import MyRecordsPage from './components/Patient/myRecords';
import UpdatePatient from './components/Patient/updatePatient';
import AppointmentBooking from './components/Patient/Appointment';
import DoctorAppointments from './components/Doctor/getAppointments';
import MedicalRecordForm from './components/Patient/uploadRecord';
import PendingMedicalRecords from './components/Doctor/tempRecords';
import ViewMyPatients from './components/Doctor/viewPatients';
import Statistics from './components/Doctor/Statistics';
import MedicalHistory from './components/Doctor/medicalHistory';
import RequireAuth from './RequireAuth';

const Routes = () => {
  return (
    <RouterRoutes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/doctor/signup" element={<Signup />} />
      <Route path="/doctor/signin" element={<Signin />} />
      <Route path="/doctor/home/:doctorCNIC" element={<RequireAuth role="doctor" param="doctorCNIC"><Home /></RequireAuth>} />
      <Route path="/doctor/doctors" element={<RequireAuth role="patient"><DoctorList /></RequireAuth>} /> 
      <Route path="/patient/signup" element={<Sign_up />} />
      <Route path="/patient/signin" element={<Sign_in />} />
      <Route path="/patient/home/:patientCNIC" element={<RequireAuth role="patient" param="patientCNIC"><HomePage /></RequireAuth>} />
      <Route path="/patient/update/:patientCNIC" element={<RequireAuth role="patient" param="patientCNIC"><UpdatePatient /></RequireAuth>} />
      <Route path="/affiliation/getmydoctors/:patientCNIC" element={<RequireAuth role="patient" param="patientCNIC"><ViewMyDoctors /></RequireAuth>} />
      <Route path="/affiliation/getmypatients/:doctorCNIC" element={<RequireAuth role="doctor" param="doctorCNIC"><ViewMyPatients /></RequireAuth>} />
      <Route path="/patient/:patientCNIC/getnote" element={<RequireAuth role="patient" param="patientCNIC"><Notes /></RequireAuth>} />
      <Route path="/record/getrecords/:patientCNIC" element={<RequireAuth role="patient" param="patientCNIC"><MyRecordsPage /></RequireAuth>} />
      <Route path="/appointments/book/:patientCNIC" element={<RequireAuth role="patient" param="patientCNIC"><AppointmentBooking /></RequireAuth>} />
      <Route path="/appointments/fetch/:doctorCNIC" element={<RequireAuth role="doctor" param="doctorCNIC"><DoctorAppointments /></RequireAuth>} />
      <Route path="/appointments/fetchByTime/:doctorCNIC" element={<RequireAuth role="doctor" param="doctorCNIC"><Statistics /></RequireAuth>} />
      <Route path="/tempRecords/submit/:patientCNIC" element={<RequireAuth role="patient" param="patientCNIC"><MedicalRecordForm /></RequireAuth>} />
      <Route path="/tempRecords/pending/:doctorCNIC" element={<RequireAuth role="doctor" param="doctorCNIC"><PendingMedicalRecords /></RequireAuth>} />
      <Route path="/records/getrecords/:patientCNIC" element={<RequireAuth role="doctor"><MedicalHistory /></RequireAuth>} />
    </RouterRoutes>
  );
};

export default Routes;
