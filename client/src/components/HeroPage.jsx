import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import bgImage from '../assets/bg3.png';
import { FaSignInAlt, FaUserMd, FaFacebook, FaTwitter, FaInstagram } from 'react-icons/fa'; // Import icons
import { useSpring, animated } from 'react-spring'; // Import react-spring

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

  // Animation for navigation bar
  const navBarAnimation = useSpring({
    from: { opacity: 0, transform: 'translateY(-50px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  });

  // Animation for testimonials
  const testimonialAnimation = useSpring({
    from: { opacity: 0, transform: 'translateX(-50px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
    delay: 500, // Delay the animation
  });

  // Animation for footer
  const footerAnimation = useSpring({
    from: { opacity: 0, transform: 'translateY(50px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  });

  return (
    <animated.div // Wrap the content with animated.div for animations
      className="hero-page"
      style={{
        ...navBarAnimation, // Apply navigation bar animation
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '20px',
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${bgImage})`, // Apply overlay to the background image
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh', // Change height to minHeight to ensure the content stretches the full height
        width: '100vw'
      }}
    >
      {/* Navigation Bar/Header */}
      <animated.nav // Wrap the navigation bar with animated.nav for animations
        className="navbar navbar-expand-lg navbar-dark bg-dark"
        style={{ minWidth: '100vw' }}
      >
        <div className="container">
          <Link className="navbar-brand" to="/">PakMedRecord</Link>
          <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ml-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/doctor/signin"><FaUserMd /> Sign in as Doctor</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/patient/signin"><FaSignInAlt /> Sign in as Patient</Link>
              </li>
            </ul>
          </div>
        </div>
      </animated.nav>

      <div className="text-center text-light">
        <h1 style={{ color: 'darkgreen', fontSize: '3rem', marginTop: '50px' }}>Welcome to PakMedRecord</h1>
        <p style={{ color: 'white', fontSize: '1.5rem', marginBottom: '50px' }}>Empowering Healthcare</p>
      </div>

      {/* Content */}
      <animated.div // Wrap the content with animated.div for animations
        style={{ ...testimonialAnimation, maxWidth: '800px', textAlign: 'center', color: 'white', marginBottom: '100px' }}
      >
        <p>
          PakMedRecord is a revolutionary platform designed to centralize healthcare interactions between doctors and patients. Our platform ensures seamless connections, fosters unparalleled convenience, and enhances the credibility and safety of medical records.
        </p>
        <p>
          Sign up now and experience a connected, convenient, and secure healthcare experience.
        </p>

        {/* Testimonials */}
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card mb-4">
              {/* <img src={testimonialImage1} className="card-img-top" alt="Testimonial 1" style={{ borderRadius: '50%' }} /> */}
              <div className="card-body">
                <h5 className="card-title">Abdullah Siddiqui</h5>
                <p className="card-text">"PakMedRecord has made managing my medical records so much easier. I can access them from anywhere and communicate with my doctors seamlessly."</p>
              </div>
            </div>
          </div>
        </div>
      </animated.div>

      {/* Footer */}
      <animated.footer // Wrap the footer with animated.footer for animations
        className="footer mt-auto py-3 bg-dark"
        style={{ minWidth: '100vw', ...footerAnimation }} // Apply footer animation
      >
        <div className="container text-center text-light">
          <div className="row">
            <div className="col-md-4">
              <h5>Quick Links</h5>
              <ul className="list-unstyled">
                <li><Link to="/about">About Us</Link></li>
                <li><Link to="/contact">Contact Us</Link></li>
                <li><Link to="/privacy">Privacy Policy</Link></li>
              </ul>
            </div>
            <div className="col-md-4">
              <h5>Connect with Us</h5>
              <ul className="list-unstyled">
                <li><a href="https://www.facebook.com"><FaFacebook /></a></li>
                <li><a href="https://www.twitter.com"><FaTwitter /></a></li>
                <li><a href="https://www.instagram.com"><FaInstagram /></a></li>
              </ul>
            </div>
            <div className="col-md-4">
              <h5>Contact Information</h5>
              <p>Email: info@pakmedrecord.com</p>
              <p>Phone: +1-123-456-7890</p>
            </div>
          </div>
          <hr />
          <p>© 2024 PakMedRecord. All rights reserved.</p>
        </div>
      </animated.footer>
    </animated.div>
  );
};

export default HeroPage;
