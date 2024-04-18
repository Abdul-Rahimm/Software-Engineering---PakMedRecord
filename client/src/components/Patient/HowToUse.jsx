import React, { useState } from 'react';
import { Typography, Button, Paper } from '@mui/material';
import { FaQuestionCircle } from 'react-icons/fa'; // Import icon for the toggle button

const HowToUse = () => {
  const [showInstructions, setShowInstructions] = useState(false);

  const toggleInstructions = () => {
    setShowInstructions(!showInstructions);
  };

  return (
    <Paper style={{ maxWidth: '400px', padding: '20px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', margin: '25px', marginLeft: '-100px', marginTop: '-110px' }}>
      <Button onClick={toggleInstructions} variant="contained" color="success" style={{ marginBottom: '0px', marginLeft: '80px' }}>
        <FaQuestionCircle style={{ marginRight: '10px' }} /> {/* Add icon to the toggle button */}
        <Typography variant="h6">How to Use</Typography>
      </Button>
      {showInstructions && (
        <div>
          <Typography variant="body1" style={{ marginBottom: '20px', fontSize: '16px' }}>
            <strong>1. Find Doctors:</strong> Click on the "Find Doctors" button to search for doctors in your area.
          </Typography>
          <Typography variant="body1" style={{ marginBottom: '20px', fontSize: '16px' }}>
            <strong>2. My Doctors:</strong> View the list of doctors you are affiliated with by clicking on "My Doctors".
          </Typography>
          <Typography variant="body1" style={{ marginBottom: '20px', fontSize: '16px' }}>
            <strong>3. My Notes:</strong> Access your saved notes by clicking on "My Notes".
          </Typography>
          <Typography variant="body1" style={{ marginBottom: '20px', fontSize: '16px' }}>
            <strong>4. My Medical Records:</strong> View your medical records by clicking on "My Medical Records".
          </Typography>
        </div>
      )}
    </Paper>
  );
};

export default HowToUse;
