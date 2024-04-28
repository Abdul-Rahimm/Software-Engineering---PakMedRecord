import React, { useState } from 'react';
import axios from 'axios';
import { Input, Button, message } from 'antd'; // Import Ant Design components
import bg3 from '../../assets/bg3.png';

const UpdatePatient = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    email: '',
    newCNIC: ''
  });

  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.put(`http://localhost:3009/patient/update/${formData.newCNIC}`, formData);
      message.success(response.data.message); // Show success message
      // Reset form data after successful update
      setFormData({
        firstName: '',
        lastName: '',
        password: '',
        email: '',
        newCNIC: ''
      });
      setError('');
    } catch (error) {
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
            <Input type="text" name="firstName" value={formData.firstName} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Last Name:</label>
            <Input type="text" name="lastName" value={formData.lastName} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Password:</label>
            <Input.Password name="password" value={formData.password} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email:</label>
            <Input type="email" name="email" value={formData.email} onChange={handleChange} style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>New CNIC:</label>
            <Input type="text" name="newCNIC" value={formData.newCNIC} onChange={handleChange} style={styles.input} />
          </div>
          <Button type="success" htmlType="submit" style={styles.button}>Update Info</Button>
        </div>
      </form>
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
    borderRadius: '4px',
    fontSize: '16px',
    width: '100%',
  },
  button: {
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    minWidth: '100px',
    maxWidth: '300px',
    color: 'white',
    backgroundColor:'green',
  },
  error: {
    color: 'red',
    marginTop: '10px',
  },
};

export default UpdatePatient;
