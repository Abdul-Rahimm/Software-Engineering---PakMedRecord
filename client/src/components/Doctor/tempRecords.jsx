import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Import useParams
import axios from 'axios';
import bg3 from '../../assets/bg3.png';
import { Table } from 'antd'; // Import Ant Design Table
import { CheckOutlined } from '@ant-design/icons'; // Import Ant Design CheckOutlined icon

const PendingMedicalRecords = () => {
    const { doctorCNIC } = useParams(); // Extract doctorCNIC from params
    const [pendingRecords, setPendingRecords] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPendingRecords = async () => {
            try {
                // Fetch pending medical records for the specified doctor
                const response = await axios.get(`http://localhost:3009/tempRecords/pending/${doctorCNIC}`);
                setPendingRecords(response.data.pendingRecords);
                setError('');
            } catch (error) {
                console.error('Error fetching pending medical records:', error);
                setError('Failed to fetch pending medical records. Please try again later.');
            }
        };

        fetchPendingRecords();
    }, [doctorCNIC]);

    const handleApprove = async (recordId) => {
        try {
            // Post the record to the medical record collection
            await axios.post(`http://localhost:3009/record/create`, pendingRecords.find(record => record._id === recordId));
            // Remove the approved record from the pending list
            setPendingRecords(pendingRecords.filter(record => record._id !== recordId));
            // Delete the approved record from the tempRecords table
            await axios.delete(`http://localhost:3009/tempRecords/remove/${recordId}`);
        } catch (error) {
            console.error('Error approving medical record:', error);
            setError('Failed to approve medical record. Please try again later.');
        }
    };

    const columns = [
        {
            title: 'Record Data',
            dataIndex: 'recordData',
            key: 'recordData',
        },
        {
            title: 'Patient CNIC',
            dataIndex: 'patientCNIC',
            key: 'patientCNIC',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (text, record) => (
                <button onClick={() => handleApprove(record._id)}>
                    <CheckOutlined />
                </button>
            ),
        },
    ];

    return (
        <div style={{ marginLeft: '', backgroundImage: `url(${bg3})`, minHeight: '100vh', minWidth: '100vw',  backgroundSize: 'cover',
        backgroundPosition: 'center' }}> 
        <h1 style={{ marginLeft: '550px', color: 'green', fontWeight: 'bold' }}>PakMedRecord</h1>
            <h2 style={{ marginLeft: '550px' }}>Pending Medical Records</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <Table dataSource={pendingRecords} columns={columns} style={{padding: '50px' }}/>
        </div>
    );
};

export default PendingMedicalRecords;
