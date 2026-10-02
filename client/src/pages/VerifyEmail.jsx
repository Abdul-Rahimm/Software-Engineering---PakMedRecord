import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import api from '../api';
import Logo from '../ui/Logo';
import { Spinner } from '../ui/Bits';
import { ThemeToggle } from '../ui/Theme';
import { apiError } from '../lib/format';
import './auth.css';

// Landing page for the link in the verification email
const VerifyEmail = () => {
  const [params] = useSearchParams();
  const role = params.get('role') === 'doctor' ? 'doctor' : 'patient';
  const token = params.get('token');
  const [state, setState] = useState({ status: 'loading' });
  const started = useRef(false); // the token is single-use: don't post it twice in StrictMode

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState({ status: 'error', message: 'This verification link is incomplete.' });
      return;
    }
    api.post('/auth/verify-email', { role, token })
      .then(({ data }) => setState({ status: 'ok', cnic: data.cnic }))
      .catch((err) => setState({ status: 'error', message: apiError(err, 'Verification failed') }));
  }, [role, token]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ position: 'fixed', top: 20, left: 24 }}><Logo /></div>
      <div style={{ position: 'fixed', top: 18, right: 24 }}><ThemeToggle /></div>
      <motion.div
        className="glass auth-card"
        style={{ textAlign: 'center', alignItems: 'center' }}
        initial={{ opacity: 0, y: 20, rotateX: -10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
      >
        {state.status === 'loading' && (
          <>
            <Spinner size={28} />
            <h1 style={{ fontSize: 26 }}>Verifying your email…</h1>
          </>
        )}
        {state.status === 'ok' && (
          <>
            <div className="inbox-orb"><FiCheckCircle size={32} /></div>
            <h1 style={{ fontSize: 28 }}>Email verified</h1>
            <p className="muted">Your account is active. You can sign in now.</p>
            <Link to={`/${role}/signin`} state={{ cnic: state.cnic }} className="btn btn-primary btn-lg btn-block">Sign in</Link>
          </>
        )}
        {state.status === 'error' && (
          <>
            <div className="inbox-orb" style={{ color: 'var(--amber)' }}><FiAlertTriangle size={30} /></div>
            <h1 style={{ fontSize: 26 }}>Link not valid</h1>
            <p className="muted">{state.message}</p>
            <p className="subtle" style={{ fontSize: 13 }}>Sign in and choose &ldquo;Resend verification email&rdquo; to get a new link.</p>
            <Link to={`/${role}/signin`} className="btn btn-lg btn-block">Go to sign in</Link>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
