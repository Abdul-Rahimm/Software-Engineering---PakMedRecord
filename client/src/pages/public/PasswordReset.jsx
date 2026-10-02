import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiInbox, FiLock, FiUser } from 'react-icons/fi';
import api from '../../api';
import Field from '../../ui/Field';
import Segmented from '../../ui/Segmented';
import { Button } from '../../ui/Bits';
import { CenterCard } from '../../ui/Layouts';
import { useFeedback } from '../../ui/Feedback';
import { apiError } from '../../lib/format';
import '../auth.css';

// Step 1: ask for the CNIC or email; we email a link
export const ForgotPassword = () => {
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'doctor' ? 'doctor' : 'patient');
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useFeedback();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { role, identifier });
      setSent(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenterCard>
      {sent ? (
        <div className="stack gap-16" style={{ textAlign: 'center' }}>
          <div className="inbox-orb"><FiInbox size={30} /></div>
          <h1 style={{ fontSize: 26 }}>Check your email</h1>
          <p className="muted">If an account matches, we sent a link to reset your password. It works for one hour.</p>
          <p className="subtle" style={{ fontSize: 13 }}>Can&apos;t find it? Check your spam folder, or try again with your email address.</p>
          <Link to={`/${role}/signin`} className="btn btn-primary btn-block">Back to sign in</Link>
        </div>
      ) : (
        <form className="stack gap-16" onSubmit={submit}>
          <div className="stack gap-8">
            <h1 style={{ fontSize: 28 }}>Forgot your password?</h1>
            <p className="muted">Enter your CNIC or the email on your account and we&apos;ll send you a reset link.</p>
          </div>
          <Segmented id="fp-role" value={role} onChange={setRole} options={[{ value: 'patient', label: 'Patient' }, { value: 'doctor', label: 'Doctor' }]} />
          <Field label="CNIC or email" icon={FiUser} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="42101-1234567-1 or you@example.com" autoFocus />
          <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={loading} disabled={!identifier.trim()}>Send reset link {!loading && <FiArrowRight />}</Button>
          <Link to={`/${role}/signin`} className="btn btn-ghost btn-sm">Back to sign in</Link>
        </form>
      )}
    </CenterCard>
  );
};

// Step 2: the link from the email lands here
export const ResetPassword = () => {
  const [params] = useSearchParams();
  const role = params.get('role') === 'doctor' ? 'doctor' : 'patient';
  const token = params.get('token');
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => { if (!token) setError('This reset link is incomplete. Ask for a new one.'); }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setError('Use at least 8 characters');
    if (pw !== pw2) return setError('The two passwords do not match');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { role, token, password: pw });
      setDone(data);
    } catch (err) {
      setError(apiError(err, 'Could not reset the password'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <CenterCard>
        <div className="stack gap-16" style={{ textAlign: 'center' }}>
          <div className="inbox-orb"><FiCheckCircle size={30} /></div>
          <h1 style={{ fontSize: 26 }}>Password changed</h1>
          <p className="muted">You&apos;ve been signed out everywhere else. Sign in with your new password.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => { toast('Password changed'); navigate(`/${role}/signin`, { state: { cnic: done.cnic } }); }}>Sign in</button>
        </div>
      </CenterCard>
    );
  }

  return (
    <CenterCard>
      <form className="stack gap-16" onSubmit={submit}>
        <div className="stack gap-8">
          <h1 style={{ fontSize: 28 }}>Choose a new password</h1>
          <p className="muted">Use at least 8 characters. A mix of words, numbers and symbols is strongest.</p>
        </div>
        <Field label="New password" icon={FiLock} type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setError(''); }} autoFocus />
        <Field label="Confirm new password" icon={FiLock} type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setError(''); }} error={error} />
        <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={loading} disabled={!token}>Save password</Button>
        <Link to={`/forgot-password?role=${role}`} className="btn btn-ghost btn-sm">Get a new link</Link>
      </form>
    </CenterCard>
  );
};
