import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Typography } from 'antd';
import bg3 from '../../assets/bg3.png';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom

const { Text } = Typography;

const ViewMyPatients = () => {
  const { doctorCNIC } = useParams();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyPatients = async () => {
      try {
        const response = await axios.get(`http://localhost:3009/affiliation/getmypatients/${doctorCNIC}`);
        const affiliations = response.data;

        const patientCNICs = affiliations.map((affiliation) => affiliation.patientCNIC);

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

  const columns = [
    {
      title: 'CNIC',
      dataIndex: 'patientCNIC',
      key: 'patientCNIC',
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
      title: 'Action',
      key: 'action',
      render: (text, record) => (
        <Link to={`/records/getrecords/${record.patientCNIC}`}>
          <Text type="primary">View Medical History</Text>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh', paddingTop: '50px', minWidth: '100vw' }}>
      <h1 style={{ color: 'green', marginLeft: '600px' }}>PakMedRecord</h1>
      <h2 className="mb-4" style={{ marginLeft: '670px' }}>
        My Patients
      </h2>
      <h4 style={{ marginLeft: '500px', border: '1px solid black', maxWidth: '500px' }}> These are the patients you are affiliated with</h4> <br />
      {!loading ? (
        <Table columns={columns} dataSource={patients} />
      ) : (
        <Text>Loading...</Text>
      )}
    </div>
  );
};

export default ViewMyPatients;
