import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Typography, Button, TextField } from '@mui/material';
import { FaBars, FaCalendarPlus, FaFileMedical } from 'react-icons/fa';
import bg3 from '../../assets/bg3.png';

const Home = () => {
  const [doctorData, setDoctorData] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMedicalRecordForm, setShowMedicalRecordForm] = useState(false);
  const [recordData, setRecordData] = useState('');
  const { doctorCNIC } = useParams();
  const [patientCNIC, setPatientCNIC] = useState('');
  const [medicalRecord, setMedicalRecord] = useState(null); // State to store the medical record
  const [successMessage, setSuccessMessage] = useState('');

  const navigate = useNavigate();

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

  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (confirmLogout) {
      navigate('/');
    }
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const toggleMedicalRecordForm = () => {
    setShowMedicalRecordForm(!showMedicalRecordForm);
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
    <div className="container" style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', backgroundPosition: 'center', height: '100vh', minWidth: '100vw' }}>
        <div className="alert alert-success" role="alert" style={successMessageStyle}>
        {successMessage}
      </div>
      <Drawer anchor="left" open={showSidebar} onClose={() => setShowSidebar(false)}>
        <List>
          {/* PakMedRecord header */}
          <ListItem>
            <Typography variant="h5" style={{ fontWeight: 'bold' }}>PakMedRecord</Typography>
          </ListItem>
          {/* Welcome message */}
          <ListItem>
            <Typography variant="subtitle1">Welcome, Dr. {doctorData && `${doctorData.firstName} ${doctorData.lastName}`}!</Typography>
          </ListItem>
          {/* Open Medical Record Form */}
          <ListItem button onClick={toggleMedicalRecordForm}>
            <ListItemIcon><FaFileMedical /></ListItemIcon>
            <ListItemText>Open Medical Record Form</ListItemText>
          </ListItem>
          {/* View Appointments */}
          <ListItem button component={Link} to={`/appointments/fetch/${doctorCNIC}`} onClick={() => setShowSidebar(false)}>
            <ListItemIcon><FaCalendarPlus /></ListItemIcon>
            <ListItemText>View Appointments</ListItemText>
          </ListItem>
          <ListItem button component={Link} to={`/tempRecords/pending/${doctorCNIC}`} onClick={() => setShowSidebar(false)}>
            <ListItemIcon><FaCalendarPlus /></ListItemIcon>
            <ListItemText>View Pending Records</ListItemText>
          </ListItem>
          {/* Logout */}
          <ListItem button onClick={handleLogout}>
            <ListItemIcon><FaBars /></ListItemIcon>
            <ListItemText>Logout</ListItemText>
          </ListItem>
        </List>
      </Drawer>

      {/* Page content */}
      <div className="content">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="text-center mt-5">
              <h2>Welcome, Dr. {doctorData && `${doctorData.firstName} ${doctorData.lastName}`}!</h2>
              <h2>PakMedRecord.</h2>
              <Button variant="outlined-success" onClick={toggleSidebar} style={{ marginLeft: '-1150px', marginTop: '-200px', color: 'green', fontSize: "40px" }}><FaBars /></Button>
            </div>
          </div>
        </div>

        {/* Medical Record Form */}
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

        {/* Other content */}
        <div className="row justify-content-center mt-4">
          <div className="col-md-8">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Other Content</h5>
                <p className="card-text">This is where you can add additional content for the doctor's home page.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
