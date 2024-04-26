import React, { useState, useEffect } from 'react';
import axios from 'axios';
import bg3 from '../../assets/bg3.png';
import { Input, Table, Button, Alert } from 'antd';

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null); // State variable for error message
  const [patientCNIC, setPatientCNIC] = useState(''); // State variable for patient CNIC

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await axios.get('http://localhost:3009/doctor/doctors');
        setDoctors(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching doctors:', error);
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const handleSelectDoctor = (doctorCNIC) => {
    setSelectedDoctors((prevSelected) => {
      if (prevSelected.includes(doctorCNIC)) {
        // If doctor is already selected, unselect it
        return prevSelected.filter((cnic) => cnic !== doctorCNIC);
      } else {
        // If doctor is not selected, select it
        return [...prevSelected, doctorCNIC];
      }
    });
  };

  const handleConfirmSelection = async () => {
    try {
      console.log('Selected Doctors:', selectedDoctors); 
      const response = await axios.post('http://localhost:3009/affiliation/affiliate', {
        patientCNIC: patientCNIC, // Use patient CNIC entered by the user
        doctorCNIC: selectedDoctors,
      });
      console.log(response.data); 
      setShowConfirmation(true); 
      setError(false); 
      setSelectedDoctors([]); 
    } catch (error) {
      console.error('Error creating affiliation:', error);
      if (error.response && error.response.data && error.response.data.error === 'Affiliation already created') {
        setError('Affiliation already created');
        setSelectedDoctors([]); 
        setShowConfirmation(false); 
      } else {
        setError('Error affiliating doctors. Please try again.');
        setSelectedDoctors([]); 
        setShowConfirmation(false); 
      }
    }
  };

  const filteredDoctors = doctors.filter(
    (doctor) =>
      doctor.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.lastName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      title: 'CNIC',
      dataIndex: 'doctorCNIC',
      key: 'doctorCNIC',
    },
    {
      title: 'First Name',
      dataIndex: 'firstName',
      key: 'firstName',
    },
    {
      title: 'Last Name',
      dataIndex: 'lastName',
      key: 'lastName',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Hospital',
      dataIndex: 'hospital',
      key: 'hospital',
    },
    {
      title: 'Select',
      dataIndex: 'doctorCNIC',
      key: 'select',
      render: (doctorCNIC) => (
        <input
          type="checkbox"
          onChange={() => handleSelectDoctor(doctorCNIC)}
          checked={selectedDoctors.includes(doctorCNIC)}
        />
      ),
    },
  ];

  return (
    <div style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh', paddingTop: '50px', minWidth: '100vw' }}>
      <div className="container">
        <h1 style={{ color: 'green', textAlign: 'center', marginBottom: '30px' }}>PakMedRecord</h1>
        <h2 className="mb-4" style={{ marginLeft: '535px' }}>Get Affiliated</h2>
        <div className="alert alert-info" role="alert">
          <h4 className="alert-heading">Steps to follow for affiliation:</h4>
          <ul>
            <li>Step 1: Search for doctors by name in the table below.</li>
            <li>Step 2: Check the box next to the desired doctor(s) to select them.</li>
            <li>Step 3: Enter your CNIC in the provided input field.</li>
            <li>Step 4: Click the "Confirm Selection" button to affiliate with the selected doctors.</li>
          </ul>
        </div>
        {error && (
          <Alert message={error} type="error" showIcon />
        )}
        {showConfirmation && (
          <Alert message="Affiliation confirmed successfully!" type="success" showIcon />
        )}
        <div className="mb-3" style={{ maxWidth: '280px' }}>
          <Input
            placeholder="Search doctor by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mb-3" style={{ maxWidth: '180px' }}>
          <Input
            placeholder="Enter your CNIC"
            value={patientCNIC}
            onChange={(e) => setPatientCNIC(e.target.value)}
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredDoctors}
          pagination={false}
          rowKey="doctorCNIC"
        />
      <Button
  type="primary"
  className="btn-md mr-2"
  onClick={handleConfirmSelection}
  disabled={selectedDoctors.length === 0 || !patientCNIC}
  style={{ backgroundColor: 'green', borderColor: 'green' }}
>
  Confirm Selection
</Button>

      </div>
    </div>
  );
};

export default DoctorList;
