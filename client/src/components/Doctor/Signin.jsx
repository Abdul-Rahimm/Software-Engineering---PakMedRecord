import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import bg from '../../assets/bg2.jpg';

const Signin = () => {
    const [formData, setFormData] = useState({
        cnic: '',
        password: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleSuccessfulSignin = (firstName) => {
        alert(`Signin successful! Welcome to PakMedRecord!`);
        // You can also use a modal library (e.g., react-bootstrap-modal) for a more polished UI
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Assuming the backend sends back the username and firstname upon successful signin
            const response = await axios.post('http://localhost:3009/doctor/signin', formData);
            console.log('Signin response:', response); // Log the entire response object

            const { firstName } = response.data;
            console.log('Signin successful! Welcome to PakMedRecord!');

            handleSuccessfulSignin(firstName);
        } catch (error) {
            console.error('Signin error:', error.response.data.error);
            alert('SignIn Unsuccessful:(', error.response.data.error);
        }
    };

    return (
        <div
            className="container mt-5"
            style={{
                marginLeft: '75px',
                backgroundImage: `url(${bg})`, // Replace with the actual path to your image
                backgroundSize: 'cover', // Adjust as needed
                backgroundPosition: 'center', // Adjust as needed
                height: '100vh', // Make the container full height of the viewport
                width: '100vw', // Make the container full width of the viewport
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <h1 className="mb-4" style={{ marginLeft: '60px', color: 'white' }}>
                PakMedRecord
            </h1>
            <h2 className="mb-4" style={{ color: 'white' }}>
                Signin
            </h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="cnic" style={{ color: 'white' }}>
                        CNIC:
                    </label>
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
                    <label htmlFor="password" style={{ color: 'white' }}>
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
                <button type="submit" className="btn btn-primary">
                    Signin
                </button>
            </form>
            <p className="mt-3">
                Don't have an account?{' '}
                <Link to="/doctor/signup" style={{ color: 'darkgreen', fontWeight: 'bold' }}>
                    Create Account
                </Link>
                .
            </p>
        </div>
    );
};

export default Signin;
