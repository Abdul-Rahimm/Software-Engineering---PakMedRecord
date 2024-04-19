import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTrash } from 'react-icons/fa'; // Import the trash icon
import bg3 from '../../assets/bg3.png';
import { useParams } from 'react-router-dom'; // Import useParams

const ViewMyDoctors = () => {
  const { patientCNIC } = useParams(); // Extract patientCNIC from URL params
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (patientCNIC) {
      const fetchMyDoctors = async () => {
        try {
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
    }
  }, [patientCNIC]);

  const handleRemoveDoctor = async (doctorCNIC) => {
    try {
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

  return (
    <div style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh', paddingTop: '50px', minWidth: '100vw' }}>
      <h1 style={{ color: 'green', marginLeft: '600px' }}>PakMedRecord</h1>
      <h2 className="mb-4" style={{ marginLeft: '670px' }}>
        My Doctors
      </h2>
      <h4 style={{ marginLeft: '500px', border: '1px solid black', maxWidth: '500px' }}> These are the doctors you are affiliated with</h4> <br />
      {!loading ? (
        <table className="table table-striped table-bordered" style={{ padding: '150px' }}>
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
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
};

export default ViewMyDoctors;
