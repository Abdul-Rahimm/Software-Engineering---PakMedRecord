import React, { useState } from 'react';
import { Button, Typography, Modal } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons'; // Import icon for the toggle button

const { Paragraph } = Typography;

const HowToUse = () => {
  const [modalVisible, setModalVisible] = useState(false);

  const toggleModal = () => {
    setModalVisible(!modalVisible);
  };

  return (
    <div>
      <Button onClick={toggleModal} type="primary" style={{ marginLeft: '80px', backgroundColor: 'green' }}>
        <QuestionCircleOutlined /> A guide on how to use PakMedRecord
      </Button>
      <Modal
        visible={modalVisible}
        onCancel={toggleModal}
        footer={[
          
        ]}
      >
        <Paragraph>
          <strong>1. Find Doctors:</strong> Click on the "Find Doctors" button to search for doctors in your area.
        </Paragraph>
        <Paragraph>
          <strong>2. My Doctors:</strong> View the list of doctors you are affiliated with by clicking on "My Doctors".
        </Paragraph>
        <Paragraph>
          <strong>3. My Notes:</strong> Access your saved notes by clicking on "My Notes".
        </Paragraph>
        <Paragraph>
          <strong>4. My Medical Records:</strong> View your medical records by clicking on "My Medical Records".
        </Paragraph>
        <Paragraph>
          <strong>5. Add Note:</strong> Click on "Add Note" to add a new note to your profile.
        </Paragraph>
        <Paragraph>
          <strong>6. Book Appointment:</strong> Use "Book Appointment" to schedule appointments with doctors.
        </Paragraph>
        <Paragraph>
          <strong>7. Upload Medical Record:</strong> Upload your medical records using the "Upload Medical Record" option.
        </Paragraph>
        <Paragraph>
          <strong>8. Profile Settings:</strong> Access and update your profile settings by clicking on "Profile Settings".
        </Paragraph>
        <Paragraph>
          <strong>9. Logout:</strong> Click on "Logout" to sign out of your account.
        </Paragraph>
      </Modal>
    </div>
  );
};

export default HowToUse;
