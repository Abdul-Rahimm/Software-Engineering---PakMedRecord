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

const Routes = () => {
  return (
    <RouterRoutes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/doctor/signup" element={<Signup />} />
      <Route path="/doctor/signin" element={<Signin />} />
      <Route path="/doctor/home/:doctorCNIC" element={<Home />} />
      <Route path="/doctor/doctors" element={<DoctorList />} /> 
      <Route path="/patient/signup" element={<Sign_up />} />
      <Route path="/patient/signin" element={<Sign_in />} />
      <Route path="/patient/home/:patientCNIC" element={<HomePage />} />
      <Route path="/patient/update/:patientCNIC" element={<UpdatePatient />} />
      <Route path="/affiliation/getmydoctors/:patientCNIC" element={<ViewMyDoctors />} />
      <Route path="/affiliation/getmypatients/:doctorCNIC" element={<ViewMyPatients />} />
      <Route path="/patient/:patientCNIC/getnote" element={<Notes />} />
      <Route path="/record/getrecords/:patientCNIC" element={<MyRecordsPage />} />
      <Route path="/appointments/book/:patientCNIC" element={<AppointmentBooking />} />
      <Route path="/appointments/fetch/:doctorCNIC" element={<DoctorAppointments />} />
      <Route path="/appointments/fetchByTime/:doctorCNIC" element={< Statistics/>} />
      <Route path="/tempRecords/submit/:patientCNIC" element={<MedicalRecordForm />} />
      <Route path="/tempRecords/pending/:doctorCNIC" element={<PendingMedicalRecords />} />
      <Route path="/records/getrecords/:patientCNIC" element={<MedicalHistory />} />



    </RouterRoutes>
  );
};

export default Routes;
