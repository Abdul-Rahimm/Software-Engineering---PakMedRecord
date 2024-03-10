import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'white' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', margin: '20px' }}>
        <h2 style={{ color: 'green' }}>PakMedRecord.</h2>
        <h6 style={{ color: 'black' }}>h e a l t h c a r e</h6>
      </div>
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <a className="navbar-brand" href="#"></a>
        <button
          className="navbar-toggler"
          type="button"
          data-toggle="collapse"
          data-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav mr-auto">
            <li className="nav-item active">
              <a className="nav-link" href="#">
                Home <span className="sr-only"></span>
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#">
                About
              </a>
            </li>
            <li className="nav-item dropdown">
              <a
                className="nav-link dropdown-toggle"
                href="#"
                id="navbarDropdown"
                role="button"
                data-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false"
              >
                Services
              </a>
              <div className="dropdown-menu" aria-labelledby="navbarDropdown">
                <a className="dropdown-item" href="#">
                  Action
                </a>
                <a className="dropdown-item" href="#">
                  Another action
                </a>
                <div className="dropdown-divider"></div>
                <a className="dropdown-item" href="#">
                  Something else here
                </a>
              </div>
            </li>
            <li className="nav-item">
              <a className="nav-link " href="#">
                Contact
              </a>
            </li>
          </ul>
          <form className="form-inline my-2 my-lg-0">
            <input
              className="form-control mr-sm-2"
              type="search"
              placeholder="Search"
              aria-label="Search"
            />
            <button className="btn btn-outline-success my-2 my-sm-0" type="submit" style={{ marginLeft: '200px', marginTop: '30px' }}>
              Search
            </button>
          </form>
        </div>
      </nav>
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
          <button className="btn btn-secondary" onClick={toggleCollapse1} type="button" aria-expanded={collapse1} aria-controls="multiCollapseExample1">
            Info
          </button>
          <button className="btn btn-outline-secondary" onClick={toggleCollapse2} type="button" aria-expanded={collapse2} aria-controls="multiCollapseExample2">
            Read More
          </button>
        </p>
        <div className="row">
          <div className="col">
            <div className={`collapse ${collapse1 ? 'show' : ''}`} id="multiCollapseExample1">
              <div className="card card-body" style={{ color: 'green', backgroundColor: 'white' }}>
              <h2>PakMedRecord</h2> is a revolutionary platform designed with the primary objective of centralizing healthcare interactions between doctors and patients. Our core focus is to establish seamless connections, fostering unparalleled convenience and enhancing the credibility and safety of medical records.

By providing a centralized hub, PakMedRecord ensures that both doctors and patients can effortlessly access and manage their medical information. This not only streamlines communication between healthcare professionals and their patients but also contributes to the overall efficiency of the healthcare ecosystem.

Moreover, our platform places a strong emphasis on the credibility and safety of medical records. We understand the critical nature of healthcare data, and PakMedRecord employs robust security measures to safeguard sensitive information. This commitment to data integrity not only builds trust among users but also ensures a reliable and secure environment for all medical interactions.

In essence, PakMedRecord is dedicated to transforming the healthcare landscape by offering a unified space for doctors and patients, ultimately creating a more connected, convenient, and secure healthcare experience.
              </div>
            </div>
          </div>
          <div className="col">
            <div className={`collapse ${collapse2 ? 'show' : ''}`} id="multiCollapseExample2">
            <div className="card card-body" style={{ backgroundColor: 'green', color: 'white' }}>
    Explore the myriad benefits of <span style={{ fontStyle: 'italic', fontSize: '40px' }}>PakMedRecord</span>a cutting-edge healthcare platform designed to revolutionize the doctor-patient experience. Enjoy the convenience of centralized medical records accessible anytime, anywhere, fostering a streamlined and efficient healthcare journey. With PakMedRecord, patients can effortlessly schedule appointments, securely communicate with their healthcare providers, and access their comprehensive medical history in one centralized location. For doctors, this platform offers a seamless way to manage patient information, ensuring accurate diagnoses and personalized care. Embrace the future of healthcare with PakMedRecord, where connectivity, convenience, and the highest standards of data security converge for a transformative and trustworthy healthcare experience. Read more to discover how PakMedRecord is reshaping the landscape of healthcare interactions, prioritizing user-friendly accessibility and safeguarding the integrity of medical records.
</div>


            </div>
          </div>
        </div>
      </div>
      {/* <ImageTextSection /> */}
    </div>
  );
};

export default HeroPage
