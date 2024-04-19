import React, { useState } from 'react';
import axios from 'axios';
import bgImage from '../../assets/bg3.png'; // Import the background image
import { useParams } from 'react-router-dom'; // Import useParams

const AppointmentBooking = () => {
    const { patientCNIC } = useParams(); // Extract patientCNIC using useParams
    const [formData, setFormData] = useState({
        doctorCNIC: '',
        date: '',
        time: ''
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Make a POST request to book the appointment
            const response = await axios.post(`http://localhost:3009/appointments/book/${patientCNIC}`, formData);
            setMessage(response.data.message);
            setError('');
        } catch (error) {
            setMessage('');
            setError(error.response.data.error);
        }
    };

    return (
        <div style={{ ...styles.container, backgroundImage: `url(${bgImage})`, minWidth: '100vw', minHeight: '100vh' }}>
            <h1 style={{ color: 'green', marginLeft: '550px' }}>PakMedRecord</h1>
            <h2 style={styles.heading}>Book an Appointment</h2>
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Doctor CNIC:</label>
                    <input type="text" name="doctorCNIC" value={formData.doctorCNIC} onChange={handleChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Date:</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Time:</label>
                    <input type="time" name="time" value={formData.time} onChange={handleChange} style={styles.input} />
                </div>
                <button type="submit" style={styles.button}>Book Appointment</button>
            </form>
            {message && (
                <div className="alert alert-success" role="alert" style={styles.alert}>
                    {message}
                </div>
            )}
            {error && (
                <div className="alert alert-danger" role="alert" style={styles.alert}>
                    {error}
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        margin: 'auto', // Center horizontally
        maxWidth: '500px', // Limit maximum width
    },
    heading: {
        fontSize: '24px',
        marginBottom: '20px',
        textAlign: 'center',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid green', // Add border style
        padding: '20px', // Add padding for better spacing
    },
    formGroup: {
        marginBottom: '15px',
    },
    label: {
        fontSize: '16px',
        marginBottom: '5px',
        fontWeight: 'bold',
    },
    input: {
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        fontSize: '16px',
    },
    button: {
        backgroundColor: 'green',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        alignSelf: 'center',
        marginLeft: '-500px'
    },
    alert: {
        marginTop: '10px',
        textAlign: 'center',
        maxWidth: '50%',
        marginLeft: '365px'
    },
};


export default AppointmentBooking;
