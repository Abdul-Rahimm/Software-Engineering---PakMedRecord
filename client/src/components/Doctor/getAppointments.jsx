import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Input } from 'antd'; // Import Table and Input from Ant Design
import { useParams } from 'react-router-dom';
import bg3 from '../../assets/bg3.png';

const { Search } = Input; // Destructure Search component from Input

const DoctorAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [error, setError] = useState('');
    const { doctorCNIC } = useParams();
    const [filteredAppointments, setFilteredAppointments] = useState([]);
    const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await axios.get(`http://localhost:3009/appointments/fetch/${doctorCNIC}`);
                const updatedAppointments = response.data.appointments.map(appointment => ({
                    ...appointment,
                    status: localStorage.getItem(appointment._id) || 'Pending'
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

    useEffect(() => {
        const filtered = appointments.filter(appointment => String(appointment.patientCNIC).includes(searchInput));
        setFilteredAppointments(filtered);
    }, [searchInput, appointments]);

    const handleSearchInputChange = (value) => {
        setSearchInput(value);
    };

    const columns = [
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
        },
        {
            title: 'Time',
            dataIndex: 'time',
            key: 'time',
        },
        {
            title: 'Patient CNIC',
            dataIndex: 'patientCNIC',
            key: 'patientCNIC',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (text, record) => (
                <span style={{ color: text === 'Completed' ? 'green' : 'red' }}>{text}</span>
            ),
        },
        {
            title: 'Action',
            key: 'action',
            render: (text, record) => (
                record.status === 'Pending' && (
                    <button style={styles.completeButton} onClick={() => markCompleted(record._id)}>Mark as Completed</button>
                )
            ),
        },
    ];

    return (
        <div style={styles.container}>
            <h1 style={styles.heading}>PakMedRecord</h1>
            <h2 style={styles.subHeading}>Doctor Appointments</h2>
            <div style={styles.searchContainer}>
                <Search
                    value={searchInput}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    placeholder="Search by Patient CNIC"
                    style={styles.searchInput}
                />
            </div>
            {error && <p style={styles.errorMessage}>{error}</p>}
            <Table columns={columns} dataSource={filteredAppointments} />
        </div>
    );
};

const styles = {
    container: {
        padding: '100px',
        borderRadius: '8px',
        backgroundColor: '#f2f2f2',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        backgroundImage: `url(${bg3})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minWidth: '100vw',
        minHeight: '100vh'
    },
    heading: {
        color: 'green',
        marginBottom: '20px',
        textAlign: 'center',
        fontSize: '48px',
        fontWeight: 'bold',
        marginLeft: '-35px'
    },
    errorMessage: {
        color: 'red',
        textAlign: 'center',
        marginTop: '20px',
    },
    searchContainer: {
        textAlign: 'center',
        marginBottom: '20px',
    },
    searchInput: {
        width: '50%',
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
    'completeButton:hover': {
        backgroundColor: '#218838',
    },
};

export default DoctorAppointments;
