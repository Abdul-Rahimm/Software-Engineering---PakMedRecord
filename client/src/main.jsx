import React from 'react';
import ReactDOM from 'react-dom/client';
// Base design system first, so component stylesheets can override it
import './styles/global.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
