import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Card, Typography } from 'antd';
import { CalendarOutlined, FileOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const MyComponent = () => {
  const { doctorCNIC } = useParams();
  const [appointments, setAppointments] = useState([]);
  const [pendingRecords, setPendingRecords] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await axios.get(`http://localhost:3009/appointments/fetch/${doctorCNIC}`);
        setAppointments(response.data.appointments.filter(appointment => appointment.status === 'pending')); // Filter pending appointments
      } catch (error) {
        console.error('Error fetching appointments:', error);
      }
    };

    const fetchPendingRecords = async () => {
      try {
        const response = await axios.get(`http://localhost:3009/tempRecords/pending/${doctorCNIC}`);
        setPendingRecords(response.data.pendingRecords);
      } catch (error) {
        console.error('Error fetching pending records:', error);
      }
    };

    fetchAppointments();
    fetchPendingRecords();
  }, [doctorCNIC]);

  // Handle click on appointment
  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', marginTop: '-170px' }}>
      <div>
        <Title level={2}>Reminders for Doctor {doctorCNIC}</Title>
        <div>
          {appointments.map((appointment, index) => (
            <Card 
              key={index} 
              style={{ marginBottom: '20px', cursor: 'pointer' }} 
              onClick={() => handleAppointmentClick(appointment)}
              actions={[
                <CalendarOutlined key="calendar" />,
              ]}
            >
              <Text strong>Patient with CNIC {appointment.patientCNIC}</Text>
              <br />
              <Text>Booked an appointment. Please check it out.</Text>
            </Card>
          ))}
        </div>
        <div>
          {pendingRecords.map((record, index) => (
            <Card 
              key={index} 
              style={{ marginBottom: '20px' }}
              actions={[
                <FileOutlined key="file" />,
              ]}
            >
              <Text strong>Patient with CNIC {record.patientCNIC}</Text>
              <br />
              <Text>Sent a medical record for approval.</Text>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyComponent;
