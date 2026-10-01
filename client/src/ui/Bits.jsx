import { useEffect, useRef, useState } from 'react';
import { motion, animate, useInView } from 'framer-motion';
import { initials } from '../lib/format';

export const Spinner = ({ size = 16 }) => <span className="spinner" style={{ width: size, height: size }} aria-hidden />;

export const Button = ({ loading, children, className = 'btn', disabled, ...props }) => (
  <button className={className} disabled={disabled || loading} {...props}>
    {loading && <Spinner />}
    {children}
  </button>
);

const AVATAR_VARIANTS = ['', 'v2', 'v3'];
export const Avatar = ({ first, last, size = 42, seed }) => {
  const key = String(seed ?? `${first}${last}`);
  const variant = AVATAR_VARIANTS[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % 3];
  return (
    <span className={`avatar ${variant}`} style={{ '--size': `${size}px` }} aria-hidden>
      {initials(first, last)}
    </span>
  );
};

export const EmptyState = ({ icon: Icon, title, children, action }) => (
  <div className="empty">
    {Icon && <div className="empty-orb"><Icon size={30} /></div>}
    <h3>{title}</h3>
    {children && <p style={{ maxWidth: 380 }}>{children}</p>}
    {action && <div style={{ marginTop: 10 }}>{action}</div>}
  </div>
);

export const Skeleton = ({ height = 80, style }) => <div className="skeleton" style={{ height, ...style }} />;

// Number that counts up when it scrolls into view
export const CountUp = ({ value = 0, duration = 1.2 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(0, Number(value) || 0, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration]);
  return <span ref={ref}>{display}</span>;
};

// Page title block
export const PageHeader = ({ eyebrow, title, subtitle, actions }) => (
  <motion.header
    className="row between wrap gap-20"
    style={{ marginBottom: 28 }}
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
  >
    <div className="stack gap-12" style={{ minWidth: 0 }}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)' }}>{title}</h1>
      {subtitle && <p className="muted" style={{ maxWidth: 620 }}>{subtitle}</p>}
    </div>
    {actions && <div className="row gap-12 wrap">{actions}</div>}
  </motion.header>
);

// Staggered entrance for lists / grids
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
export const rise = {
  hidden: { opacity: 0, y: 24, rotateX: -12 },
  show: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } },
};

export const StatusBadge = ({ status }) => {
  const s = String(status || '').toLowerCase();
  const cls = s === 'completed' || s === 'approved' ? 'badge-green' : s === 'rejected' || s === 'cancelled' ? 'badge-rose' : 'badge-amber';
  return <span className={`badge ${cls}`}>{s ? s[0].toUpperCase() + s.slice(1) : '—'}</span>;
};
