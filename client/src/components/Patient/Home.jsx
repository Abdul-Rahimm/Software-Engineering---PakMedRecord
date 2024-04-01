import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaUserMd, FaFileAlt, FaStickyNote, FaSignOutAlt, FaPlus, FaMinus } from 'react-icons/fa'; // Importing icons
import Header from '../Header';
import bg3 from '../../assets/bg3.png';
import { Button, Container, Typography, Grid, Card, CardContent, TextareaAutosize, FormControl, InputLabel, Input, CardActions } from '@mui/material'; // Importing Material-UI components

const HomePage = () => {
  const [patientData, setPatientData] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const { patientCNIC } = useParams();
  const navigate = useNavigate();
  const [showHospitals, setShowHospitals] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false); // Step 1

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        if (patientCNIC) {
          const response = await axios.get(`http://localhost:3009/patient/home/${patientCNIC}`);
          setPatientData(response.data);
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      }
    };

    fetchPatientData();
  }, [patientCNIC]);

  const handleViewHospitals = () => {
    setShowHospitals(!showHospitals);
  };

  const handleHospitalClick = (hospitalId) => {
    console.log('Selected Hospital:', hospitalId);
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    
    if (confirmLogout) {
      navigate('/'); // Navigate to the homepage
    }
  };

  const handleViewNotes = () => {
    navigate(`/notes/getnotes/${patientCNIC}`);
  };

  const handleAddNote = async () => {
    try {
      const response = await axios.post(`http://localhost:3009/patient/${patientCNIC}/addnote`, { patientCNIC, note: newNoteText });
      console.log('Note added successfully:', response.data.message);
      setNewNoteText(''); // Clear the input field after adding the note
      setNotes([...notes, newNoteText]); // Update the notes list
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const backgroundStyle = {
    backgroundImage: `url(${bg3})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '100vh',
    marginLeft: '80px',
  };

  return (
    <Container style={backgroundStyle} >
      <Header />
      <Grid container justifyContent="center">
        <Grid item xs={12} md={8}>
          <div className="text-center mt-5" >
            <Typography variant="h4" style={{ color: 'black', marginLeft: '50px' }}>Welcome, {patientData && `${patientData.firstName} ${patientData.lastName}`}!</Typography>
            <Typography variant="h4" style={{ color: 'green', marginLeft: '40px' }}>PakMedRecord.</Typography>
            <br />
            <Link to="/doctor/doctors">
              <Button variant="contained" color="success" style={{ marginLeft: '20px', borderRadius: '100px' }} startIcon={<FaUserMd />}>Find Doctors</Button>
            </Link>
            <Link to="/affiliation/getmydoctors/:patientCNIC">
              <Button variant="outlined" color="success" style={{ marginLeft: '20px', borderRadius: '100px' }} startIcon={<FaFileAlt />}>My Doctors</Button>
            </Link>
            <Link to={`/patient/${patientCNIC}/getnote`}>
              <Button variant="outlined" color="success" style={{ marginLeft: '20px', borderRadius: '100px' }} startIcon={<FaStickyNote />}>View Notes</Button>
            </Link>
          </div>
        </Grid>
      </Grid>

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

          {patientData && (
            <Button variant="contained" color="error" onClick={handleLogout} style={{ marginLeft: '1300px', marginBottom: '-775px' }}>
              Logout <FaSignOutAlt />
            </Button>
          )}
        </div>
      </div>

      <Container mt-5>
        {showAddNoteForm && (
          <div className="form-group">
            <InputLabel htmlFor="newNote" style={{ color: 'black' }}>Add Note:</InputLabel>
            <TextareaAutosize
              id="newNote"
              className="form-control"
              rows="3"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
            ></TextareaAutosize>
            <CardActions>
              <Button variant="contained" color="secondary" onClick={handleAddNote} startIcon={<FaPlus />}>Add</Button>
            </CardActions>
          </div>
        )}
        <Button variant="contained" color="success" onClick={() => setShowAddNoteForm(!showAddNoteForm)}>
          {showAddNoteForm ? <span><FaMinus /> Close Note Form</span> : <span><FaPlus /> Open Note Form</span>}
        </Button>
      </Container>
    </Container>
  );
};

export default HomePage;
