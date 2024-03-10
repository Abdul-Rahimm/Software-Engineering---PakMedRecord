import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const Home = () => {
  const [doctorData, setDoctorData] = useState(null);
  const { cnic } = useParams();
  console.log('Doctor CNIC:', cnic);

  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        if (cnic) {
          const response = await axios.get(`http://localhost:3009/doctor/home/${cnic}`);
          console.log('API Response:', response.data);
          setDoctorData(response.data);
        }
      } catch (error) {
        console.error('Error fetching doctor data:', error);
      }
    };

    fetchDoctorData();
  }, [cnic]);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      {doctorData ? (
        <>
          <h2>Welcome, {doctorData.firstName} {doctorData.lastName}!</h2>
          <p>This is your personalized home page.</p>
          {/* Add more content or features based on your requirements */}
        </>
      ) : (
        <p>Loading doctor data...</p>
      )}
    </div>
  );
};

export default Home;
