import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes as RouterRoutes } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import AppShell from './layout/AppShell';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import VerifyEmail from './pages/VerifyEmail';
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
const DoctorProfile = lazy(() => import('./pages/doctor/DoctorProfile'));
const ClinicHours = lazy(() => import('./pages/doctor/ClinicHours'));
const Clinic = lazy(() => import('./pages/doctor/Clinic'));
const HealthProfile = lazy(() => import('./pages/patient/HealthProfile'));
const Vitals = lazy(() => import('./pages/patient/Vitals'));
const MyAppointments = lazy(() => import('./pages/patient/MyAppointments'));
const Medicines = lazy(() => import('./pages/patient/Medicines'));
const Vaccines = lazy(() => import('./pages/patient/Vaccines'));
const LabTrends = lazy(() => import('./pages/patient/LabTrends'));
const Sharing = lazy(() => import('./pages/patient/Sharing'));
const Family = lazy(() => import('./pages/patient/Family'));
const Security = lazy(() => import('./pages/shared/Security'));
const VideoVisit = lazy(() => import('./pages/visit/VideoVisit'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));
const StaffSignin = lazy(() => import('./pages/admin/AdminSignin'));
const DeskApp = lazy(() => import('./pages/desk/DeskApp'));
const Developers = lazy(() => import('./pages/public/Developers'));
const lazyNamed = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));
const legal = () => import('./pages/public/Legal');
const Terms = lazyNamed(legal, 'Terms');
const Privacy = lazyNamed(legal, 'Privacy');
const reset = () => import('./pages/public/PasswordReset');
const ForgotPassword = lazyNamed(reset, 'ForgotPassword');
const ResetPassword = lazyNamed(reset, 'ResetPassword');
const directory = () => import('./pages/public/Directory');
const DoctorDirectory = lazyNamed(directory, 'DoctorDirectory');
const HospitalDirectory = lazyNamed(directory, 'HospitalDirectory');
const HospitalProfile = lazyNamed(directory, 'HospitalProfile');
const HospitalRegister = lazy(() => import('./pages/public/HospitalRegister'));
const VerifyIdentity = lazy(() => import('./pages/identity/VerifyIdentity'));
const ClaimCnic = lazy(() => import('./pages/identity/ClaimCnic'));
const DoctorPublicProfile = lazyNamed(directory, 'DoctorPublicProfile');
const publicRecords = () => import('./pages/public/PublicRecords');
const EmergencyPage = lazyNamed(publicRecords, 'EmergencyPage');
const SharedRecordPage = lazyNamed(publicRecords, 'SharedRecordPage');
const RxVerifyPage = lazyNamed(publicRecords, 'RxVerifyPage');
const payments = () => import('./pages/public/Payments');
const TestCheckout = lazyNamed(payments, 'TestCheckout');
const PaymentResult = lazyNamed(payments, 'PaymentResult');

const patient = (el) => <RequireAuth role="patient" param="patientCNIC">{el}</RequireAuth>;
const doctor = (el) => <RequireAuth role="doctor" param="doctorCNIC">{el}</RequireAuth>;

const PageLoader = () => (
  <div className="stack gap-20" style={{ padding: 24 }}>
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
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/developers" element={<Developers />} />
    <Route path="/find-doctors" element={<DoctorDirectory />} />
    <Route path="/hospitals" element={<HospitalDirectory />} />
    <Route path="/verify-identity" element={<VerifyIdentity />} />
    <Route path="/claim-cnic" element={<ClaimCnic />} />
    <Route path="/hospitals/register" element={<HospitalRegister />} />
    <Route path="/hospitals/:id" element={<HospitalProfile />} />
    <Route path="/find-doctors/:id" element={<DoctorPublicProfile />} />
    <Route path="/e/:token" element={<EmergencyPage />} />
    <Route path="/s/:token" element={<SharedRecordPage />} />
    <Route path="/rx/:code" element={<RxVerifyPage />} />
    <Route path="/pay/test/:ref" element={<RequireAuth role="patient"><TestCheckout /></RequireAuth>} />
    <Route path="/payments/result" element={<PaymentResult />} />
    <Route path="/admin/signin" element={<StaffSignin kind="admin" />} />
    <Route path="/admin" element={<AdminApp />} />
    <Route path="/desk/signin" element={<StaffSignin kind="desk" />} />
    <Route path="/desk" element={<DeskApp />} />
    <Route path="/visit/:appointmentId" element={<VideoVisit />} />

    <Route element={<RequireAuth role="patient"><AppShell role="patient" /></RequireAuth>}>
      <Route path="/patient/home/:patientCNIC" element={patient(<PatientOverview />)} />
      <Route path="/patient/update/:patientCNIC" element={patient(<Profile />)} />
      <Route path="/patient/:patientCNIC/getnote" element={patient(<Notes />)} />
      <Route path="/patient/:patientCNIC/security" element={patient(<Security />)} />
      <Route path="/affiliation/getmydoctors/:patientCNIC" element={patient(<CareTeam />)} />
      <Route path="/record/getrecords/:patientCNIC" element={patient(<Records />)} />
      <Route path="/appointments/book/:patientCNIC" element={patient(<BookAppointment />)} />
      <Route path="/tempRecords/submit/:patientCNIC" element={patient(<SubmitRecord />)} />
      <Route path="/patient/:patientCNIC/health" element={patient(<HealthProfile />)} />
      <Route path="/vitals/:patientCNIC" element={patient(<Vitals />)} />
      <Route path="/appointments/mine/:patientCNIC" element={patient(<MyAppointments />)} />
      <Route path="/meds/:patientCNIC" element={patient(<Medicines />)} />
      <Route path="/vaccines/:patientCNIC" element={patient(<Vaccines />)} />
      <Route path="/labs/:patientCNIC" element={patient(<LabTrends />)} />
      <Route path="/sharing/:patientCNIC" element={patient(<Sharing />)} />
      <Route path="/family/:patientCNIC" element={patient(<Family />)} />
      <Route path="/doctor/doctors" element={<FindDoctors />} />
    </Route>

    <Route element={<RequireAuth role="doctor"><AppShell role="doctor" /></RequireAuth>}>
      <Route path="/doctor/home/:doctorCNIC" element={doctor(<DoctorOverview />)} />
      <Route path="/affiliation/getmypatients/:doctorCNIC" element={doctor(<Patients />)} />
      <Route path="/appointments/fetch/:doctorCNIC" element={doctor(<Appointments />)} />
      <Route path="/appointments/fetchByTime/:doctorCNIC" element={doctor(<Insights />)} />
      <Route path="/tempRecords/pending/:doctorCNIC" element={doctor(<ReviewQueue />)} />
      <Route path="/records/getrecords/:patientCNIC" element={<PatientHistory />} />
      <Route path="/doctor/profile/:doctorCNIC" element={doctor(<DoctorProfile />)} />
      <Route path="/doctor/hours/:doctorCNIC" element={doctor(<ClinicHours />)} />
      <Route path="/clinic/:doctorCNIC" element={doctor(<Clinic />)} />
      <Route path="/doctor/security/:doctorCNIC" element={doctor(<Security />)} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </RouterRoutes>
  </Suspense>
);

export default Routes;
