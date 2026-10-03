import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiAlertTriangle, FiBell, FiCopy, FiKey, FiDownload, FiEye, FiLock, FiMail, FiMessageCircle, FiShield, FiSmartphone, FiTrash2,
} from 'react-icons/fi';
import api from '../../api';
import { clearSession, getSession, saveSession } from '../../session';
import { useShell } from '../../layout/ShellContext';
import { useFetch, useServerOptions } from '../../lib/data';
import { apiError, formatDateTime } from '../../lib/format';
import { Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import QRCode from '../../ui/QRCode';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

export const TwoFactorCard = () => {
  const { toast } = useFeedback();
  const { data, reload } = useFetch(async () => (await api.get('/account/2fa')).data, []);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    try {
      setSetup((await api.post('/account/2fa/setup')).data);
      setCode('');
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };
  const enable = async () => {
    setBusy(true);
    try {
      const { data: res } = await api.post('/account/2fa/enable', { code });
      setSetup(null);
      setCodes(res.recoveryCodes);
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      await api.post('/account/2fa/disable', { code });
      setDisabling(false);
      toast('Two-step sign-in is off');
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row between wrap gap-12">
        <div className="row gap-12">
          <span className="empty-orb" style={{ width: 44, height: 44 }}><FiSmartphone size={20} /></span>
          <div>
            <h2 className="section-title">Two-step sign-in</h2>
            <p className="subtle" style={{ fontSize: 13.5 }}>Ask for a code from an authenticator app (Google Authenticator, Microsoft Authenticator…) after your password.</p>
          </div>
        </div>
        {data && (data.enabled
          ? <div className="row gap-8"><span className="badge badge-green">On</span><button className="btn btn-sm" onClick={() => { setDisabling(true); setCode(''); }}>Turn off</button></div>
          : <button className="btn btn-primary btn-sm" onClick={start}><FiShield /> Turn on</button>)}
      </div>

      <Modal open={Boolean(setup)} onClose={() => setSetup(null)} title="Set up two-step sign-in" subtitle="Scan the QR code with your authenticator app, then enter the 6-digit code it shows." width={520}>
        {setup && (
          <div className="stack gap-16" style={{ alignItems: 'center' }}>
            <QRCode value={setup.otpauthUrl} size={200} label="Authenticator QR code" />
            <p className="subtle" style={{ fontSize: 12.5, textAlign: 'center' }}>Can&apos;t scan? Enter this key manually:<br /><code className="mono" data-no-translate style={{ wordBreak: 'break-all' }}>{setup.secret}</code></p>
            <Field label="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="mono-input" autoFocus />
            <Button className="btn btn-primary btn-block" disabled={code.length !== 6} loading={busy} onClick={enable}>Turn on</Button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(codes)} onClose={() => setCodes(null)} title="Save your recovery codes" subtitle="If you lose your phone, each code lets you sign in once. Keep them somewhere safe; they won't be shown again." width={480}>
        {codes && (
          <div className="stack gap-16">
            <div className="recovery-codes" data-no-translate>{codes.map((c) => <code key={c}>{c}</code>)}</div>
            <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(codes.join('\n')); toast('Codes copied'); }}><FiCopy /> Copy codes</button>
          </div>
        )}
      </Modal>

      <Modal open={disabling} onClose={() => setDisabling(false)} title="Turn off two-step sign-in?" subtitle="Enter a current code from your authenticator app to confirm." width={440}>
        <div className="stack gap-16">
          <Field label="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="mono-input" autoFocus />
          <Button className="btn btn-danger btn-block" disabled={code.length !== 6} loading={busy} onClick={disable}>Turn off</Button>
        </div>
      </Modal>
    </section>
  );
};

// Change password with the current one; other devices are signed out and this one keeps a fresh session
export const PasswordCard = ({ minLength = 8 }) => {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const mismatch = form.confirm && form.next !== form.confirm;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/account/password', { currentPassword: form.current, newPassword: form.next });
      saveSession({ ...getSession(), token: data.token });
      setForm({ current: '', next: '', confirm: '' });
      toast(data.message);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row gap-12">
        <span className="empty-orb" style={{ width: 44, height: 44 }}><FiKey size={20} /></span>
        <div>
          <h2 className="section-title">Password</h2>
          <p className="subtle" style={{ fontSize: 13.5 }}>Changing it signs you out on every other device.</p>
        </div>
      </div>
      <form className="stack gap-12" onSubmit={save}>
        <Field label="Current password" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
        <div className="grid grid-2" style={{ gap: 12 }}>
          <Field label="New password" type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} hint={`At least ${minLength} characters`} />
          <Field label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={mismatch ? 'Passwords don’t match' : undefined} />
        </div>
        <Button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} loading={busy} disabled={!form.current || form.next.length < minLength || form.next !== form.confirm}>Change password</Button>
      </form>
    </section>
  );
};

