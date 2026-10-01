import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes as RouterRoutes } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import AppShell from './layout/AppShell';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
const PatientOverview = lazy(() => import('./pages/patient/Overview'));
const Records = lazy(() => import('./pages/patient/Records'));
const FindDoctors = lazy(() => import('./pages/patient/FindDoctors'));
const CareTeam = lazy(() => import('./pages/patient/CareTeam'));
const Notes = lazy(() => import('./pages/patient/Notes'));
const BookAppointment = lazy(() => import('./pages/patient/BookAppointment'));
const SubmitRecord = lazy(() => import('./pages/patient/SubmitRecord'));
const Profile = lazy(() => import('./pages/patient/Profile'));
const DoctorOverview = lazy(() => import('./pages/doctor/Overview'));
const Patients = lazy(() => import('./pages/doctor/Patients'));
const PatientHistory = lazy(() => import('./pages/doctor/PatientHistory'));
const Appointments = lazy(() => import('./pages/doctor/Appointments'));
const ReviewQueue = lazy(() => import('./pages/doctor/ReviewQueue'));
const Insights = lazy(() => import('./pages/doctor/Insights'));

const patient = (el) => <RequireAuth role="patient" param="patientCNIC">{el}</RequireAuth>;
const doctor = (el) => <RequireAuth role="doctor" param="doctorCNIC">{el}</RequireAuth>;

const PageLoader = () => (
  <div className="stack gap-20">
    <div className="skeleton" style={{ height: 48, width: '40%' }} />
    <div className="skeleton" style={{ height: 220 }} />
  </div>
);

const Routes = () => (
  <Suspense fallback={<PageLoader />}>
  <RouterRoutes>
    <Route path="/" element={<Landing />} />
    <Route path="/doctor/signin" element={<Auth role="doctor" mode="signin" />} />
    <Route path="/doctor/signup" element={<Auth role="doctor" mode="signup" />} />
    <Route path="/patient/signin" element={<Auth role="patient" mode="signin" />} />
    <Route path="/patient/signup" element={<Auth role="patient" mode="signup" />} />

    <Route element={<RequireAuth role="patient"><AppShell role="patient" /></RequireAuth>}>
      <Route path="/patient/home/:patientCNIC" element={patient(<PatientOverview />)} />
      <Route path="/patient/update/:patientCNIC" element={patient(<Profile />)} />
      <Route path="/patient/:patientCNIC/getnote" element={patient(<Notes />)} />
      <Route path="/affiliation/getmydoctors/:patientCNIC" element={patient(<CareTeam />)} />
      <Route path="/record/getrecords/:patientCNIC" element={patient(<Records />)} />
      <Route path="/appointments/book/:patientCNIC" element={patient(<BookAppointment />)} />
      <Route path="/tempRecords/submit/:patientCNIC" element={patient(<SubmitRecord />)} />
      <Route path="/doctor/doctors" element={<FindDoctors />} />
    </Route>

    <Route element={<RequireAuth role="doctor"><AppShell role="doctor" /></RequireAuth>}>
      <Route path="/doctor/home/:doctorCNIC" element={doctor(<DoctorOverview />)} />
      <Route path="/affiliation/getmypatients/:doctorCNIC" element={doctor(<Patients />)} />
      <Route path="/appointments/fetch/:doctorCNIC" element={doctor(<Appointments />)} />
      <Route path="/appointments/fetchByTime/:doctorCNIC" element={doctor(<Insights />)} />
      <Route path="/tempRecords/pending/:doctorCNIC" element={doctor(<ReviewQueue />)} />
      <Route path="/records/getrecords/:patientCNIC" element={<PatientHistory />} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </RouterRoutes>
  </Suspense>
);

export default Routes;
