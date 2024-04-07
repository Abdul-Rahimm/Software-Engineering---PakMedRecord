// Import necessary modules and models
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaUserMd, FaFileAlt, FaStickyNote, FaSignOutAlt, FaPlus, FaMinus, FaFileMedical } from 'react-icons/fa'; // Added FaFileMedical icon
import bg3 from '../../assets/bg3.png';
import {
  Button,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  TextareaAutosize,
  FormControl,
  InputLabel,
  Input,
  CardActions,
  Avatar,
  CircularProgress, // Added for loading indicator
} from '@mui/material';

const HomePage = () => {
  const [patientData, setPatientData] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const { patientCNIC } = useParams();
  const navigate = useNavigate();
  const [showHospitals, setShowHospitals] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [loading, setLoading] = useState(false); // Added for loading indicator

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setLoading(true); // Show loading indicator
        if (patientCNIC) {
          const response = await axios.get(`http://localhost:3009/patient/home/${patientCNIC}`);
          setPatientData(response.data);
        }
        setLoading(false); // Hide loading indicator
      } catch (error) {
        console.error('Error fetching patient data:', error);
        setLoading(false); // Hide loading indicator
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
      navigate('/');
    }
  };

  const handleViewNotes = () => {
    navigate(`/notes/getnotes/${patientCNIC}`);
  };

  const handleAddNote = async () => {
    try {
      setLoading(true); // Show loading indicator
      const response = await axios.post(`http://localhost:3009/patient/${patientCNIC}/addnote`, { patientCNIC, note: newNoteText });
      console.log('Note added successfully:', response.data.message);
      setNewNoteText('');
      setNotes([...notes, newNoteText]);
      setLoading(false); // Hide loading indicator
    } catch (error) {
      console.error('Error adding note:', error);
      setLoading(false); // Hide loading indicator
    }
  };

  const handleViewRecords = () => {
    navigate(`/record/getrecords/${patientCNIC}`); // Navigate to My Records page
  };

  const backgroundStyle = {
    backgroundImage: `url(${bg3})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '100vh',
    marginLeft: '80px',
    minwidth: '100%',
  };

  return (
    <Container style={backgroundStyle}>
      <Grid container justifyContent="center">
        <Grid item xs={12} md={8}>
          <div className="text-center mt-5">
            <Typography variant="h4" style={{ color: 'green', marginLeft: '40px', marginTop: '-50px', fontSize: '50px', fontWeight: 'bold' }}>PakMedRecord.</Typography> <br />
            <Typography variant="h4" style={{ color: 'black', marginLeft: '50px' }}>
              Welcome, {patientData && `${patientData.firstName} ${patientData.lastName}`}!
              {patientData && <Avatar alt="Profile Picture" src={patientData.profilePicture} />} {/* Added profile picture */}
            </Typography>
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
            <Button variant="outlined" color="primary" style={{ marginLeft: '20px', borderRadius: '100px' }} startIcon={<FaFileMedical />} onClick={handleViewRecords}>View Medical Records</Button> {/* Added button for viewing medical records */}
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
            <Button variant="contained" color="error" onClick={handleLogout} style={{ marginLeft: '1300px', marginBottom: '-950px' }}>
              Logout <FaSignOutAlt />
            </Button>
          )}
        </div>
      </div>

      <Container mt-5>
        {loading ? ( // Show loading indicator
          <div style={{ textAlign: 'center' }}>
            <CircularProgress />
          </div>
        ) : (
          <>
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
          </>
        )}
      </Container>
    </Container>
  );
};

export default HomePage;
