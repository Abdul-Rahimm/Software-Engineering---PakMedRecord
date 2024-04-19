import React, { useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { FaUserMd, FaFileMedical, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const MedicalRecordForm = () => {
    const { patientCNIC } = useParams();
    const [formData, setFormData] = useState({
        doctorCNIC: '',
        recordData: '',
        status: 'pending'
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post(`http://localhost:3009/tempRecords/submit/${patientCNIC}`, formData);
            setMessage(response.data.message);
            setError('');
            setFormData({
                doctorCNIC: '',
                recordData: '',
                status: 'pending'
            });
        } catch (error) {
            setMessage('');
            setError(error.response.data.error);
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>Submit Medical Record</h2>
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.formGroup}>
                    <label style={styles.label}><FaUserMd style={styles.icon} /> Doctor CNIC:</label>
                    <input type="text" name="doctorCNIC" value={formData.doctorCNIC} onChange={handleChange} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><FaFileMedical style={styles.icon} /> Record Data:</label>
                    <textarea name="recordData" value={formData.recordData} onChange={handleChange} style={styles.textarea} />
                </div>
                <button type="submit" style={styles.button}>Submit</button>
            </form>
            {message && <p style={{ ...styles.message, color: 'green' }}><FaCheckCircle style={styles.icon} /> {message}</p>}
            {error && <p style={{ ...styles.message, color: 'red' }}><FaExclamationCircle style={styles.icon} /> {error}</p>}
        </div>
    );
};

const styles = {
    container: {
        maxWidth: '500px',
        margin: 'auto',
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    },
    heading: {
        textAlign: 'center',
        fontSize: '24px',
        marginBottom: '20px',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
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
    textarea: {
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        fontSize: '16px',
        minHeight: '100px',
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
        marginTop: '10px',
    },
    message: {
        textAlign: 'center',
        marginTop: '10px',
    },
    icon: {
        marginRight: '5px',
    },
};

export default MedicalRecordForm;
