import React from 'react';
import { Routes as RouterRoutes, Route } from 'react-router-dom';
import Signup from './components/Doctor/Signup';
import Signin from './components/Doctor/Signin';
import HeroPage from './components/HeroPage';
import Home from './components/Doctor/Home';

const Routes = () => {
  return (
    <RouterRoutes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/doctor/signup" element={<Signup />} />
      <Route path="/doctor/signin" element={<Signin />} />
      <Route path="/doctor/home/:cnic" element={<Home />} />


    </RouterRoutes>
  );
};

export default Routes;
