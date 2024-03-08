import React from 'react';
import { Link } from 'react-router-dom';

const HeroPage = () => {
  return (
    <div className="container mt-5 text-center" style={{ marginLeft: '270px' }}>
      <h1>Welcome to PakMedRecord</h1>
      <p>Please select your role:</p>
      <div className="mt-3" >
        <Link to="/doctor/signin" className="btn btn-success mr-3">
          Signin as Doctor
        </Link>
        <Link to="/patient/signin" className="btn btn-danger">
          Signin as Patient
        </Link>
      </div>
    </div>
  );
};

export default HeroPage;
