import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Card, Typography, Modal } from 'antd';
import { CalendarOutlined, FileOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const Reminders = () => {
  const { doctorCNIC } = useParams();
  const [appointments, setAppointments] = useState([]);
  const [pendingRecords, setPendingRecords] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await axios.get(`http://localhost:3009/appointments/fetch/${doctorCNIC}`);
        setAppointments(response.data.appointments.filter(appointment => appointment.status === 'pending'));
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

  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
    setModalVisible(true);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', marginTop: '-250px' }}>
      <div>
        <Title level={2}>Reminders for Doctor with CNIC: {doctorCNIC}</Title>
        <div>
          <Card style={{ marginBottom: '20px' }}>
            {appointments.length === 0 && pendingRecords.length === 0 ? (
              <div style={{ textAlign: 'center', fontSize: '24px', color: '#1890ff' }}>
                <span role="img" aria-label="celebration emoji">🎉</span> Yayy! No reminders. <span role="img" aria-label="celebration emoji">🎉</span>
              </div>
            ) : (
              <>
                {appointments.map((appointment, index) => (
                  <Card 
                    key={index} 
                    hoverable
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
                {pendingRecords.map((record, index) => (
                  <Card 
                    key={index} 
                    hoverable
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
              </>
            )}
          </Card>
        </div>
      </div>
      <Modal
        title="Appointment Details"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        {selectedAppointment && (
          <div>
            <p>Patient CNIC: {selectedAppointment.patientCNIC}</p>
            <p>Date: {selectedAppointment.date}</p>
            <p>Time: {selectedAppointment.time}</p>
            <p>Status: {selectedAppointment.status}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Reminders;
