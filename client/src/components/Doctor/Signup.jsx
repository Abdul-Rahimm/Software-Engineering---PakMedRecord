import React, { useState } from 'react';
import axios from 'axios';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import bg2 from '../../assets/bg2.jpg';

const Signup = () => {
    const [formData, setFormData] = useState({
        cnic: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        hospital: '',
    });

    const [signupSuccess, setSignupSuccess] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            await axios.post('http://localhost:3009/doctor/signup', formData);
            console.log('Signup successful!');
            setSignupSuccess(true);
        } catch (error) {
            console.error('Signup error:', error.response.data.error);
            alert('SignUp Unsuccessful :(', error.response.data.error);
        }
    };

    if (signupSuccess) {
        return <Navigate to="/doctor/signin" />;
    }

    return (
        <div
            className="container mt-5"
            style={{
                marginLeft: '75px',
                backgroundImage: `url(${bg2})`,
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
            <h1 className="mb-4" style={{ marginLeft: '60px', color:'white' }}>
                PakMedRecord
            </h1>
            <h2 className="mb-4" style={{ color:'white' }}>Signup</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="cnic">CNIC:</label>
                    <input
                        type="text"
                        className="form-control"
                        id="cnic"
                        name="cnic"
                        value={formData.cnic}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="firstName">FirstName:</label>
                    <input
                        type="text"
                        className="form-control"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="lastName">LastName:</label>
                    <input
                        type="text"
                        className="form-control"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        className="form-control"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        className="form-control"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="hospital">Hospital:</label>
                    <input
                        type="text"
                        className="form-control"
                        id="hospital"
                        name="hospital"
                        value={formData.hospital}
                        onChange={handleChange}
                    />
                </div>
                <button type="submit" className="btn btn-success">
                    Signup
                </button>
            </form>
            <p className="mt-3" >
                Already have an account? <Link to="/doctor/signin" style={{ fontWeight: 'bold', color:'darkblue'}}>Sign In</Link>.
            </p>
        </div>
    );
};

export default Signup;
