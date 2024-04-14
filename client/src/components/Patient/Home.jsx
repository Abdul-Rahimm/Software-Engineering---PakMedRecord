import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaUser, FaUserMd, FaFileAlt, FaStickyNote, FaSignOutAlt, FaPlus, FaMinus, FaFileMedical, FaHome } from 'react-icons/fa';
import bg3 from '../../assets/bg3.png';
import HealthTip from './HealthTip'; // Import the HealthTip component


import {
  Button,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  TextareaAutosize,
  CircularProgress,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CardActions,
  InputLabel,
} from '@mui/material';
import { animated } from 'react-spring';

const HomePage = () => {
  const [patientData, setPatientData] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');
  const { patientCNIC } = useParams();
  const navigate = useNavigate();
  const [showHospitals, setShowHospitals] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setLoading(true);
        if (patientCNIC) {
          const response = await axios.get(`http://localhost:3009/patient/home/${patientCNIC}`);
          setPatientData(response.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching patient data:', error);
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [patientCNIC]);


  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');

    if (confirmLogout) {
      navigate('/');
    }
  };

  const handleViewRecords = () => {
    navigate(`/record/getrecords/${patientCNIC}`);
  };

  const handleAddNote = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`http://localhost:3009/patient/${patientCNIC}/addnote`, { patientCNIC, note: newNoteText });
      console.log('Note added successfully:', response.data.message);
      setNewNoteText('');
      setNotes([...notes, newNoteText]);
      setLoading(false);
      setShowAddNoteForm(false); // Close the form after adding a note
    } catch (error) {
      console.error('Error adding note:', error);
      setLoading(false);
    }
  };


  const backgroundStyle = {
    backgroundImage: `url(${bg3})`, // Replace 'path_to_your_image' with the URL of your image
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '100vh',
    minWidth: '100vw',
    // Add this to make sure absolute positioning works correctly
  };


  const formContainerStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    // zIndex: 1000,
    width: '80%', // Adjust width as needed
    maxWidth: '500px',
    minWidth: '150px',// Add max width to prevent the form from becoming too wide on large screens
    marginLeft: '0px', // Add left margin
  };

  return (
    <Container style={backgroundStyle}>
      <animated.nav
        className="navbar navbar-expand-lg navbar-dark bg-dark"
        style={{ minWidth: '100vw', position: 'fixed', top: 0, zIndex: 999, marginLeft: '-24px' }}
      >
        <div className="container">
          <Button onClick={() => setShowSidebar(true)} style={{ marginRight: '10px', fontSize: '24px', color: 'green' }}>
            <FaHome />
          </Button>
          <Link className="navbar-brand">PakMedRecord</Link>
        </div>
      </animated.nav>

      <Drawer anchor="left" open={showSidebar} onClose={() => setShowSidebar(false)}>
        <List>
          <ListItem>


          </ListItem>
          <ListItem button onClick={() => setShowSidebar(false)} style={{ marginTop: '-10px', color: 'green', fontWeight: 'bold'}}>
            <ListItemText>&#10005;</ListItemText>
          </ListItem>
          <Typography variant="h5" style={{ textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'green' }}>
            <ListItemIcon><FaUser /></ListItemIcon> {/* Add the user icon */}
            Welcome, {patientData ? patientData.firstName : 'Patient'}
          </Typography>
          <hr />
          <ListItem button component={Link} to="/doctor/doctors">
            <ListItemIcon>
              <FaUserMd />
            </ListItemIcon>
            <ListItemText>Find Doctors</ListItemText>
          </ListItem>
          <ListItem button component={Link} to={`/affiliation/getmydoctors/${patientCNIC}`}>
            <ListItemIcon>
              <FaFileAlt />
            </ListItemIcon>
            <ListItemText>My Doctors</ListItemText>
          </ListItem>
          <ListItem button component={Link} to={`/patient/${patientCNIC}/getnote`}>
            <ListItemIcon>
              <FaStickyNote />
            </ListItemIcon>
            <ListItemText>My Notes</ListItemText>
          </ListItem>
          <ListItem button onClick={handleViewRecords}>
            <ListItemIcon>
              <FaFileMedical />
            </ListItemIcon>
            <ListItemText>My Medical Records</ListItemText>
          </ListItem>
          <ListItem button onClick={() => setShowAddNoteForm(!showAddNoteForm)}>
            <ListItemIcon>
              {showAddNoteForm ? <FaMinus /> : <FaPlus />}
            </ListItemIcon>
            <ListItemText>Add Note</ListItemText>
          </ListItem>
          <ListItem button onClick={handleLogout}>
            <ListItemIcon>
              <FaSignOutAlt />
            </ListItemIcon>
            <ListItemText>Logout</ListItemText>
          </ListItem>
        </List>
      </Drawer>


      <Container mt-5 style={{ marginTop: '70px' }}>
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <CircularProgress />
          </div>
        ) : (
          <>
            {showAddNoteForm && (
              <div style={formContainerStyle}>
                <InputLabel htmlFor="newNote" style={{ color: 'black' }}>Add Note:</InputLabel>
                <TextareaAutosize
                  id="newNote"
                  className="form-control"
                  rows="3"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  style={{ width: '100%', marginBottom: '10px' }} // Adjust width and margin as needed
                ></TextareaAutosize>
                <CardActions>
                  <Button variant="contained" color="secondary" onClick={handleAddNote} startIcon={<FaPlus />}>Add</Button>
                </CardActions>
              </div>
            )}
            <HealthTip />
          </>
        )}
      </Container>
    </Container>
  );
};

export default HomePage;

