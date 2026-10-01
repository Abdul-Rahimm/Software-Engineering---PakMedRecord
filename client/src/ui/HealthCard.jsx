import { useRef } from 'react';
import { LogoMark } from './Logo';
import { formatCNIC, formatDate } from '../lib/format';
import './healthcard.css';

// Holographic 3D ID card that follows the cursor
const HealthCard = ({ person, role = 'patient', cnic }) => {
  const ref = useRef(null);

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * 22}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 26}deg`);
    el.style.setProperty('--px', `${px * 100}%`);
    el.style.setProperty('--py', `${py * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '8deg');
    el.style.setProperty('--ry', '-14deg');
  };

  return (
    <div className="hc-stage" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="hc-float">
      <div className="hc" ref={ref}>
        <div className="hc-holo" />
        <div className="hc-content">
          <div className="row between">
            <div className="row gap-8">
              <LogoMark size={26} />
              <span className="hc-brand">PakMedRecord</span>
            </div>
            <span className="hc-type">{role === 'doctor' ? 'PRACTITIONER' : 'HEALTH ID'}</span>
          </div>

          <div className="row gap-16" style={{ alignItems: 'flex-end' }}>
            <div className="hc-chip" />
            <svg className="hc-pulse" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden>
              <path d="M0 15h30l6-10 8 20 7-14 5 4h64" />
            </svg>
          </div>

          <div className="hc-cnic">{formatCNIC(cnic)}</div>

          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div className="stack" style={{ minWidth: 0 }}>
              <span className="hc-label">{role === 'doctor' ? 'Doctor' : 'Holder'}</span>
              <span className="hc-name truncate">
                {person ? `${role === 'doctor' ? 'Dr. ' : ''}${person.firstName} ${person.lastName}` : '—'}
              </span>
            </div>
            <div className="stack" style={{ textAlign: 'right' }}>
              <span className="hc-label">{person?.createdAt ? 'Since' : 'Hospital'}</span>
              <span className="hc-meta">{person?.createdAt ? formatDate(person.createdAt, { month: 'short', year: 'numeric' }) : person?.hospital || '—'}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
      <div className="hc-shadow" />
    </div>
  );
};

export default HealthCard;
