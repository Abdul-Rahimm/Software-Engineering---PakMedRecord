import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Signin = () => {
    const [formData, setFormData] = useState({
        cnic: '',
        password: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleSuccessfulSignin = () => {
        alert('SignIn Successful -> Welcome to PakMedrecord!');
        // You can also use a modal library (e.g., react-bootstrap-modal) for a more polished UI
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Assuming the backend sends back the username upon successful signin
            const response = await axios.post('http://localhost:3009/doctor/signin', formData);
            console.log('Signin successful!');
            handleSuccessfulSignin(response.data.username);
        } catch (error) {
            console.error('Signin error:', error.response.data.error);
            alert('SignIn Unsuccessful:(', error.response.data.error);
        }
    };

    return (
        <div className="container mt-5" style={{ marginLeft: '350px' }}>
            <h1 className="mb-4" style={{ marginLeft: '220px' }}>PakMedRecord</h1>
            <h2 className="mb-4" >Signin</h2>
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
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        className="form-control"
                        id="username"
                        name="username"
                        value={formData.username}
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
                <button type="submit" className="btn btn-primary">
                    Signin
                </button>
            </form>
            <p className="mt-3">
                Don't have an account? <Link to="/doctor/signup">Create Account</Link>.
            </p>
        </div>
    );
};

export default Signin;
