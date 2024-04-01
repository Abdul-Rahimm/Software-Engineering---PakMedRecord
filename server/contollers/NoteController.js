const Patient = require('../models/PatientModel');
const Note = require('../models/NotesModel');
const expressAsyncHandler = require('express-async-handler');

// Controller function to add a note for a specific patient CNIC
const addNote = async (req, res) => {
  const { patientCNIC } = req.params;
  const { note } = req.body;

  try {
    // Create a new note instance
    const newNote = new Note({
      patientCNIC,
      note
    });

    // Save the note to the database
    await newNote.save();

    res.status(201).json({ message: 'Note added successfully' });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'An error occurred while adding the note' });
  }
};


// Backend route handler for fetching notes
const getNote = async (req, res) => {
    const { patientCNIC } = req.params;
  
    try {
      // Fetch notes associated with the provided patientCNIC
      const notes = await Note.find({ patientCNIC });
  
      // Send the fetched notes as a response
      res.status(200).json({ notes });
    } catch (error) {
      console.error('Error fetching notes:', error);
      res.status(500).json({ error: 'An error occurred while fetching notes' });
    }
  };
  
  

  module.exports = {addNote, getNote};