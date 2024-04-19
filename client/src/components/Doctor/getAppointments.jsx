import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import bg3 from '../../assets/bg3.png';

const DoctorAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [error, setError] = useState('');
    const { doctorCNIC } = useParams();

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await axios.get(`http://localhost:3009/appointments/fetch/${doctorCNIC}`);
                const updatedAppointments = response.data.appointments.map(appointment => ({
                    ...appointment,
                    status: localStorage.getItem(appointment._id) || 'Pending' // Retrieve status from local storage
                }));
                const sortedAppointments = sortAppointments(updatedAppointments);
                setAppointments(sortedAppointments);
                setError('');
            } catch (error) {
                console.error('Error fetching appointments:', error);
                setError('Failed to fetch appointments. Please try again later.');
                setAppointments([]);
            }
        };

        fetchAppointments();
    }, [doctorCNIC]);

    const sortAppointments = (appointments) => {
        const pendingAppointments = appointments.filter(appointment => appointment.status === 'Pending');
        const completedAppointments = appointments.filter(appointment => appointment.status === 'Completed');
        return [...pendingAppointments, ...completedAppointments];
    };

    const markCompleted = async (appointmentId) => {
        try {
            await axios.patch(`http://localhost:3009/appointments/update/${appointmentId}`, { status: 'Completed' });
            setAppointments(prevAppointments =>
                prevAppointments.map(appointment => {
                    if (appointment._id === appointmentId) {
                        // Save status to local storage
                        localStorage.setItem(appointment._id, 'Completed');
                        return { ...appointment, status: 'Completed' };
                    }
                    return appointment;
                })
            );
        } catch (error) {
            console.error('Error marking appointment as completed:', error);
            setError('Failed to mark appointment as completed. Please try again later.');
        }
    };

    return (
        <div style={styles.container}>
            <h1 style={{ color: 'green', marginLeft: '460px' }}>PakMedRecord</h1>
            <h2 style={styles.heading}>Doctor Appointments</h2>
            {error && <p style={styles.errorMessage}>{error}</p>}
            <table style={styles.table}>
                <thead>
                    <tr style={styles.tableHeader}>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Patient CNIC</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {appointments.map(appointment => (
                        <tr key={appointment._id} style={appointment.status === 'Completed' ? styles.completedRow : null}>
                            <td>{appointment.date}</td>
                            <td>{appointment.time}</td>
                            <td>{appointment.patientCNIC}</td>
                            <td style={{ ...styles.statusColumn, color: appointment.status === 'Completed' ? 'green' : 'red' }}>{appointment.status}</td>
                            <td style={styles.actionColumn}>
                                {appointment.status === 'Pending' && (
                                    <button style={styles.completeButton} onClick={() => markCompleted(appointment._id)}>Mark as Completed</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const styles = {
    container: {
        padding: '100px',
        borderRadius: '8px',
        backgroundColor: '#f2f2f2',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        backgroundImage: `url(${bg3})`, // Add your image path here
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minWidth: '100vw',
        minHeight: '100vh'
    },
    heading: {
        color: '#333',
        marginBottom: '20px',
        textAlign: 'center',
        fontSize: '24px',
        fontWeight: 'bold',
        marginLeft: '-35px'
    },
    errorMessage: {
        color: 'red',
        textAlign: 'center',
        marginTop: '20px',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        border: '2px solid black', // Add border style
        padding: '30px',

    },
    tableHeader: {
        backgroundColor: '#007bff',
        color: 'white',
        fontWeight: 'bold',
        padding: '12px 0',
    },
    completedRow: {
        backgroundColor: '#e6ffe6',
    },
    statusColumn: {
        textTransform: 'capitalize',
    },
    actionColumn: {
        textAlign: 'center',
    },
    completeButton: {
        padding: '8px 16px',
        backgroundColor: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        outline: 'none',
        fontWeight: 'bold',
        transition: 'background-color 0.3s',
    },
    'completeButton:hover': { // Enclose property name in quotes
        backgroundColor: '#218838',
    },
};

export default DoctorAppointments;
