import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../Header';
import bg3 from '../../assets/bg3.png';

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
    marginLeft: '80px'
  };

  return (
    <div className="container" style={backgroundStyle}>
      <Header/>
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="text-center mt-5" >
            <h2 style={{ color: 'black', marginLeft: '50px' }}>Welcome, {patientData && `${patientData.firstName} ${patientData.lastName}`}!</h2>
            <h2 style={{ color: 'green', marginLeft: '40px' }}>PakMedRecord.</h2>
            <br />
            <Link to="/doctor/doctors">
              <button className="btn btn-success" style={{ marginLeft: '20px', borderRadius: '100px' }}>Find Doctors</button>
            </Link>
            <Link to="/affiliation/getmydoctors/:patientCNIC">
              <button className="btn btn-outline-success btn-md mr-2" style={{ marginLeft: '20px', borderRadius: '100px' }}>My Doctors</button>
            </Link>
            <Link to={`/patient/${patientCNIC}/getnote`}>
  <button className="btn btn-outline-primary btn-md mr-2" style={{ marginLeft: '20px', borderRadius: '100px' }}>View Notes</button>
</Link>

          </div>
        </div>
      </div>

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
            <button className="btn btn-danger" onClick={handleLogout} style={{ marginLeft: '1300px', marginBottom: '-800px' }}>
              Logout
            </button>
          )}
        </div>
      </div>

      <div className="container mt-5">
        {showAddNoteForm && ( // Step 3
          <div className="form-group">
            <label htmlFor="newNote" style={{ color: 'black' }}>Add Note:</label>
            <textarea
              id="newNote"
              className="form-control"
              rows="3"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
            ></textarea>
            <button className="btn btn-primary mt-2" onClick={handleAddNote}>Add</button>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => setShowAddNoteForm(!showAddNoteForm)}>Open Note Form</button> {/* Step 2 */}
      </div>
    </div>
  );
};

export default HomePage;
