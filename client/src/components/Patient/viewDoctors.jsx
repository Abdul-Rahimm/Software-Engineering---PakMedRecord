import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './viewDoctors.css'; // Import the CSS file
import { FaTrash } from 'react-icons/fa'; // Import the trash icon

const ViewMyDoctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyDoctors = async () => {
      try {
        const patientCNIC = '9'; // Replace with the actual patient's CNIC

        const response = await axios.get(`http://localhost:3009/affiliation/getmydoctors/${patientCNIC}`);
        const affiliations = response.data;

        // Extract the CNICs of doctors associated with the patient
        const doctorCNICs = affiliations.map((affiliation) => affiliation.doctorCNIC);

        // Fetch the details of each doctor individually
        const doctorsData = await Promise.all(
          doctorCNICs.map(async (doctorCNIC) => {
            const doctorResponse = await axios.get(`http://localhost:3009/doctor/home/${doctorCNIC}`);
            return doctorResponse.data;
          })
        );

        setDoctors(doctorsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching my doctors:', error);
        setLoading(false);
      }
    };

    fetchMyDoctors();
  }, []);

  const handleRemoveDoctor = async (doctorCNIC) => {
    try {
      const patientCNIC = 9; // Replace with the actual patient's CNIC
  
      // Ask for confirmation before removing the doctor
      const confirmed = window.confirm('Are you sure you want to remove this doctor?');

      if (confirmed) {
        // Send a delete request to remove the doctor from the patient's list
        await axios.delete(`http://localhost:3009/affiliation/remove/${patientCNIC}/${doctorCNIC}`);
  
        // Update the list of doctors after removal
        const updatedDoctors = doctors.filter((doctor) => doctor.doctorCNIC !== doctorCNIC);
        setDoctors(updatedDoctors);
      }
    } catch (error) {
      console.error('Error removing doctor:', error);
      // Handle error
    }
  };
  

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ marginLeft: '500px'}}>
        <h1 style={{ color: 'green', marginLeft: '80px' }}>PakMedRecord</h1>
      <h2 className="mb-4" style={{ marginLeft: '150px' }}>
        My Doctors
      </h2>
      <table className="table table-striped table-bordered">
        <thead className="thead-dark">
          <tr>
            <th>CNIC</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Email</th>
            <th>Hospital</th>
            <th>Remove</th> {/* Add Remove column */}
          </tr>
        </thead>
        <tbody>
          {doctors.map((doctor) => (
            <tr key={doctor.doctorCNIC}>
              <td>{doctor.doctorCNIC}</td>
              <td>{doctor.firstName}</td>
              <td>{doctor.lastName}</td>
              <td>{doctor.email}</td>
              <td>{doctor.hospital}</td>
              <td>
                <button onClick={() => handleRemoveDoctor(doctor.doctorCNIC)}>
                  <FaTrash style={{ color: 'red' }}/> {/* Add remove icon */}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ViewMyDoctors;
