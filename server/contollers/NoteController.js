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

// Controller function to remove a note for a specific patient CNIC by note ID
const removeNote = expressAsyncHandler(async (req, res) => {
  const { patientCNIC, id } = req.params;

  try {
    // Find the note by ID and patientCNIC and delete it
    const deletedNote = await Note.findOneAndDelete({ _id: id, patientCNIC });

    if (!deletedNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.status(200).json({ message: 'Note removed successfully' });
  } catch (error) {
    console.error('Error removing note:', error);
    res.status(500).json({ error: 'An error occurred while removing the note' });
  }
});


module.exports = { addNote, getNote, removeNote };
