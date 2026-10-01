import { useId } from 'react';
import { Link } from 'react-router-dom';

export const LogoMark = ({ size = 34 }) => {
  // unique ids: several logos can be on the page (some inside hidden containers)
  const uid = useId().replace(/:/g, '');
  const g = `lm-g-${uid}`;
  const glow = `lm-glow-${uid}`;
  return (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
    <defs>
      <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3dffb0" />
        <stop offset="1" stopColor="#22d3ee" />
      </linearGradient>
      <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="rgba(61,255,176,.07)" stroke={`url(#${g})`} strokeWidth="2.5" />
    <path d="M14 34h9l4-10 6 18 5-12 3 4h9" fill="none" stroke={`url(#${g})`} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glow})`}>
      <animate attributeName="stroke-dasharray" values="0 120;120 0" dur="2.4s" repeatCount="1" />
    </path>
  </svg>
  );
};

const Logo = ({ to = '/', size = 34, showText = true }) => (
  <Link to={to} className="row gap-12" style={{ color: 'var(--text)' }} aria-label="PakMedRecord home">
    <LogoMark size={size} />
    {showText && (
      <span style={{ font: '700 19px/1 var(--font-display)', letterSpacing: '-0.02em' }}>
        PakMed<span className="grad-text">Record</span>
      </span>
    )}
  </Link>
);

export default Logo;
