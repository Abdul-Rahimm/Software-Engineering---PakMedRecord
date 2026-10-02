import React from 'react';
import ReactDOM from 'react-dom/client';
// Fonts are bundled with the app (no dependency on Google Fonts being reachable)
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
// Base design system first, so component stylesheets can override it
import './styles/global.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
