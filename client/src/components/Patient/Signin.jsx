import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaLock } from 'react-icons/fa'; // React icons
import { Button } from '@mui/material'; // Material-UI Button
import bg3 from '../../assets/bg3.png';

const Sign_in = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        patientCNIC: '',
        password: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleSuccessfulSignin = (patientCNIC) => {
        navigate(`/patient/home/${patientCNIC}`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post('http://localhost:3009/patient/signin', formData);

            console.log('API Response:', response.data);

            const { patient } = response.data;
            const { patientCNIC } = patient; // Assuming 'cnic' is the identifier

            console.log('Extracted CNIC:', patientCNIC);

            handleSuccessfulSignin(patientCNIC);
        } catch (error) {
            console.error('Signin error:', error.response.data.error);
            // Display an alert for incorrect sign-in credentials
            alert('Sign in failed!');
        }
    };

    return (
        <div
            className="container mt-5"
            style={{
                marginLeft: '75px',
                backgroundImage: `url(${bg3})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                height: '100vh',
                width: '100vw',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <h1 className="mb-4" style={{ marginLeft: '0px', color: 'green' }}>
                PakMedRecord.
            </h1>
            <h2 className="mb-4" style={{ color: 'black' }}>
                Patient Sign in
            </h2>
            <form
                onSubmit={handleSubmit}
                style={{
                    border: '1px solid #ccc',
                    padding: '20px',
                    borderRadius: '10px',
                    backgroundColor: 'white',
                    boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
                }}
            >
                <div className="form-group">
                    <label htmlFor="patientCNIC" style={{ color: 'black' }}>
                        <FaUser /> CNIC:
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        id="patientCNIC"
                        name="patientCNIC"
                        value={formData.patientCNIC}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password" style={{ color: 'black' }}>
                        <FaLock /> Password:
                    </label>
                    <input
                        type="password"
                        className="form-control"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                    />
                </div>
                <Button type="submit" variant="contained" style={{ marginTop: '15px' }}>
                    Sign in
                </Button>
            </form>
            <p className="mt-3">
                Don't have an account?{' '}
                <Link to="/patient/signup" style={{ color: 'darkgreen', fontWeight: 'bold' }}>
                    Create Account
                </Link>
            </p>
        </div>
    );
};

export default Sign_in;
