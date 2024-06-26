import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FaUser, FaUserMd, FaFileAlt, FaStickyNote, FaSignOutAlt, FaPlus, FaMinus, FaFileMedical, FaBars, FaUserEdit, FaCalendarPlus, FaQuestionCircle } from 'react-icons/fa'; // Import FaUserEdit icon for update patient
import {Modal} from 'antd';
import bg3 from '../../assets/bg3.png';
import HealthTip from './HealthTip';
import HowToUse from './HowToUse';
// import Notify from './Notification';
import logo from '../../assets/logo2.svg'; // Import the logo
import UserProfileIcon from '../../assets/user.svg'; // Import the SVG icon


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
  const [showHowToUse, setShowHowToUse] = useState(false); // State for the visibility of "How to Use" popup


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
      setShowAddNoteForm(false);
    } catch (error) {
      console.error('Error adding note:', error);
      setLoading(false);
    }
  };

  const closeAddNoteForm = () => {
    setShowAddNoteForm(false);
  };
  const toggleHowToUse = () => {
    setShowHowToUse(!showHowToUse);
  };

  const backgroundStyle = {
    backgroundImage: `url(${bg3})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: '100vh',
    minWidth: '100vw',
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
    width: '80%',
    maxWidth: '500px',
    minWidth: '150px',
    marginLeft: '350px',
    marginTop: '-25px'
  };

  return (
    <Container style={backgroundStyle}>
      <animated.nav
        className="navbar navbar-expand-lg navbar-dark bg-dark"
        style={{ minWidth: '100vw', position: 'fixed', top: 0, zIndex: 999, marginLeft: '-24px' }}
      >
        <div className="container d-flex justify-content-between align-items-center">
          <Button onClick={() => setShowSidebar(true)} style={{ marginRight: '10px', fontSize: '24px', color: 'green' }}>
            <FaBars style={{ color: '#3cb371' }} />
          </Button>
          <Typography variant="h6" component="div" style={{ color: 'white', fontWeight: 'bolder' }}>PakMedRecord</Typography>
        </div>
      </animated.nav>

      <Drawer anchor="left" open={showSidebar} onClose={() => setShowSidebar(false)} >
        <List>
          <ListItem button onClick={() => setShowSidebar(false)} style={{ marginTop: '-10px', color: 'green', fontWeight: 'bold' }}>
            <ListItemText style={{ marginTop: '0px' }}>&#10005;</ListItemText>
          </ListItem>
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '15px' }}>
            <img src={logo} alt="PakMedRecord Logo" style={{ width: '50px', marginRight: '10px' }} /> {/* Logo */}
            <Typography variant="h4" component="div" sx={{ color: '#3cb371', fontWeight: 'bolder' }}>PakMedRecord</Typography> {/* Header */}
          </div>
          {/* Added PakMedRecord name */} <br />
          <Typography variant="h5" style={{ textAlign: 'center', marginRight: '20px', fontWeight: 'bold', color: '#3cb371' }}>
          <img src={UserProfileIcon} alt="User Profile" style={{ width: '36px', height: '36px', marginLeft: '-15px' }} />
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
           {/* Add this ListItem for appointment booking */}
           <ListItem button component={Link} to={`/appointments/book/${patientCNIC}`}>
            <ListItemIcon>
              <FaCalendarPlus />
            </ListItemIcon>
            <ListItemText>Book Appointment</ListItemText>
          </ListItem>
          <ListItem button component={Link} to={`/tempRecords/submit/${patientCNIC}`}>
            <ListItemIcon>
              <FaCalendarPlus />
            </ListItemIcon>
            <ListItemText>Upload Medical Record</ListItemText>
          </ListItem>
          <ListItem button component={Link} to={`/patient/update/${patientCNIC}`}>
            <ListItemIcon>
              <FaUserEdit />
            </ListItemIcon>
            <ListItemText>Profile Settings</ListItemText>
          </ListItem>
         
          <ListItem button onClick={handleLogout}>
            <ListItemIcon>
            </ListItemIcon>
            <ListItemText style={{ marginBottom: '-275px' }}>
              <Button variant="contained" style={{ backgroundColor: 'green', color: 'white', marginLeft: '120px' }}>
                <FaSignOutAlt style={{ marginRight: '10px' }} />
                Logout
              </Button>
            </ListItemText>
          </ListItem> <hr />
          <ListItem button onClick={toggleHowToUse}>
            <ListItemIcon>
              <FaQuestionCircle />
            </ListItemIcon>
            <ListItemText>How to Use</ListItemText>
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
                  style={{ width: '100%', marginBottom: '10px' }}
                ></TextareaAutosize>
                <CardActions>
                  <Button variant="contained" color="success" onClick={handleAddNote} startIcon={<FaPlus />}>Add</Button>
                  <Button variant="contained" color="success" onClick={closeAddNoteForm} startIcon={<FaMinus />}>Close Form</Button>

                </CardActions>
              </div>
            )}
            <HealthTip />
            <Modal
        visible={showHowToUse}
        onCancel={toggleHowToUse}
        footer={[
          
        ]}
      >
        <HowToUse />
      </Modal>          </>
        )}
      </Container>
    </Container>
  );
};

export default HomePage;
