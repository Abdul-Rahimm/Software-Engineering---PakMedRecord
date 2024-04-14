import React, { useState } from 'react';
import { Card, CardContent, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom

const HealthTip = () => {
  const [tips] = useState([
    "Stay hydrated by drinking plenty of water throughout the day.",
    "Eat a balanced diet rich in fruits, vegetables, lean proteins, and whole grains.",
    "Get regular exercise to maintain a healthy weight and improve overall fitness.",
    "Get enough sleep each night to support physical and mental well-being.",
    "Practice good hygiene by washing your hands regularly and keeping your living space clean.",
    "Manage stress through relaxation techniques such as deep breathing, meditation, or yoga.",
    "Limit consumption of processed foods, sugary drinks, and unhealthy snacks.",
    "Schedule regular check-ups with your healthcare provider for preventive care.",
    "Avoid smoking and limit alcohol consumption to promote better health.",
    "Make time for hobbies and activities you enjoy to reduce stress and improve mood."
  ]);

  const [randomTip, setRandomTip] = useState('');

  const generateRandomTip = () => {
    const randomIndex = Math.floor(Math.random() * tips.length);
    setRandomTip(tips[randomIndex]);
  };

  return (
    <Card variant="outlined" style={{ maxWidth: 400, margin: 'auto', marginTop: 20 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom style={{ fontWeight: 'bold'}}>
          Health Tip
        </Typography>
        <Typography variant="body1" component="p">
          {randomTip}
        </Typography>
      </CardContent>
      <Button onClick={generateRandomTip} variant="outlined" color="success" style={{ margin: 'auto', marginBottom: 10 }}>
        Generate New Tip
      </Button>
      {/* Add the Learn More link */}
      <Typography variant="body2" component="a" href="https://www.healthline.com/nutrition/27-health-and-nutrition-tips" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', margin: 'auto', marginBottom: 10, color: 'green', marginLeft: '150px' }}>
        Learn More
      </Typography>
    </Card>
  );
};

export default HealthTip;
