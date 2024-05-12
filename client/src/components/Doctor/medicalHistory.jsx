import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Typography, CircularProgress, Button, Accordion, AccordionSummary, AccordionDetails, Card, CardContent, Grid, Box, Container } from '@mui/material';
import { MdDescription } from 'react-icons/md';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import bg3 from '../../assets/bg3.png';

const MedicalHistory = () => {
  const { patientCNIC } = useParams(); // Extract patientCNIC from URL
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const pdfRef = useRef();

  useEffect(() => {
    const fetchMedicalHistory = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:3009/record/getrecords/${patientCNIC}`);
        setMedicalHistory(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching medical history:', error);
        setLoading(false);
      }
    };

    fetchMedicalHistory();
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
    accordion: {
      flex: '1 0 auto',
      width: '300px',
      marginRight: '20px',
    },
    accordionSummary: {
      backgroundColor: '#f0f0f0',
      borderBottom: '1px solid #ddd',
      padding: '10px',
      borderRadius: '5px',
    },
    accordionDetails: {
      backgroundColor: '#f9f9f9',
      padding: '10px',
      borderRadius: '5px',
    },
    sliderContainer: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      backgroundColor: '#fff',
      boxShadow: '0 -2px 5px rgba(0, 0, 0, 0.1)',
      padding: '10px 20px',
      zIndex: 999,
    },
    sliderInner: {
      display: 'flex',
      justifyContent: 'center',
    },
  });

  const MedicalRecordDocument = ({ record }) => (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerText}>PakMedRecord</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.subHeader}>Medical Record Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Record ID:</Text>
            <Text>{record._id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Record Data:</Text>
            <Text>{record.recordData}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text>{new Date(record.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Patient CNIC:</Text>
            <Text>{record.patientCNIC}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  return (
    <div style={{ backgroundImage: `url(${bg3})`, backgroundSize: 'cover', width: '100vw', height: '100vh' }}>
      <Container>
        <Typography variant="h2" style={{ marginTop: '20px', color: 'green', marginLeft: '370px' }}>PakMedRecord</Typography>
        <Typography variant="h4" style={{ marginTop: '20px', marginLeft: '400px' }}> Medical Records for {patientCNIC}</Typography>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <CircularProgress />
          </div>
        ) : (
          <>
            <Box sx={{ display: 'flex', overflowX: 'auto', gap: '20px', marginTop: '20px' }}>
              {medicalHistory.map((record, index) => (
                <Accordion key={record._id} style={styles.accordion}>
                  <AccordionSummary expandIcon={<MdDescription />} style={styles.accordionSummary}>
                    <Typography>Record ID: {record._id}</Typography>
                  </AccordionSummary>
                  <AccordionDetails style={styles.accordionDetails}>
                    <Card>
                      <CardContent>
                        <Typography variant="body1" component="div" style={{ color: 'black' }}>
                        </Typography>
                        <Typography variant="body2" component="div" style={{ marginTop: '10px', color: 'black' }}>
                          Date: {new Date(record.createdAt).toLocaleDateString()}
                        </Typography>
                        <PDFDownloadLink
                          document={<MedicalRecordDocument record={record} />}
                          fileName="medical_record.pdf"
                          ref={pdfRef}
                          style={{ color: 'green', textDecoration: 'none', cursor: 'pointer', marginRight: '20px' }}
                          className="download-link"
                          onMouseOver={e => e.target.style.textDecoration = 'underline'}
                          onMouseOut={e => e.target.style.textDecoration = 'none'}
                        >
                          {({ blob, url, loading, error }) => (
                            <Button variant="contained" color="success">
                              {loading ? 'Loading document...' : 'Download PDF'}
                            </Button>
                          )}
                        </PDFDownloadLink>
                        <Button variant="contained" color="error" onClick={() => setSelectedRecord(null)}>
                          Close PDF
                        </Button>
                      </CardContent>
                    </Card>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
            {selectedRecord && (
              <div style={styles.sliderContainer}>
                <div style={styles.sliderInner}>
                  
                </div>
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  );
};

export default MedicalHistory;
