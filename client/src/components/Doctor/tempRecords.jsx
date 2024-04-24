import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import bg3 from '../../assets/bg3.png';
import { Table, Button } from 'antd';
import { CheckOutlined, DownloadOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';

const PendingMedicalRecords = () => {
    const { doctorCNIC } = useParams();
    const [pendingRecords, setPendingRecords] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPendingRecords = async () => {
            try {
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
            await axios.post(`http://localhost:3009/record/create`, pendingRecords.find(record => record._id === recordId));
            setPendingRecords(pendingRecords.filter(record => record._id !== recordId));
            await axios.delete(`http://localhost:3009/tempRecords/remove/${recordId}`);
        } catch (error) {
            console.error('Error approving medical record:', error);
            setError('Failed to approve medical record. Please try again later.');
        }
    };

    const handleDownloadPDF = (recordData) => {
        const doc = new jsPDF();
        // doc.setTextColor(0, 128, 0); // Set text color to green
        // doc.text('PakMedRecord', 10, 10); // Add PakMedRecord heading
        doc.text(recordData, 10, 10); // You can customize the PDF content here
        doc.save('medical_record.pdf');
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
                <div>
                    <Button onClick={() => handleApprove(record._id)} icon={<CheckOutlined />} style={{ marginRight: '5px' }}>Approve</Button>
                    <Button onClick={() => handleDownloadPDF(record.recordData)} icon={<DownloadOutlined />}>Download PDF</Button>
                </div>
            ),
        },
    ];

    return (
        <div style={{ marginLeft: '', backgroundImage: `url(${bg3})`, minHeight: '100vh', minWidth: '100vw', backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <h1 style={{ marginLeft: '550px', color: 'green', fontWeight: 'bold' }}>PakMedRecord</h1>
            <h2 style={{ marginLeft: '550px' }}>Pending Medical Records</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <Table dataSource={pendingRecords} columns={columns} style={{ padding: '50px' }} />
        </div>
    );
};

export default PendingMedicalRecords;
