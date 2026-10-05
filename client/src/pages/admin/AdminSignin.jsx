import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiLock, FiMail } from 'react-icons/fi';
import api from '../../api';
import { saveSession } from '../../session';
import Field from '../../ui/Field';
import { Button } from '../../ui/Bits';
import { CenterCard } from '../../ui/Layouts';
import TwoFactorStep from '../../ui/TwoFactorStep';
import { apiError } from '../../lib/format';
import '../auth.css';

// Email + password sign-in for admins (/admin) and clinic front-desk staff (/desk)
const StaffSignin = ({ kind }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const role = kind === 'admin' ? 'admin' : 'staff';

  const finish = (data) => {
    if (data.twoFactorRequired) return setChallenge(data.challenge);
    const user = data[role];
    saveSession({ token: data.token, role, id: user._id, name: user.name });
    navigate(kind === 'admin' ? '/admin' : '/desk');
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(kind === 'admin' ? '/admin/signin' : '/desk/signin', { email, password });
      finish(data);
    } catch (err) {
      setError(apiError(err, 'Sign in failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenterCard>
      <div className="stack gap-8">
        <span className="eyebrow">{kind === 'admin' ? 'PakMedRecord admin' : 'Hospital & clinic staff'}</span>
        <h1 style={{ fontSize: 28 }}>{challenge ? 'Two-step sign-in' : 'Sign in'}</h1>
        {!challenge && <p className="muted">{kind === 'admin' ? 'Doctor verification, reports and partners.' : 'Front desk, doctors, branches and payments. Your hospital administrator creates your account.'}</p>}
      </div>
      {challenge ? (
        <TwoFactorStep challenge={challenge} onDone={finish} onCancel={() => setChallenge(null)} />
      ) : (
        <form className="stack gap-16" onSubmit={submit}>
          <Field label="Email" icon={FiMail} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <Field label="Password" icon={FiLock} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
          <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={loading} disabled={!email || !password}>Sign in {!loading && <FiArrowRight />}</Button>
        </form>
      )}
      {kind !== 'admin' && !challenge && <p className="subtle" style={{ fontSize: 13, textAlign: 'center' }}>New hospital or clinic? <Link to="/hospitals/register">Register it here</Link></p>}
      {!challenge && <p className="subtle" style={{ fontSize: 13, textAlign: 'center' }}><Link to="/signin">Other ways to sign in</Link></p>}
    </CenterCard>
  );
};

export default StaffSignin;
