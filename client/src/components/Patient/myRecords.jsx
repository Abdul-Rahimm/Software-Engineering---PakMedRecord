import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Container, Typography, Card, CardContent, CircularProgress, Button } from '@mui/material';
import { MdDescription } from 'react-icons/md'; // Import icon for medical records
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import bg3 from '../../assets/bg3.png';

const MyRecordsPage = () => {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const { patientCNIC } = useParams();
  const [loading, setLoading] = useState(false); // Added for loading indicator
  const [selectedRecord, setSelectedRecord] = useState(null);
  const pdfRef = useRef();

  useEffect(() => {
    const fetchMedicalRecords = async () => {
      try {
        setLoading(true); // Show loading indicator
        if (patientCNIC) {
          const response = await axios.get(`http://localhost:3009/record/getrecords/${patientCNIC}`);
          setMedicalRecords(response.data);
        }
        setLoading(false); // Hide loading indicator
      } catch (error) {
        console.error('Error fetching medical records:', error);
        setLoading(false); // Hide loading indicator
      }
    };

    fetchMedicalRecords();
  }, [patientCNIC]);

  const handleDownloadPDF = () => {
    pdfRef.current.save();
  };

  const styles = StyleSheet.create({
    page: {
      flexDirection: 'column',
      padding: 20,
    },
    header: {
      backgroundColor: 'green',
      padding: 10,
      marginBottom: 10,
      textAlign: 'center',
    },
    headerText: {
      fontSize: 24,
      color: 'white',
      fontWeight: 'bold',
    },
    section: {
      margin: 10,
      padding: 10,
      flexGrow: 1,
    },
    subHeader: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      marginBottom: 5,
    },
    label: {
      width: '30%',
      fontWeight: 'bold',
    },
  });

  const MedicalRecordDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerText}>PakMedRecord</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.subHeader}>Medical Record Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Record ID:</Text>
            <Text>{selectedRecord._id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Record Data:</Text>
            <Text>{selectedRecord.recordData}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text>{new Date(selectedRecord.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Added By:</Text>
            <Text>{`This medical record was added by ${selectedRecord.doctor}`}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  return (
    <div style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', width: '100vw', height: '100vh' }}>
      <Container>
        <Typography variant="h2" style={{ marginTop: '20px', color: 'green', marginLeft: '370px' }}>PakMedRecord</Typography>
        <Typography variant="h4" style={{ marginTop: '20px', marginLeft: '400px' }}>My Medical Records</Typography>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <CircularProgress />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
              {medicalRecords.map((record, index) => (
                <Card key={record._id} style={{ backgroundColor: index % 2 === 0 ? 'green' : 'grey', width: '30%', margin: '0 auto' }}>
                  <CardContent>
                    <Typography variant="h6" component="div" style={{ display: 'flex', alignItems: 'center', color: 'white' }}>
                      <MdDescription style={{ marginRight: '10px' }} /> Record ID: {record._id}
                    </Typography>
                    <Typography variant="body1" component="div" style={{ color: 'white' }}>
                      Data: {record.recordData}
                    </Typography>
                    <Typography variant="body2" component="div" style={{ marginTop: '10px', color: 'white' }}>
                      Date: {new Date(record.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" component="div" style={{ marginTop: '10px', color: 'white' }}>
                      {`This medical record was added by ${record.doctor}`}
                    </Typography>
                    <Button variant="contained" color="success" onClick={() => setSelectedRecord(record)}>
                      View PDF
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div style={{ marginTop: '20px' }}>
              {selectedRecord && (
                <PDFDownloadLink
                  document={<MedicalRecordDocument />}
                  fileName="medical_record.pdf"
                  ref={pdfRef}
                  style={{ color: 'green', textDecoration: 'none', cursor: 'pointer' }}
                  className="download-link"
                  onMouseOver={e => e.target.style.textDecoration = 'underline'}
                  onMouseOut={e => e.target.style.textDecoration = 'none'}
                >
                  {({ blob, url, loading, error }) => (
                    <span>{loading ? 'Loading document...' : 'Download PDF'}</span>
                  )}
                </PDFDownloadLink>
              )}
            </div>
          </>
        )}
      </Container>
    </div>
  );
};

export default MyRecordsPage;
