import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../Header';
import bg3 from '../../assets/bg3.png';

const HomePage = () => {
  const [patientData, setPatientData] = useState(null);
  const { cnic } = useParams();
  const navigate = useNavigate();
  const [showHospitals, setShowHospitals] = useState(false);
  const [showMedicalRecordForm, setShowMedicalRecordForm] = useState(false);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        if (cnic) {
          const response = await axios.get(`http://localhost:3009/patient/home/${cnic}`);
          setPatientData(response.data);
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      }
    };

    fetchPatientData();
  }, [cnic]);

  const handleViewHospitals = () => {
    setShowHospitals(!showHospitals);
  };

  const handleHospitalClick = (hospitalId) => {
    // Implement navigation to the hospital details page using hospitalId
    // For now, we'll just log the selected hospitalId
    console.log('Selected Hospital:', hospitalId);
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    
    if (confirmLogout) {
      navigate('/');
    }
  };

  const handleOpenMedicalRecordForm = () => {
    setShowMedicalRecordForm(true);
  };

  const handleCloseMedicalRecordForm = () => {
    setShowMedicalRecordForm(false);
  };

  const backgroundStyle = {
    backgroundImage: `url(${bg3})`, // Replace with the path to your image
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '100vh',
    marginLeft: '80px'
  };

  return (
    <div className="container" style={backgroundStyle}>
      <Header/>
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="text-center mt-5" >
            <h2 style={{ color: 'black', marginLeft: '50px' }}>Welcome,  {patientData && `${patientData.firstName} ${patientData.lastName}`}!</h2>
            <h2 style={{ color: 'green', marginLeft: '40px' }}>PakMedRecord.</h2>
            <button className="btn btn-success" onClick={handleOpenMedicalRecordForm} style={{ marginTop: '20px', marginLeft: '20px' }}>
              Open Medical Record Form
            </button>
          </div>
        </div>
      </div>

      {showMedicalRecordForm && (
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="text-center mt-5">
              <h2>Medical Record Form</h2>
              <form>
                <div className="form-group">
                  <label htmlFor="patientName">Patient Name:</label>
                  <input type="text" className="form-control" id="patientName" placeholder="Enter patient's name" />
                </div>
                <div className="form-group">
                  <label htmlFor="diagnosis">Diagnosis:</label>
                  <textarea className="form-control" id="diagnosis" rows="3" placeholder="Enter diagnosis"></textarea>
                </div>
                <div className="form-group">
                  <label htmlFor="medications">Medications:</label>
                  <input type="text" className="form-control" id="medications" placeholder="Enter medications" />
                </div>
                <button type="submit" className="btn btn-primary">Submit</button>
              </form>
              <button className="btn btn-secondary" onClick={handleCloseMedicalRecordForm}>
                Close Form
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-end mt-3">
        <div className="ml-auto">
          <div className="btn-group">
            {/* <button className="btn btn-primary" onClick={handleViewHospitals} style={{ marginLeft: '200px', marginTop: '400px' }}>
              View Hospitals
            </button> */}
            {showHospitals && (
              <ul className="list-group" style={{ position: 'absolute', top: '50px', right: '0', zIndex: 1 }}>
                <li className="list-group-item" onClick={() => handleHospitalClick(1)}>Hospital 1</li>
                <li className="list-group-item" onClick={() => handleHospitalClick(2)}>Hospital 2</li>
                <li className="list-group-item" onClick={() => handleHospitalClick(3)}>Hospital 3</li>
              </ul>
            )}
          </div>

          {patientData && (
            <button className="btn btn-danger" onClick={handleLogout} style={{ marginLeft: '1300px', marginBottom: '-1000px' }}>
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
