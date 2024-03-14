import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import bgImage from '../assets/bg3.png';

const HeroPage = () => {
  const [collapse1, setCollapse1] = useState(false);
  const [collapse2, setCollapse2] = useState(false);

  const toggleCollapse1 = () => {
    setCollapse1(!collapse1);
    setCollapse2(false);
  };

  const toggleCollapse2 = () => {
    setCollapse2(!collapse2);
    setCollapse1(false);
  };

  return (
    <div
      className="hero-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '20px',
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: '100vh',
      }}
    >
      <div>
        <h2 style={{ color: 'green' }}>PakMedRecord.</h2>
        <h6 style={{ color: 'black', marginLeft: '50px' }}>h e a l t h c a r e</h6>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '20px' }}>
        <Link to="/doctor/signin" className="btn btn-outline-success btn-md mr-2">
          Sign in as Doctor
        </Link>
        <Link to="/patient/signin" className="btn btn-success btn-md">
          Sign in as Patient
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
        <p>
          <button className="btn btn-secondary" onClick={toggleCollapse1} type="button" aria-expanded={collapse1} aria-controls="multiCollapseExample1" style={{ marginBottom: '100px' }}>
            Info
          </button>
          <button className="btn btn-outline-secondary" onClick={toggleCollapse2} type="button" aria-expanded={collapse2} aria-controls="multiCollapseExample2" style={{ marginBottom: '100px' }}>
            Read More
          </button>
        </p>
        <div className="row">
          <div className="col">
            <div className={`collapse ${collapse1 ? 'show' : ''}`} id="multiCollapseExample1">
              <div className="card card-body" style={{ color: 'green', backgroundColor: 'white' }}>
                <h2>PakMedRecord</h2> is a revolutionary platform designed with the primary objective of centralizing healthcare interactions between doctors and patients. Our core focus is to establish seamless connections, fostering unparalleled convenience and enhancing the credibility and safety of medical records. By providing a centralized hub, PakMedRecord ensures that both doctors and patients can effortlessly access and manage their medical information. This not only streamlines communication between healthcare professionals and their patients but also contributes to the overall efficiency of the healthcare ecosystem. Moreover, our platform places a strong emphasis on the credibility and safety of medical records. We understand the critical nature of healthcare data, and PakMedRecord employs robust security measures to safeguard sensitive information. This commitment to data integrity not only builds trust among users but also ensures a reliable and secure environment for all medical interactions. In essence, PakMedRecord is dedicated to transforming the healthcare landscape by offering a unified space for doctors and patients, ultimately creating a more connected, convenient, and secure healthcare experience.
              </div>
            </div>
          </div>
          <div className="col">
            <div className={`collapse ${collapse2 ? 'show' : ''}`} id="multiCollapseExample2">
              <div className="card card-body" style={{ backgroundColor: 'green', color: 'white' }}>
                <h2>How to Use PakMedRecord</h2>
                <h5>For Patients:</h5>
                Sign up for an account on PakMedRecord as a patient. Sign in to your account using your credentials. Explore your dashboard to view medical records, appointments, and other features. Update your medical information as needed. Schedule appointments with healthcare providers.
                <h5>For Doctors:</h5>
                Sign up for an account on PakMedRecord as a doctor. Sign in to your account using your credentials. Access patient medical records and update them as needed. Manage appointments and communicate with patients. Utilize other features such as prescription management and billing.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroPage;
