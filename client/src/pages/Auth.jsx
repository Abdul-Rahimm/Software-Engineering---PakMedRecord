import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowLeft, FiArrowRight, FiCreditCard, FiEye, FiEyeOff, FiHeart, FiHome, FiLock, FiMail, FiUser,
} from 'react-icons/fi';
import { FaUserMd } from 'react-icons/fa';
import api from '../api';
import { saveSession } from '../session';
import Logo from '../ui/Logo';
import Field from '../ui/Field';
import Segmented from '../ui/Segmented';
import { Button } from '../ui/Bits';
import { useFeedback } from '../ui/Feedback';
import Scene from '../three/Scene';
import { apiError, isValidCNIC, maskCNIC, parseCNIC } from '../lib/format';
import './auth.css';

const COPY = {
  patient: {
    title: 'Your health, in one place.',
    text: 'Records from every hospital, appointments and your care team, all tied to your CNIC.',
    points: ['Doctor-verified history', 'Book with your care team', 'Download any record as PDF'],
  },
  doctor: {
    title: 'Your clinic, finally connected.',
    text: 'See your patients’ full history, review submitted records and manage your day.',
    points: ['Complete patient timelines', 'One-click record review', 'Appointment insights'],
  },
};

const passwordScore = (pw) => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};
const STRENGTH = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

const Auth = ({ role, mode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useFeedback();
  const isSignup = mode === 'signup';
  const cnicKey = role === 'doctor' ? 'doctorCNIC' : 'patientCNIC';

  const [form, setForm] = useState({
    cnic: location.state?.cnic ? maskCNIC(location.state.cnic) : '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    hospital: '',
    gender: 'Male',
  });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    const value = key === 'cnic' ? maskCNIC(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const score = useMemo(() => passwordScore(form.password), [form.password]);

  const validate = () => {
    const er = {};
    if (!isValidCNIC(form.cnic)) er.cnic = 'CNIC must be 13 digits';
    if (!form.password) er.password = 'Enter your password';
    if (isSignup) {
      if (form.password && form.password.length < 6) er.password = 'Use at least 6 characters';
      if (!form.firstName.trim()) er.firstName = 'Required';
      if (!form.lastName.trim()) er.lastName = 'Required';
      if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = 'Enter a valid email';
      if (!form.hospital.trim()) er.hospital = 'Required';
    }
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const cnic = parseCNIC(form.cnic);
    try {
      if (isSignup) {
        const body = {
          [cnicKey]: cnic,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          hospital: form.hospital.trim(),
          ...(role === 'patient' && { gender: form.gender }),
        };
        await api.post(`/${role}/signup`, body);
        toast('Account created. Sign in to continue.');
        navigate(`/${role}/signin`, { state: { cnic } });
      } else {
        const { data } = await api.post(`/${role}/signin`, { [cnicKey]: cnic, password: form.password });
        const user = data[role];
        saveSession({ token: data.token, role, cnic: user[cnicKey] });
        toast(`Welcome back, ${role === 'doctor' ? 'Dr. ' : ''}${user.firstName}`);
        navigate(`/${role}/home/${user[cnicKey]}`);
      }
    } catch (err) {
      toast(apiError(err, isSignup ? 'Sign up failed' : 'Sign in failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const copy = COPY[role];

  return (
    <div className="auth">
      <section className="auth-visual">
        <Scene name="orb" className="scene-fill" lift={1.1} accent={role === 'doctor' ? '#22d3ee' : '#10d68a'} />
        <div className="auth-visual-top">
          <Logo />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            className="auth-visual-copy"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <span className="eyebrow">{role === 'doctor' ? 'For doctors' : 'For patients'}</span>
            <h2>{copy.title}</h2>
            <p className="muted">{copy.text}</p>
            <div className="row gap-8 wrap">
              {copy.points.map((p) => <span key={p} className="badge badge-green">{p}</span>)}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      <section className="auth-panel">
        <Link to="/" className="btn btn-ghost btn-sm auth-back"><FiArrowLeft /> Home</Link>
        <motion.div
          className="glass auth-card"
          initial={{ opacity: 0, rotateY: -12, x: 40 }}
          animate={{ opacity: 1, rotateY: 0, x: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 20 }}
        >
          <div className="stack gap-20">
            <Segmented
              id="auth-role"
              value={role}
              onChange={(r) => navigate(`/${r}/${mode}`)}
              options={[
                { value: 'patient', label: 'Patient', icon: <FiHeart size={14} /> },
                { value: 'doctor', label: 'Doctor', icon: <FaUserMd size={14} /> },
              ]}
            />
            <div className="stack gap-8">
              <h1 style={{ fontSize: 32 }}>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
              <p className="muted">
                {isSignup ? 'It takes less than a minute.' : `Sign in to your ${role} dashboard.`}
              </p>
            </div>
          </div>

          <form className="stack gap-16" onSubmit={submit} noValidate>
            <Field label="CNIC" icon={FiCreditCard} placeholder="42101-1234567-1" inputMode="numeric" autoComplete="username" value={form.cnic} onChange={set('cnic')} error={errors.cnic} className="mono-input" />

            <AnimatePresence initial={false}>
              {isSignup && (
                <motion.div className="stack gap-16" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                  <div className="grid grid-2" style={{ gap: 14 }}>
                    <Field label="First name" icon={FiUser} value={form.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="given-name" />
                    <Field label="Last name" icon={FiUser} value={form.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="family-name" />
                  </div>
                  <Field label="Email" icon={FiMail} type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" placeholder="you@example.com" />
                  <Field label={role === 'doctor' ? 'Affiliated hospital' : 'Primary hospital'} icon={FiHome} value={form.hospital} onChange={set('hospital')} error={errors.hospital} placeholder="e.g. Aga Khan University Hospital" />
                  {role === 'patient' && (
                    <div className="field">
                      <span className="field-label">Gender</span>
                      <Segmented id="gender" value={form.gender} onChange={(g) => setForm((f) => ({ ...f, gender: g }))} options={['Male', 'Female', 'Other'].map((g) => ({ value: g, label: g }))} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="field">
              <label className="field-label" htmlFor="auth-pw">Password</label>
              <div className="input-wrap">
                <FiLock size={16} />
                <input id="auth-pw" className="input" type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} aria-invalid={errors.password ? 'true' : undefined} autoComplete={isSignup ? 'new-password' : 'current-password'} style={{ paddingRight: 46 }} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
              {isSignup && form.password && (
                <div className="row gap-12">
                  <div className="strength">
                    {[0, 1, 2, 3].map((i) => <span key={i} className={i < score ? `on s${score}` : ''} />)}
                  </div>
                  <span className="field-hint">{STRENGTH[score]}</span>
                </div>
              )}
            </div>

            <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={loading} style={{ marginTop: 6 }}>
              {isSignup ? 'Create account' : 'Sign in'} {!loading && <FiArrowRight />}
            </Button>
          </form>

          <p className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
            {isSignup ? 'Already have an account? ' : 'New to PakMedRecord? '}
            <Link to={`/${role}/${isSignup ? 'signin' : 'signup'}`}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </motion.div>
      </section>
    </div>
  );
};

export default Auth;
