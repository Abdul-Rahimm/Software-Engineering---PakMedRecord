import React, { useState, useEffect } from 'react';
import axios from 'axios';
import bg3 from '../../assets/bg3.png';

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      console.log('Selected Doctors:', selectedDoctors); // Log selectedDoctors array
      const response = await axios.post('http://localhost:3009/affiliation/affiliate', {
        patientCNIC: '100', // Replace with the actual patient CNIC
        doctorCNIC: selectedDoctors,
      });
      console.log(response.data); // Log response from backend
      setShowConfirmation(true); // Show confirmation message
    } catch (error) {
      console.error('Error creating affiliation:', error);
      // Handle error
    }
  };

  const filteredDoctors = doctors.filter(
    (doctor) =>
      doctor.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.lastName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ marginLeft: '500px' }}>
      <h1 style={{ color: 'green', marginLeft: '100px' }}>PakMedRecord</h1>
      <h2 className="mb-4" style={{ marginLeft: '150px' }}>
        List of Doctors
      </h2>
      {showConfirmation && (
        <div className="alert alert-success" role="alert">
          Affiliation confirmed successfully!
        </div>
      )}
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search doctor by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <table className="table table-striped table-bordered">
        <thead className="thead-dark">
          <tr>
            <th scope="col">CNIC</th>
            <th scope="col">First Name</th>
            <th scope="col">Last Name</th>
            <th scope="col">Email</th>
            <th scope="col">Hospital</th>
            <th scope="col">Select</th>
          </tr>
        </thead>
        <tbody>
          {filteredDoctors.map((doctor) => (
            <tr key={doctor.doctorCNIC}>
              <td>{doctor.doctorCNIC}</td>
              <td>{doctor.firstName}</td>
              <td>{doctor.lastName}</td>
              <td>{doctor.email}</td>
              <td>{doctor.hospital}</td>
              <td>
                <input
                  type="checkbox"
                  onChange={() => handleSelectDoctor(doctor.doctorCNIC)}
                  checked={selectedDoctors.includes(doctor.doctorCNIC)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="btn btn-outline-success btn-md mr-2"
        onClick={handleConfirmSelection}
        disabled={selectedDoctors.length === 0} // Disable button if no doctors are selected
      >
        Confirm Selection
      </button>
    </div>
  );
};

export default DoctorList;