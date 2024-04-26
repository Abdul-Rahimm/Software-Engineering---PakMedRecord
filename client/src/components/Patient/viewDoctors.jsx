import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Button, Space, Typography } from 'antd';
import { FaTrash } from 'react-icons/fa';
import bg3 from '../../assets/bg3.png';
import { useParams } from 'react-router-dom';

const { Text } = Typography;

const ViewMyDoctors = () => {
  const { patientCNIC } = useParams();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (patientCNIC) {
      const fetchMyDoctors = async () => {
        try {
          const response = await axios.get(`http://localhost:3009/affiliation/getmydoctors/${patientCNIC}`);
          const affiliations = response.data;

          const doctorCNICs = affiliations.map((affiliation) => affiliation.doctorCNIC);

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
      const confirmed = window.confirm('Are you sure you want to remove this doctor?');

      if (confirmed) {
        await axios.delete(`http://localhost:3009/affiliation/remove/${patientCNIC}/${doctorCNIC}`);

        const updatedDoctors = doctors.filter((doctor) => doctor.doctorCNIC !== doctorCNIC);
        setDoctors(updatedDoctors);
      }
    } catch (error) {
      console.error('Error removing doctor:', error);
    }
  };

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
      title: 'Remove',
      key: 'remove',
      render: (_, record) => (
        <Space size="middle">
          <Button type="danger" onClick={() => handleRemoveDoctor(record.doctorCNIC)}>
            <FaTrash />
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh', paddingTop: '50px', minWidth: '100vw' }}>
      <h1 style={{ color: 'green', marginLeft: '600px' }}>PakMedRecord</h1>
      <h2 className="mb-4" style={{ marginLeft: '670px' }}>
        My Doctors
      </h2>
      <h4 style={{ marginLeft: '500px', border: '1px solid black', maxWidth: '500px' }}> These are the doctors you are affiliated with</h4> <br />
      {!loading ? (
        <Table columns={columns} dataSource={doctors} />
      ) : (
        <Text>Loading...</Text>
      )}
    </div>
  );
};

export default ViewMyDoctors;
