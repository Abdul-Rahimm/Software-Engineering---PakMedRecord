import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiMail, FiPhone, FiUser } from 'react-icons/fi';
import api from '../../api';
import { apiError, maskCNIC, parseCNIC } from '../../lib/format';
import { PublicPage } from '../../ui/Layouts';
import Field from '../../ui/Field';
import Segmented from '../../ui/Segmented';
import IdentityCapture from '../../ui/IdentityCapture';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

// "Someone else registered my CNIC": prove it's yours with the card and a live face check
const ClaimCnic = () => {
  const [params] = useSearchParams();
  const { toast } = useFeedback();
  const [form, setForm] = useState({ role: params.get('role') === 'doctor' ? 'doctor' : 'patient', cnic: maskCNIC(params.get('cnic') || ''), name: '', email: '', phone: '', message: '' });
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (payload) => {
    try {
      const { data } = await api.post('/public/cnic-claim', { ...form, cnic: parseCNIC(form.cnic), ...payload });
      setDone(data.message);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  return (
    <PublicPage>
      <section className="glass card-pad-lg stack gap-20" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="stack gap-8">
          <span className="eyebrow">CNIC already registered?</span>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 32px)' }}>Claim your CNIC</h1>
          <p className="muted">If someone else (often a relative) created an account with your CNIC, prove it&apos;s yours. Our team compares your card and live photo with the account, then moves the account to you or freezes it.</p>
        </div>
        {done ? (
          <div className="auth-notice" style={{ borderColor: 'rgba(61,255,176,.4)', background: 'rgba(61,255,176,.08)' }}><FiCheckCircle /> {done}</div>
        ) : !ready ? (
          <form className="stack gap-16" onSubmit={(e) => { e.preventDefault(); setReady(true); }}>
            <div className="field">
              <span className="field-label">The account is a</span>
              <Segmented id="claim-role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[{ value: 'patient', label: 'Patient account' }, { value: 'doctor', label: 'Doctor account' }]} />
            </div>
            <Field label="Your CNIC" className="mono-input" value={form.cnic} onChange={(e) => setForm({ ...form, cnic: maskCNIC(e.target.value) })} placeholder="42101-1234567-1" inputMode="numeric" />
            <Field label="Your full name (as on the CNIC)" icon={FiUser} value={form.name} onChange={set('name')} />
            <div className="grid grid-2" style={{ gap: 14 }}>
              <Field label="Email" icon={FiMail} type="email" value={form.email} onChange={set('email')} hint="The account will be moved to this email" />
              <Field label="Mobile" icon={FiPhone} value={form.phone} onChange={set('phone')} placeholder="0300 1234567" />
            </div>
            <Field as="textarea" label="What happened? (optional)" value={form.message} onChange={set('message')} maxLength={1000} placeholder="e.g. My brother registered with my CNIC by mistake" />
            <button className="btn btn-primary" disabled={parseCNIC(form.cnic).length !== 13 || !form.name.trim() || !/\S+@\S+\.\S+/.test(form.email)}>Continue to CNIC and face check</button>
            <p className="subtle" style={{ fontSize: 12.5 }}>Knowingly claiming someone else&apos;s CNIC is an offence under Pakistani law. Have an account already? <Link to="/">Sign in</Link>.</p>
          </form>
        ) : (
          <IdentityCapture expectedCnic={parseCNIC(form.cnic)} onSubmit={submit} submitLabel="Send claim" />
        )}
      </section>
    </PublicPage>
  );
};

export default ClaimCnic;
