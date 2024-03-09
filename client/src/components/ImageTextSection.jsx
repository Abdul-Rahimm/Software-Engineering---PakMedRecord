import React from 'react';

const ImageTextSection = () => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: '550px', marginBottom: '50px', marginLeft: '375px', marginRight: '1000px' }}>
      {/* Image on the left */}
      <div style={{ flex: '0 0 50%', marginRight: '20px' }}>
        <img src="your-image-path.jpg" alt="Your Image" style={{ width: '100%', borderRadius: '8px' }} />
      </div>

      {/* Text on the right */}
      <div style={{ flex: '0 0 50%' }}>
        <h3>Section Title</h3>
        <p>
          
        </p>
        <p>
          
        </p>
      </div>
    </div>
  );
};

export default ImageTextSection;
