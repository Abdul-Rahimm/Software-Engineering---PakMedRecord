import { useEffect, useState } from 'react';
import { FiWifiOff } from 'react-icons/fi';

// Shown while the device is offline: the app keeps working from cached data
const OfflineBanner = () => {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return <div className="offline-banner" role="status"><FiWifiOff /> You&apos;re offline. Showing your last saved records; changes need a connection.</div>;
};

export default OfflineBanner;
