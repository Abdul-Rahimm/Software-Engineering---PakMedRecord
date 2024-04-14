import React, { useState } from 'react';
import axios from 'axios';
import bg3 from '../../assets/bg3.png';


const UpdatePatient = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    email: '',
    newCNIC: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.put(`http://localhost:3009/patient/update/${formData.newCNIC}`, formData);
      setMessage(response.data.message);
      setError('');
      setShowSuccessMessage(true); // Show the success message
      // Reset form data after successful update
      setFormData({
        firstName: '',
        lastName: '',
        password: '',
        email: '',
        newCNIC: ''
      });
    } catch (error) {
      setMessage('');
      setError(error.response.data.error);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Profile Settings</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formBorder}>
          <div style={styles.formGroup}>
            <label style={styles.label}>First Name:</label>
            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Last Name:</label>
            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Password:</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email:</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>New CNIC:</label>
            <input type="text" name="newCNIC" value={formData.newCNIC} onChange={handleChange} style={styles.input} />
          </div>
          <button type="submit" style={styles.button}>Update Patient</button>
        </div>
      </form>
      {message && showSuccessMessage && (
        <div className="alert alert-success" role="alert">
          {message}
        </div>
      )}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
};

const styles = {
  container: {
    minWidth: '100vw',
    minHeight: '100vh',
    margin: '0 auto',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    backgroundColor: '#f9f9f9',
    backgroundImage: `url(${bg3})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  heading: {
    fontSize: '24px',
    marginBottom: '20px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  formBorder: {
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    width: '80%',
    maxWidth: '500px',
  },
  formGroup: {
    marginBottom: '15px',
  },
  label: {
    fontSize: '16px',
    marginBottom: '5px',
  },
  input: {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '16px',
    width: '100%',
  },
  button: {
    backgroundColor: '#4caf50',
    color: 'white',
    padding: '10px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    minWidth: '100px',
    maxWidth: '300px',
  },
  error: {
    color: 'red',
    marginTop: '10px',
  },
};

export default UpdatePatient;
