import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiCreditCard, FiHome, FiLock, FiMail, FiUser } from 'react-icons/fi';
import api from '../../api';
import { saveSession } from '../../session';
import Field from '../../ui/Field';
import { Button } from '../../ui/Bits';
import { PublicPage } from '../../ui/Layouts';
import { apiError, cnicProblem, maskCNIC, parseCNIC } from '../../lib/format';
import IdentityCapture from '../../ui/IdentityCapture';
import { ORG_TYPES, PROVINCES } from '../org/OrgManager';
import '../auth.css';

// A hospital, clinic or lab registers itself: the organization, its first branch and its administrator login.
const HospitalRegister = () => {
  const navigate = useNavigate();
  const [org, setOrg] = useState({ name: '', type: 'hospital', city: '', province: '', address: '', phone: '', registrationNo: '', branchName: '' });
  const [admin, setAdmin] = useState({ name: '', cnic: '', email: '', password: '' });
  const [idStep, setIdStep] = useState(false); // step 2: administrator's CNIC photo + live face check
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const o = (k) => (e) => setOrg({ ...org, [k]: e.target.value });
  const a = (k) => (e) => setAdmin({ ...admin, [k]: e.target.value });

  // Step 1: check the details (and that the email is free) before the camera step
  const submit = async (e) => {
    e.preventDefault();
    const cnicErr = cnicProblem(admin.cnic);
    if (cnicErr) return setError(`Your CNIC: ${cnicErr}`);
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/precheck', { role: 'staff', cnic: parseCNIC(admin.cnic), email: admin.email });
      setIdStep(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  // Step 2 done: register the hospital with the administrator's identity check attached
  const register = async (identity) => {
    try {
      const { data } = await api.post('/orgs/signup', { org, admin: { ...admin, cnic: parseCNIC(admin.cnic) }, acceptTerms: terms, identity });
      saveSession({ token: data.token, role: 'staff', id: data.staff._id, name: data.staff.name });
      navigate('/desk');
    } catch (err) {
      setIdStep(false);
      setError(apiError(err));
    }
  };

  return (
    <PublicPage>
      <div className={`grid ${idStep ? '' : 'grid-2'} hospital-register`} style={{ alignItems: 'start', gap: 32, ...(idStep && { maxWidth: 640, margin: '0 auto' }) }}>
        {!idStep && (
        <div className="stack gap-16">
          <span className="eyebrow">For hospitals & clinics</span>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>Bring your hospital to PakMedRecord</h1>
          <p className="muted">Set up your hospital in minutes. Add branches across Pakistan, enrol your doctors, give your front desk its own logins and take fees online.</p>
          <ul className="stack gap-8" style={{ listStyle: 'none', padding: 0 }}>
            {[
              'Patients find you by city, then choose a branch and doctor',
              'One shared front desk per branch: bookings, check-in, payments',
              'Doctors can work at several hospitals, with separate hours and fees at each',
              'Medical records stay with the patient. Your staff never see them',
              'Free to list. 5% platform fee only on fees paid online',
            ].map((t) => <li key={t} className="row gap-8"><FiCheckCircle style={{ color: 'var(--emerald)', flexShrink: 0 }} /> {t}</li>)}
          </ul>
          <p className="subtle" style={{ fontSize: 13 }}>After signing up, upload your healthcare commission registration. Patients see you once we verify it.</p>
          <p className="subtle" style={{ fontSize: 13 }}>Already registered? <Link to="/desk/signin">Sign in</Link></p>
        </div>
        )}
        {idStep ? (
          <section className="glass card-pad-lg stack gap-16">
            <div className="signup-steps"><span className="done">1. Hospital details</span><span className="on">2. Verify it&apos;s you</span></div>
            <h2 className="section-title">Verify it&apos;s you, {admin.name.split(' ')[0]}</h2>
            <p className="muted" style={{ fontSize: 14 }}>As the administrator, take a photo of your CNIC and do a short live face check. Our team checks it together with your hospital&apos;s registration.</p>
            <IdentityCapture expectedCnic={parseCNIC(admin.cnic)} onSubmit={register} submitLabel="Register hospital" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIdStep(false)}>← Back to the details</button>
          </section>
        ) : (
        <form className="glass card-pad-lg stack gap-16" onSubmit={submit}>
          <h2 className="section-title">Your organization</h2>
          <Field label="Name" icon={FiHome} value={org.name} onChange={o('name')} placeholder="e.g. Shifa Medical Centre" />
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field as="select" label="Type" value={org.type} onChange={o('type')}>{ORG_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Field>
            <Field label="Registration no. (optional now)" value={org.registrationNo} onChange={o('registrationNo')} />
            <Field label="City" value={org.city} onChange={o('city')} />
            <Field as="select" label="Province" value={org.province} onChange={o('province')}><option value="">Choose</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</Field>
          </div>
          <Field label="Main branch name" value={org.branchName} onChange={o('branchName')} placeholder="Main branch" />
          <Field label="Address" value={org.address} onChange={o('address')} />
          <Field label="Phone" value={org.phone} onChange={o('phone')} />
          <h2 className="section-title" style={{ marginTop: 8 }}>Administrator login</h2>
          <Field label="Your name" icon={FiUser} value={admin.name} onChange={a('name')} />
          <Field label="Your CNIC" icon={FiCreditCard} className="mono-input" inputMode="numeric" placeholder="42101-1234567-1" value={admin.cnic} onChange={(e) => setAdmin({ ...admin, cnic: maskCNIC(e.target.value) })} />
          <Field label="Work email" icon={FiMail} type="email" autoComplete="username" value={admin.email} onChange={a('email')} />
          <Field label="Password" icon={FiLock} type="password" autoComplete="new-password" value={admin.password} onChange={a('password')} hint="At least 12 characters" />
          <label className="row gap-8" style={{ fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>, and I am authorised to register this organization.</span>
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <Button className="btn btn-primary btn-lg btn-block" loading={busy} disabled={!org.name.trim() || !org.city.trim() || !admin.name.trim() || parseCNIC(admin.cnic).length !== 13 || !admin.email.trim() || admin.password.length < 12 || !terms}>Continue {!busy && <FiArrowRight />}</Button>
        </form>
        )}
      </div>
    </PublicPage>
  );
};

export default HospitalRegister;
