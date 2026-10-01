import React, { useState } from 'react';
import api from '../../api';
import { saveSession } from '../../session';
import { Link, useNavigate } from 'react-router-dom';
import bg3 from '../../assets/bg3.png';

const Signin = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        doctorCNIC: '',
        password: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleSuccessfulSignin = (doctorCNIC) => {
        navigate(`/doctor/home/${doctorCNIC}`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await api.post('/doctor/signin', formData);

            const { doctor, token } = response.data;
            saveSession({ token, role: 'doctor', cnic: doctor.doctorCNIC });

            handleSuccessfulSignin(doctor.doctorCNIC);
        } catch (error) {
            console.error('Signin error:', error);
            alert(`SignIn Unsuccessful :( ${error.response?.data?.error || 'Could not reach the server'}`);
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
                Doctor Sign in
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
                    <label htmlFor="doctorCNIC" style={{ color: 'black' }}>
                        CNIC:
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        id="doctorCNIC"
                        name="doctorCNIC"
                        value={formData.doctorCNIC}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password" style={{ color: 'black' }}>
                        Password:
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
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'darkblue', marginTop: '15px' }}>
                    Sign in
                </button>
            </form>
            <p className="mt-3">
                Don't have an account?{' '}
                <Link to="/doctor/signup" style={{ color: 'darkgreen', fontWeight: 'bold' }}>
                    Create Account
                </Link>
            </p>
        </div>
    );
};

export default Signin;
