import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import Routes from './Routes';
import 'bootstrap/dist/css/bootstrap.min.css';


const App = () => {
  return (
    <Router>
    <div>
      <Routes />
    </div>
  </Router>
  );
};

export default App;
