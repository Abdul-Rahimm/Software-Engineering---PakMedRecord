import React, { useState } from 'react';
import axios from 'axios';
import { Navigate, Link } from 'react-router-dom';
import bg3 from '../../assets/bg3.png';

const Sign_up = () => {
    const [formData, setFormData] = useState({
        cnic: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        hospital: '',
        gender: '', // Add gender field
    });

    const [signupSuccess, setSignupSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true); // Set loading to true when the form is being submitted

            await axios.post('http://localhost:3009/patient/signup', formData);
            console.log('Signup successful!');
            setSignupSuccess(true);
        } catch (error) {
            console.error('Signup error:', error.response.data.error);
            alert('SignUp Unsuccessful :(', error.response.data.error);
        } finally {
            setLoading(false); // Reset loading regardless of success or failure
        }
    };

    if (signupSuccess) {
        return <Navigate to="/patient/signin" />;
    }

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
            <div
                style={{
                    border: '1px solid #ccc',
                    padding: '20px',
                    borderRadius: '10px',
                    backgroundColor: 'white',
                    boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
                }}
            >
                <h2 className="mb-4" style={{ color: 'black' }}>Patient Sign up</h2>
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
                        <label htmlFor="firstName">First Name:</label>
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
                        <label htmlFor="lastName">Last Name:</label>
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
                    <div className="form-group">
                        <label htmlFor="gender">Gender:</label>
                        <select
                            className="form-control"
                            id="gender"
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                        >
                            <option value="">Select gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-success">
                        {loading ? 'Signing up...' : 'Sign up'}
                    </button>
                </form>
                <p className="mt-3">
                    Already have an account? <Link to="/patient/signin" style={{ fontWeight: 'bold', color: 'darkblue' }}>Sign In</Link>.
                </p>
            </div>
        </div>
    );
};

export default Sign_up;
