// Import useState, useEffect from react
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import bgImage from '../assets/bg3.png';
import { FaSignInAlt, FaUserMd, FaFacebook, FaTwitter, FaInstagram, FaMoon, FaSun, FaStar, FaQuoteLeft } from 'react-icons/fa'; // Import icons
import { useSpring, animated } from 'react-spring'; // Import react-spring
import { Carousel } from 'react-bootstrap'; // Import Carousel component from react-bootstrap

const HeroPage = () => {
  const [collapse1, setCollapse1] = useState(false);
  const [collapse2, setCollapse2] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // State for theme

  const toggleCollapse1 = () => {
    setCollapse1(!collapse1);
    setCollapse2(false);
  };

  const toggleCollapse2 = () => {
    setCollapse2(!collapse2);
    setCollapse1(false);
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode); // Toggle theme
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

  // State for controlling the active index of testimonials
  const [activeIndex, setActiveIndex] = useState(0);

  // Function to handle the interval change
  const handleSelect = (selectedIndex, e) => {
    setActiveIndex(selectedIndex);
  };

  // Use useEffect to set an interval for automatic sliding
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) =>
        prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000); // Set interval for 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Testimonials data
  const testimonials = [
    {
      author: "Abdullah Siddiqui",
      role: "- Patient",
      text: "PakMedRecord has made managing my medical records so much easier. I can access them from anywhere and communicate with my doctors seamlessly.",
    },
    {
      author: "Abdul Rahim",
      role: "- Patient",
      text: "PakMedRecord has made managing my medical records so much easier. I can access them from anywhere and communicate with my doctors seamlessly.",
    },
    {
      author: "Amna Shahid",
      role: "- Patient",
      text: "PakMedRecord has made managing my medical records so much easier. I can access them from anywhere and communicate with my doctors seamlessly.",
    },
    {
      author: "Dr. Ali Khan",
      role: "- Doctor",
      text: "PakMedRecord has been an invaluable tool for managing my patient's records efficiently. It has improved communication and streamlined processes in my clinic.",
    },
  ];

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
        width: '100vw',
        backgroundColor: darkMode ? '#121212' : 'inherit', // Adjust background color based on theme
        color: darkMode ? '#ffffff' : 'inherit', // Adjust text color based on theme
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
        <h1 style={{ color: '#00ab66', fontSize: '3rem', marginTop: '50px' }}>Welcome to PakMedRecord</h1>
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

        {/* Testimonials Carousel */}
        <Carousel activeIndex={activeIndex} onSelect={handleSelect} interval={5000}>
          {testimonials.map((testimonial, index) => (
            <Carousel.Item key={index}>
              <div className="row justify-content-center">
                <div className="col-md-6">
                  <animated.div
                    className="card mb-4 shadow testimonial-card"
                    style={{
                      ...testimonialAnimation,
                      opacity: 1,
                      transform: index === activeIndex ? 'translateX(0)' : 'translateX(-100%)',
                    }}
                  >
                    <div className="card-body">
                      <FaQuoteLeft className="quote-icon" />
                      <p className="card-text">{testimonial.text}</p>
                      <div className="rating">
                        {[...Array(5)].map((star, i) => {
                          const ratingValue = i + 1;
                          return (
                            <span key={i}>
                              <FaStar className="star" color={ratingValue <= 4 ? 'gold' : '#ddd'} size={20} />
                            </span>
                          );
                        })}
                      </div>
                      <div className="testimonial-author">
                        <span className="author-name">{testimonial.author}</span>
                        <span className="author-info">{testimonial.role}</span>
                      </div>
                    </div>
                  </animated.div>
                </div>
              </div>
            </Carousel.Item>
          ))}
        </Carousel>
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
