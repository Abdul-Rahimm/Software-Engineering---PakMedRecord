import React from 'react';
import ReactDOM from 'react-dom/client';
// Fonts are bundled with the app (no dependency on Google Fonts being reachable)
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/noto-naskh-arabic';
// Base design system first, so component stylesheets can override it
import './styles/global.css';
import './styles/features.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Installable app + offline access to recently viewed records (production builds only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
