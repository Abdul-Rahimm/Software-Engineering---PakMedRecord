import React, { useState } from 'react';
import axios from 'axios';
import { Navigate, Link } from 'react-router-dom';
import bg3 from '../../assets/bg3.png';

const Signup = () => {
    const [formData, setFormData] = useState({
        doctorCNIC: '', // Changed from cnic to doctorCNIC
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        hospital: '',
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

            // Send signup data to the backend endpoint
            await axios.post('http://localhost:3009/doctor/signup', formData);

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
        return <Navigate to="/doctor/signin" />;
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
                <h2 className="mb-4" style={{ color: 'black' }}>Doctor Sign up</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="doctorCNIC">CNIC:</label>
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
                    <button type="submit" className="btn btn-success">
                        {loading ? 'Signing up...' : 'Sign up'}
                    </button>
                </form>
                <p className="mt-3">
                    Already have an account? <Link to="/doctor/signin" style={{ fontWeight: 'bold', color: 'darkblue' }}>Sign In</Link>.
                </p>
            </div>
        </div>
    );
};

export default Signup;
