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

    </RouterRoutes>
  );
};

export default Routes;
