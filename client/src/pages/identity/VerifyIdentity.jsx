import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiShield } from 'react-icons/fi';
import api from '../../api';
import { getSession } from '../../session';
import { useFetch } from '../../lib/data';
import { apiError, maskCNIC, parseCNIC } from '../../lib/format';
import { PublicPage } from '../../ui/Layouts';
import { EmptyState, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import IdentityCapture from '../../ui/IdentityCapture';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const home = (s) => (s?.role === 'doctor' ? `/doctor/home/${s.cnic}` : s?.role === 'patient' ? `/patient/home/${s.cnic}` : s?.role === 'staff' ? '/desk' : '/');

// CNIC photo + live face check for the signed-in account; reviewed by the PakMedRecord team
const VerifyIdentity = () => {
  const session = getSession();
  const { toast } = useFeedback();
  const { data, loading, reload } = useFetch(async () => (session ? (await api.get('/identity/me')).data : null), []);
  const [cnic, setCnic] = useState('');
  const [started, setStarted] = useState(false);

  if (!session) return <PublicPage><div className="glass"><EmptyState icon={FiShield} title="Sign in first" action={<Link className="btn btn-primary" to="/">Home</Link>}>Sign in to verify your identity.</EmptyState></div></PublicPage>;
  if (loading) return <PublicPage><Skeleton height={300} /></PublicPage>;
  const status = data?.identity?.status || 'none';
  const staff = session.role === 'staff';
  const expected = staff ? parseCNIC(cnic) : String(session.cnic);

  const submit = async (payload) => {
    try {
      const { data: r } = await api.post('/identity', { ...payload, ...(staff && { cnic: parseCNIC(cnic) }) });
      toast(r.message);
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  return (
    <PublicPage>
      <Link to={home(session)} className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>← Back</Link>
      <section className="glass card-pad-lg stack gap-20" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="stack gap-8">
          <span className="eyebrow">Identity check</span>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 32px)' }}>Verify your identity</h1>
          <p className="muted">Take a photo of your CNIC and do a short live face check on your camera. It proves the account belongs to you and protects your CNIC from being used by someone else.</p>
        </div>
        {status === 'verified' ? (
          <div className="auth-notice" style={{ borderColor: 'rgba(61,255,176,.4)', background: 'rgba(61,255,176,.08)' }}><FiCheckCircle /> Your identity is verified.</div>
        ) : status === 'pending' && !started ? (
          <div className="stack gap-12">
            <div className="auth-notice" style={{ borderColor: 'rgba(34,211,238,.35)', background: 'rgba(34,211,238,.07)' }}><FiClock /> Submitted. Our team reviews it, usually within one working day.</div>
            <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setStarted(true)}>Submit again</button>
          </div>
        ) : (
          <>
            {status === 'rejected' && <p className="auth-notice">Your last check wasn&apos;t approved{data.identity.note ? `: ${data.identity.note}` : ''}. Please try again.</p>}
            {staff && <Field label="Your CNIC" className="mono-input" value={cnic} onChange={(e) => setCnic(maskCNIC(e.target.value))} placeholder="42101-1234567-1" inputMode="numeric" />}
            {(!staff || parseCNIC(cnic).length === 13) && <IdentityCapture expectedCnic={expected} onSubmit={submit} />}
            <ul className="subtle stack gap-4" style={{ fontSize: 12.5, paddingInlineStart: 18 }}>
              <li>Use your original CNIC (or NICOP / Smart card), not a photocopy.</li>
              <li>Photos are private: only the PakMedRecord verification team sees them, and they are deleted with your account.</li>
            </ul>
          </>
        )}
      </section>
    </PublicPage>
  );
};

export default VerifyIdentity;
