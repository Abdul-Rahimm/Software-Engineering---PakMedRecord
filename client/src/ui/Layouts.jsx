import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from './Logo';
import { ThemeToggle } from './Theme';
import { LangToggle } from '../lib/i18n';

// Small centred card page (password reset, staff sign-in, checkout…)
export const CenterCard = ({ children, width = 460 }) => (
  <div className="center-page">
    <div className="center-page-top">
      <Logo />
      <div className="row gap-8"><LangToggle /><ThemeToggle /></div>
    </div>
    <motion.div
      className="glass auth-card"
      style={{ width: `min(${width}px, 100%)` }}
      initial={{ opacity: 0, y: 20, rotateX: -10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
    >
      {children}
    </motion.div>
  </div>
);

// Public pages: simple header, readable content column
export const PublicPage = ({ children, wide = false, nav = true }) => (
  <div className="public-page">
    <header className="public-head">
      <Logo />
      <div className="row gap-8 wrap" style={{ justifyContent: 'flex-end' }}>
        {nav && <Link to="/find-doctors" className="btn btn-ghost btn-sm hide-sm">Find a doctor</Link>}
        {nav && <Link to="/patient/signin" className="btn btn-ghost btn-sm hide-sm">Sign in</Link>}
        <LangToggle />
        <ThemeToggle />
      </div>
    </header>
    <main className={`public-main ${wide ? 'wide' : ''}`}>{children}</main>
    <footer className="public-foot subtle">
      <span>© {new Date().getFullYear()} PakMedRecord</span>
      <Link to="/terms">Terms</Link>
      <Link to="/privacy">Privacy</Link>
      <Link to="/developers">Developers</Link>
    </footer>
  </div>
);
