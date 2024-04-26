import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemIcon, ListItemText, Typography, Button, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { FaBars, FaCalculator, FaCalendarPlus, FaFileMedical } from 'react-icons/fa';
import Reminders from './Reminders';
import bg3 from '../../assets/bg3.png';

const Home = () => {
  const [doctorData, setDoctorData] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMedicalRecordForm, setShowMedicalRecordForm] = useState(false);
  const [recordData, setRecordData] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const { doctorCNIC } = useParams();
  const [patients, setPatients] = useState([]); // State to store the list of affiliated patients
  const [medicalRecord, setMedicalRecord] = useState(null); // State to store the medical record
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await axios.get(`http://localhost:3009/affiliation/getmypatients/${doctorCNIC}`);
        setPatients(response.data);
      } catch (error) {
        console.error('Error fetching affiliated patients:', error);
      }
    };

    fetchPatients();
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

  const handleSubmitMedicalRecord = async () => {
    try {
      const response = await axios.post('http://localhost:3009/record/create', {
        patientCNIC: selectedPatient,
        doctorCNIC,
        recordData,
      });
      setMedicalRecord(response.data);
      setSuccessMessage(`Medical Record for patient with CNIC: ${selectedPatient} created successfully!`);
      setSelectedPatient('');
      setRecordData('');
      setShowMedicalRecordForm(false);
      setErrorMessage(''); // Clear any previous error messages
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error('Error creating medical record:', error);
      setErrorMessage('Error creating medical record. Please try again.'); // Set error message
      setSuccessMessage(''); // Clear any previous success messages
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

  const errorMessageStyle = {
    display: errorMessage ? 'flex' : 'none',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'fixed',
    top: '60px', // Adjust position as needed
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'red',
    color: 'white',
    padding: '10px',
    borderRadius: '4px',
    zIndex: '9999',
  };

  return (
    <div className="container" style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', backgroundPosition: 'center', height: '100vh', minWidth: '100vw' }}>
      <div className="alert alert-success" role="alert" style={successMessageStyle}>
        {successMessage}
      </div>
      <div className="alert alert-danger" role="alert" style={errorMessageStyle}>
        {errorMessage}
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
          <ListItem button component={Link} to={`/affiliation/getmypatients/${doctorCNIC}`} onClick={() => setShowSidebar(false)}>
            <ListItemIcon><FaCalendarPlus /></ListItemIcon>
            <ListItemText>My Patients</ListItemText>
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
          <ListItem button component={Link} to={`/appointments/fetchByTime/${doctorCNIC}`} onClick={() => setShowSidebar(false)}>
            <ListItemIcon><FaCalculator /></ListItemIcon>
            <ListItemText>Statistics</ListItemText>
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
              <h1 style={{ color: 'green' }}>PakMedRecord</h1>
              <Button variant="outlined-success" onClick={toggleSidebar} style={{ marginLeft: '-1150px', marginTop: '-150px', color: 'green', fontSize: "40px" }}><FaBars /></Button>
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
                  handleSubmitMedicalRecord();
                }}>
                  <div className="form-group">
                    <FormControl fullWidth>
                      <InputLabel id="patient-select-label">Select Patient</InputLabel>
                      <Select
                        labelId="patient-select-label"
                        id="patient-select"
                        value={selectedPatient}
                        onChange={(e) => setSelectedPatient(e.target.value)}
                      >
                        <label htmlFor="">Select Patient CNIC</label>
                        {patients.map((patient) => (
                          <MenuItem key={patient.patientCNIC} value={patient.patientCNIC}>
                            {patient.patientCNIC}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>
                  <div className="form-group">
                    <label htmlFor="recordData">Medical Record:</label>
                    <textarea className="form-control" id="recordData" name="recordData" value={recordData} onChange={(e) => setRecordData(e.target.value)} rows="3" placeholder="Enter medical record"></textarea>
                  </div>
                  <button type="submit" className="btn btn-outline-success">Submit</button>
                </form> <br />
                <button className="btn btn-success" onClick={handleCloseMedicalRecordForm}>
                  Close Form
                </button>
              </div>
            </div>
          </div>
        )}

        {!showMedicalRecordForm && <Reminders />}
      </div>
    </div>
  );
};

export default Home;
