import { useEffect, useState } from 'react';
import QR from 'qrcode';

// Renders a QR code for `value` as an <img>
export const qrDataUrl = (value, size = 320) =>
  QR.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } });

const QRCode = ({ value, size = 180, label }) => {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    if (value) qrDataUrl(value, size * 2).then((u) => live && setSrc(u)).catch(() => {});
    return () => { live = false; };
  }, [value, size]);
  return (
    <div className="qr" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={label || 'QR code'} width={size} height={size} /> : <span className="skeleton" style={{ width: size, height: size }} />}
    </div>
  );
};

export default QRCode;
