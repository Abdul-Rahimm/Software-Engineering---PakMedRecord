import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import bg3 from '../../assets/bg3.png';
import { Select, Input, Button, message } from 'antd'; // Import Ant Design components
import { FaUserMd, FaFileMedical, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const { Option } = Select;

const MedicalRecordForm = () => {
    const { patientCNIC } = useParams();
    const [formData, setFormData] = useState({
        doctorCNIC: '',
        recordData: '',
        status: 'pending'
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [doctors, setDoctors] = useState([]); // State to store the list of doctors

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                // Fetch the list of doctors from the backend
                const response = await axios.get('http://localhost:3009/doctor/doctors');
                setDoctors(response.data); // Set the list of doctors in state
            } catch (error) {
                console.error('Error fetching doctors:', error);
            }
        };

        fetchDoctors();
    }, []);

    const handleChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
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
                    <label style={styles.label}><FaUserMd style={styles.icon} /> Select Doctor:</label>
                    <Select
                        value={formData.doctorCNIC}
                        onChange={(value) => handleChange('doctorCNIC', value)}
                        style={styles.input}
                        placeholder="Select Doctor"
                    >
                        {doctors.map((doctor) => (
                            <Option key={doctor.doctorCNIC} value={doctor.doctorCNIC}>
                                {doctor.firstName} {doctor.lastName}
                            </Option>
                        ))}
                    </Select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}><FaFileMedical style={styles.icon} /> Record Data:</label>
                    <Input.TextArea
                        value={formData.recordData}
                        onChange={(e) => handleChange('recordData', e.target.value)}
                        style={styles.textarea}
                        placeholder="Enter record data"
                        rows={4}
                    />
                </div>
                <Button type="primary" htmlType="submit" style={styles.button}>Submit</Button>
            </form>
            {message && <p style={{ ...styles.message, color: 'green' }}><FaCheckCircle style={styles.icon} /> {message}</p>}
            {error && <p style={{ ...styles.message, color: 'red' }}><FaExclamationCircle style={styles.icon} /> {error}</p>}
        </div>
    );
};

const styles = {
    container: {
        backgroundImage: `url(${bg3})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minWidth: '100vw',
        minHeight: '100vh',
        margin: 'auto',
        padding: '30px',
        border: '1px solid #e0e0e0',
        borderRadius: '10px',
        backgroundColor: '#f9f9f9',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    },
    heading: {
        textAlign: 'center',
        fontSize: '28px',
        marginBottom: '30px',
        color: '#333',
        textTransform: 'uppercase',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
    },
    formGroup: {
        marginBottom: '20px',
    },
    label: {
        fontSize: '18px',
        marginBottom: '10px',
        fontWeight: 'bold',
        color: '#444',
    },
    input: {
        borderRadius: '6px',
        fontSize: '16px',
        width: '100%',
    },
    textarea: {
        borderRadius: '6px',
        fontSize: '16px',
        width: '100%',
    },
    button: {
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '18px',
        alignSelf: 'flex-end',
        marginTop: '20px',
        width: '150px',
        backgroundColor: 'green'
    },
    message: {
        textAlign: 'center',
        marginTop: '20px',
        fontSize: '18px',
    },
    icon: {
        marginRight: '10px',
        fontSize: '20px',
    },
};

export default MedicalRecordForm;
