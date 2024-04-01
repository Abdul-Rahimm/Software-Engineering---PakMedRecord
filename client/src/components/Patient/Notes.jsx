import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { FaStickyNote, FaRegCalendarAlt, FaTimesCircle } from 'react-icons/fa';
import { BsCardText } from 'react-icons/bs';
import { Box, Heading, Text, Button } from '@chakra-ui/react'; // Import Chakra UI components
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

  const handleRemoveNote = async (noteId) => {
    try {
      await axios.delete(`http://localhost:3009/patient/${patientCNIC}/removenote/${noteId}`);
      setNotes(notes.filter((note) => note._id !== noteId));
    } catch (error) {
      console.error('Error removing note:', error);
    }
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    setTimeout(() => {
      setSelectedNote(null);
    }, 500); // Wait for 500ms for the fade-out animation to complete
  };

  return (
    <Box backgroundImage={`url(${bg3})`} backgroundSize='cover' backgroundPosition='center' minHeight='100vh' padding='20px' position='relative' minWidth='100vw'>
      <Heading variant='h1' textAlign='center' color='green' position='absolute' top='20px' left='50%' transform='translateX(-50%)' zIndex='999' width='100%'>PakMedRecord</Heading>
      <br />
      <Heading variant='h2' textAlign='center' marginTop='60px'><FaStickyNote /> My Notes</Heading>
      <br />
      <Box display='flex' justifyContent='space-around' flexWrap='wrap' marginTop='20px'>
        {notes.map((note, index) => (
          <Box key={index} backgroundColor={index % 2 === 0 ? 'grey' : 'green'} width='30%' margin='10px' padding='10px' color='white' boxShadow='0px 0px 10px rgba(0, 0, 0, 0.1)' borderRadius='10px' cursor='pointer' onClick={() => handleCardClick(index)}>
            <Box as='div'>
              <Heading variant='h5'><BsCardText /> Note {index + 1}</Heading>
              <Text variant='body1' color='white' fontWeight='bold'>{note.note}</Text>
              <Text variant='body1' color='white'><FaRegCalendarAlt /> {new Date(note.createdAt).toLocaleString()}</Text>
              <FaTimesCircle style={{ color: 'red', cursor: 'pointer' }} onClick={() => handleRemoveNote(note._id)} />
            </Box>
          </Box>
        ))}
      </Box>
      {showPopup && (
        <Box position='fixed' top='0' left='0' width='100%' height='100%' backgroundColor='rgba(0, 0, 0, 0.8)' zIndex='9999' display='flex' justifyContent='center' alignItems='center' animation='fadeIn 0.5s ease'>
          <Box backgroundColor='white' padding='20px' borderRadius='10px' boxShadow='0px 0px 10px rgba(0, 0, 0, 0.3)' animation='fadeIn 0.5s ease'>
            <Heading variant='h2'>Note</Heading>
            <Text variant='body1'><strong>Note:</strong> {selectedNote.note}</Text>
            <Text variant='body1'><strong>Created At:</strong> {new Date(selectedNote.createdAt).toLocaleString()}</Text>
            <Button onClick={handleClosePopup}>Close</Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Notes;
