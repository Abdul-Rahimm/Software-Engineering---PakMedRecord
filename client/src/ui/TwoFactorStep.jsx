import { useState } from 'react';
import { FiArrowRight, FiShield } from 'react-icons/fi';
import api from '../api';
import Field from './Field';
import { Button } from './Bits';
import { apiError } from '../lib/format';

// Second sign-in step: 6-digit code from an authenticator app, or a recovery code
const TwoFactorStep = ({ challenge, onDone, onCancel }) => {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa', { challenge, code: code.trim() });
      onDone(data);
    } catch (err) {
      setError(apiError(err, 'That code is not right'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="stack gap-16" onSubmit={submit} noValidate>
      <div className="inbox-orb"><FiShield size={28} /></div>
      <p className="muted" style={{ textAlign: 'center' }}>
        {recovery ? 'Enter one of the recovery codes you saved when you turned on two-step sign-in.' : 'Open your authenticator app and enter the 6-digit code for PakMedRecord.'}
      </p>
      <Field
        label={recovery ? 'Recovery code' : 'Verification code'}
        value={code}
        onChange={(e) => { setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        placeholder={recovery ? 'xxxxx-xxxxx' : '123456'}
        className="mono-input"
        error={error}
        autoFocus
      />
      <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={loading} disabled={recovery ? code.trim().length < 6 : code.length !== 6}>
        Verify {!loading && <FiArrowRight />}
      </Button>
      <div className="row between wrap gap-8">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRecovery((r) => !r); setCode(''); setError(''); }}>
          {recovery ? 'Use authenticator code' : 'Use a recovery code'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Start over</button>
      </div>
    </form>
  );
};

export default TwoFactorStep;
