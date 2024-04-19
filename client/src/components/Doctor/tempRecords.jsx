import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Import useParams
import axios from 'axios';

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

    return (
        <div>
            <h2>Pending Medical Records</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ul>
                {pendingRecords.map(record => (
                    <li key={record._id}>
                        <div>Record Data: {record.recordData}</div>
                        <div>Status: {record.status}</div>
                        <button onClick={() => handleApprove(record._id)}>Approve</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default PendingMedicalRecords;
