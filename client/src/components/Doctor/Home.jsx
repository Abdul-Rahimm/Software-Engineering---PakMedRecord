import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../Header';
import bg3 from '../../assets/bg3.png';

const Home = () => {
  const [doctorData, setDoctorData] = useState(null);
  const [medicalRecord, setMedicalRecord] = useState(null); // State to store the medical record
  const [patientCNIC, setPatientCNIC] = useState('');
  const [recordData, setRecordData] = useState('');
  const { doctorCNIC } = useParams();
  const navigate = useNavigate();
  const [showHospitals, setShowHospitals] = useState(false);
  const [showMedicalRecordForm, setShowMedicalRecordForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        if (doctorCNIC) {
          const response = await axios.get(`http://localhost:3009/doctor/home/${doctorCNIC}`);
          setDoctorData(response.data);
        }
      } catch (error) {
        console.error('Error fetching doctor data:', error);
      }
    };

    fetchDoctorData();
  }, [doctorCNIC]);

  const handleViewHospitals = () => {
    setShowHospitals(!showHospitals);
  };

  const handleHospitalClick = (hospitalId) => {
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

  const handleSubmitMedicalRecord = async (formData) => {
    try {
      const response = await axios.post('http://localhost:3009/record/create', {
        patientCNIC: formData.patientCNIC,
        doctorCNIC,
        recordData: formData.recordData,
      });
      setMedicalRecord(response.data);
      setSuccessMessage(`Medical Record for patient with CNIC: ${formData.patientCNIC} created successfully!`);
      setPatientCNIC('');
      setRecordData('');
      setShowMedicalRecordForm(false);
    } catch (error) {
      console.error('Error creating medical record:', error);
    }
  };
  

  const backgroundStyle = {
    backgroundImage: `url(${bg3})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '100vh',
    marginLeft: '80px'
  };

  const successMessageStyle = {
    display: successMessage ? 'flex' : 'none',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: '9999',
  };

  return (
    <div className="container" style={backgroundStyle}>
      <div className="alert alert-success" role="alert" style={successMessageStyle}>
        {successMessage}
      </div>
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="text-center mt-5">
            <h2 style={{ color: 'black', marginLeft: '50px' }}>Welcome, Dr. {doctorData && `${doctorData.firstName} ${doctorData.lastName}`}!</h2>
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
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                handleSubmitMedicalRecord(Object.fromEntries(formData));
              }}>
                <div className="form-group">
                  <label htmlFor="patientCNIC">Patient CNIC:</label>
                  <input type="text" className="form-control" id="patientCNIC" name="patientCNIC" value={patientCNIC} onChange={(e) => setPatientCNIC(e.target.value)} placeholder="Enter patient's CNIC" />
                </div>
                <div className="form-group">
                  <label htmlFor="recordData">Medical Record:</label>
                  <textarea className="form-control" id="recordData" name="recordData" value={recordData} onChange={(e) => setRecordData(e.target.value)} rows="3" placeholder="Enter medical record"></textarea>
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
            {showHospitals && (
              <ul className="list-group" style={{ position: 'absolute', top: '50px', right: '0', zIndex: 1 }}>
                <li className="list-group-item" onClick={() => handleHospitalClick(1)}>Hospital 1</li>
                <li className="list-group-item" onClick={() => handleHospitalClick(2)}>Hospital 2</li>
                <li className="list-group-item" onClick={() => handleHospitalClick(3)}>Hospital 3</li>
              </ul>
            )}
          </div>

          {doctorData && (
            <button className="btn btn-danger" onClick={handleLogout} style={{ marginLeft: '1300px', marginBottom: '-800px' }}>
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