const NotificationsCard = () => {
  const { cnic, profile, reloadProfile } = useShell();
  const { toast } = useFeedback();
  const options = useServerOptions();
  const prefs = profile?.notificationPrefs || {};
  const save = async (patch) => {
    try {
      await api.put(`/patient/update/${cnic}`, { notificationPrefs: { ...prefs, ...patch } });
      await reloadProfile();
      toast('Saved');
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };
  const channel = (key, Icon, label, available, note) => (
    <label className={`pref-row ${available ? '' : 'disabled'}`}>
      <Icon size={18} />
      <div className="grow"><div style={{ fontWeight: 600 }}>{label}</div><div className="subtle" style={{ fontSize: 12.5 }}>{note}</div></div>
      <input type="checkbox" className="switch" checked={Boolean(prefs[key]) && available} disabled={!available} onChange={(e) => save({ [key]: e.target.checked })} />
    </label>
  );
  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row gap-12">
        <span className="empty-orb" style={{ width: 44, height: 44 }}><FiBell size={20} /></span>
        <div>
          <h2 className="section-title">Reminders</h2>
          <p className="subtle" style={{ fontSize: 13.5 }}>We remind you the day before appointments, when medicines need a refill and when a child&apos;s vaccine is due.</p>
        </div>
      </div>
      <div className="stack gap-8">
        <label className="pref-row"><FiBell size={18} /><div className="grow"><div style={{ fontWeight: 600 }}>Appointment reminders</div></div><input type="checkbox" className="switch" checked={prefs.appointmentReminders !== false} onChange={(e) => save({ appointmentReminders: e.target.checked })} /></label>
        <label className="pref-row"><FiBell size={18} /><div className="grow"><div style={{ fontWeight: 600 }}>Medicine & vaccine reminders</div></div><input type="checkbox" className="switch" checked={prefs.medicationReminders !== false} onChange={(e) => save({ medicationReminders: e.target.checked })} /></label>
      </div>
      <span className="field-label">Send them by</span>
      <div className="stack gap-8">
        {channel('email', FiMail, 'Email', Boolean(options?.channels?.email), profile?.email || 'No email on file')}
        {channel('whatsapp', FiMessageCircle, 'WhatsApp', Boolean(options?.channels?.whatsapp) && Boolean(profile?.phone), options?.channels?.whatsapp ? (profile?.phone ? `To ${profile.phone}` : 'Add your phone number in Profile first') : 'Coming soon')}
        {channel('sms', FiSmartphone, 'SMS', Boolean(options?.channels?.sms) && Boolean(profile?.phone), options?.channels?.sms ? (profile?.phone ? `To ${profile.phone}` : 'Add your phone number in Profile first') : 'Coming soon')}
      </div>
      <p className="subtle" style={{ fontSize: 12.5 }}>You always get reminders in the app&apos;s notification bell.</p>
    </section>
  );
};

const AccessLogCard = () => {
  const { data, loading } = useFetch(async () => (await api.get('/account/access-log')).data, []);
  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row gap-12">
        <span className="empty-orb" style={{ width: 44, height: 44 }}><FiEye size={20} /></span>
        <div>
          <h2 className="section-title">Who viewed my record</h2>
          <p className="subtle" style={{ fontSize: 13.5 }}>Every time a doctor, share link, emergency scan or partner opened your information.</p>
        </div>
      </div>
      {loading ? <Skeleton height={120} /> : !data.length ? <EmptyState icon={FiEye} title="No one yet">Views will appear here.</EmptyState> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Who</th><th>What</th><th>When</th></tr></thead>
            <tbody>
              {data.slice(0, 100).map((l) => (
                <tr key={l._id}><td><strong>{l.who}</strong>{l.where && <div className="subtle" style={{ fontSize: 12 }}>{l.where}</div>}</td><td>{l.action}{l.count > 1 ? <span className="subtle"> ×{l.count}</span> : ''}</td><td>{formatDateTime(l.at)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const DataCard = ({ role }) => {
  const navigate = useNavigate();
  const { profile } = useShell();
  const { toast } = useFeedback();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const google = profile?.hasPassword === false;

  const download = async () => {
    try {
      const res = await api.get('/account/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pakmedrecord-${role}-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.post('/account/delete', google ? { confirm: password } : { password });
      clearSession();
      toast('Your account has been deleted');
      navigate('/');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row gap-12">
        <span className="empty-orb" style={{ width: 44, height: 44 }}><FiLock size={20} /></span>
        <div>
          <h2 className="section-title">Your data</h2>
          <p className="subtle" style={{ fontSize: 13.5 }}>Download a copy of everything, or close your account for good.</p>
        </div>
      </div>
      <div className="row gap-12 wrap">
        <button className="btn" onClick={download}><FiDownload /> Download my data</button>
        <button className="btn btn-danger" onClick={() => { setDeleting(true); setPassword(''); }}><FiTrash2 /> Delete account</button>
      </div>
      <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete your account?" width={480}
        subtitle={role === 'patient' ? 'This permanently deletes your records, uploaded files, appointments, prescriptions and family profiles. It cannot be undone.' : 'Your profile, clinic membership and upcoming appointments are removed. Records you wrote stay in your patients’ histories.'}>
        <div className="stack gap-16">
          <p className="auth-notice"><FiAlertTriangle /> Consider downloading your data first.</p>
          {google
            ? <Field label='Type DELETE to confirm' value={password} onChange={(e) => setPassword(e.target.value)} />
            : <Field label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          <Button className="btn btn-danger btn-block" disabled={!password} loading={busy} onClick={remove}>Delete permanently</Button>
        </div>
      </Modal>
    </section>
  );
};

const Security = () => {
  const { role, profile } = useShell();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const dependent = Boolean(profile?.guardianCNIC);
  return (
    <>
      <PageHeader eyebrow="Account" title="Security & privacy" subtitle="Control how you sign in, who can see your information and what we send you." />
      <div className="stack gap-20" style={{ maxWidth: 880 }}>
        {!dependent && <TwoFactorCard />}
        {!dependent && profile?.hasPassword !== false && <PasswordCard />}
        {role === 'patient' && <NotificationsCard />}
        {role === 'patient' && <AccessLogCard />}
        {!dependent && <DataCard role={role} />}
      </div>
    </>
  );
};

export default Security;
