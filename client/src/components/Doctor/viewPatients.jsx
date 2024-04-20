import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTrash } from 'react-icons/fa'; // Import the trash icon
import bg3 from '../../assets/bg3.png';
import { useParams } from 'react-router-dom'; // Import useParams

const ViewMyPatients = () => {
  const { doctorCNIC } = useParams(); // Extract doctorCNIC from URL params
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyPatients = async () => {
      try {
        const response = await axios.get(`http://localhost:3009/affiliation/getmypatients/${doctorCNIC}`);
        const affiliations = response.data;

        // Extract the CNICs of patients associated with the doctor
        const patientCNICs = affiliations.map((affiliation) => affiliation.patientCNIC);

        // Fetch the details of each patient individually
        const patientsData = await Promise.all(
          patientCNICs.map(async (patientCNIC) => {
            const patientResponse = await axios.get(`http://localhost:3009/patient/home/${patientCNIC}`);
            return patientResponse.data;
          })
        );

        setPatients(patientsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching my patients:', error);
        setLoading(false);
      }
    };

    fetchMyPatients();
  }, [doctorCNIC]);

  return (
    <div style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh', paddingTop: '50px', minWidth: '100vw' }}>
      <h1 style={{ color: 'green', marginLeft: '600px' }}>PakMedRecord</h1>
      <h2 className="mb-4" style={{ marginLeft: '670px' }}>
        My Patients
      </h2>
      <h4 style={{ marginLeft: '500px', border: '1px solid black', maxWidth: '500px' }}> These are the patients you are affiliated with</h4> <br />
      {!loading ? (
        <table className="table table-striped table-bordered" style={{ padding: '150px' }}>
          <thead className="thead-dark">
            <tr>
              <th>CNIC</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>Hospital</th>
              {/* <th>Remove</th> */}
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.patientCNIC}>
                <td>{patient.patientCNIC}</td>
                <td>{patient.firstName}</td>
                <td>{patient.lastName}</td>
                <td>{patient.email}</td>
                <td>{patient.hospital}</td>
                {/* <td>
                  <FaTrash onClick={() => handleRemoveDoctor(patient.doctorCNIC)} style={{ cursor: 'pointer' }} />
                </td> */}
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

export default ViewMyPatients;
