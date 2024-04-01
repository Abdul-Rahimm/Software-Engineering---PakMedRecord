import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { FaStickyNote, FaRegCalendarAlt } from 'react-icons/fa';
import { BsCardText } from 'react-icons/bs';
import bg3 from '../../assets/bg3.png';

const Notes = () => {
  const { patientCNIC } = useParams();
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await axios.get(`http://localhost:3009/patient/${patientCNIC}/getnote`);
        setNotes(response.data.notes);
      } catch (error) {
        console.error('Error fetching notes:', error);
      }
    };

    fetchNotes();
  }, [patientCNIC]);

  const handleCardClick = (index) => {
    setSelectedNote(notes[index]);
    setShowPopup(true);
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    setTimeout(() => {
      setSelectedNote(null);
    }, 500); // Wait for 500ms for the fade-out animation to complete
  };

  return (
    <div style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', minHeight: '100vh', padding: '20px' }}>
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes fadeOut {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }
        `}
      </style>
      <h1 style={{ textAlign: 'center', color: 'green', position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: '999' }}>PakMedRecord</h1>
      <h2 style={{ textAlign: 'center', marginTop: '60px' }}><FaStickyNote /> Notes</h2>
      <div className="card-container" style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', marginTop: '20px' }}>
        {notes.map((note, index) => (
          <div key={index} className="card" style={{ backgroundColor: index % 2 === 0 ? 'grey' : 'green', width: '30%', margin: '10px', padding: '10px', color: 'white', boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.1)', borderRadius: '10px', cursor: 'pointer' }} onClick={() => handleCardClick(index)}>
            <div className="card-body">
              <h5 className="card-title"><BsCardText /> Note {index + 1}</h5>
              <p className="card-text" style={{ color: 'white', fontWeight: 'bold' }}>{note.note}</p>
              <p className="card-text" style={{ color: 'white'}}><FaRegCalendarAlt /> {new Date(note.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
      {showPopup && (
        <div className="popup-overlay" style={{ position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: '9999', display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.5s ease' }}>
          <div className="popup-content" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.3)', animation: 'fadeIn 0.5s ease' }}>
            <h2>Note</h2>
            <p><strong>Note:</strong> {selectedNote.note}</p>
            <p><strong>Created At:</strong> {new Date(selectedNote.createdAt).toLocaleString()}</p>
            <button onClick={handleClosePopup}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notes;
