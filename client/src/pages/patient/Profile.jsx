import { useEffect, useState } from 'react';
import { FiLock, FiMail, FiSave, FiUser } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { apiError, formatCNIC, formatDate } from '../../lib/format';
import { Button, PageHeader } from '../../ui/Bits';
import Field from '../../ui/Field';
import HealthCard from '../../ui/HealthCard';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const Profile = () => {
  const { cnic, profile, reloadProfile } = useShell();
  const { toast } = useFeedback();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, firstName: profile.firstName, lastName: profile.lastName, email: profile.email }));
  }, [profile]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mismatch = form.password && form.confirm && form.password !== form.confirm;

  const save = async (e) => {
    e.preventDefault();
    if (mismatch) return;
    setSaving(true);
    try {
      const body = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() };
      if (form.password) body.password = form.password;
      await api.put(`/patient/update/${cnic}`, body);
      setForm((f) => ({ ...f, password: '', confirm: '' }));
      await reloadProfile();
      toast('Profile updated');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const facts = [
    ['CNIC', formatCNIC(cnic)],
    ['Primary hospital', profile?.hospital],
    ['Gender', profile?.gender],
    ['Member since', formatDate(profile?.createdAt)],
  ];

  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" subtitle="Update your details. Your CNIC is your permanent health ID and can't be changed." />
      <div className="grid profile-grid">
        <div className="stack gap-20">
          <HealthCard person={profile} cnic={cnic} />
          <div className="glass card-pad">
            {facts.map(([k, v]) => (
              <div key={k} className="summary-row"><span className="k" style={{ width: 130 }}>{k}</span><span className={k === 'CNIC' ? 'mono' : ''}>{v || '—'}</span></div>
            ))}
          </div>
        </div>

        <form className="glass card-pad-lg stack gap-20" onSubmit={save}>
          <h2 className="section-title">Personal details</h2>
          <div className="grid grid-2" style={{ gap: 16 }}>
            <Field label="First name" icon={FiUser} value={form.firstName} onChange={set('firstName')} required />
            <Field label="Last name" icon={FiUser} value={form.lastName} onChange={set('lastName')} required />
          </div>
          <Field label="Email" icon={FiMail} type="email" value={form.email} onChange={set('email')} required />

          <h2 className="section-title" style={{ marginTop: 8 }}>Change password</h2>
          <div className="grid grid-2" style={{ gap: 16 }}>
            <Field label="New password" icon={FiLock} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} hint="Leave blank to keep current" />
            <Field label="Confirm password" icon={FiLock} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={mismatch ? 'Passwords don’t match' : undefined} />
          </div>

          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button className="btn btn-primary btn-lg" loading={saving} disabled={mismatch || (form.password && !form.confirm)}><FiSave /> Save changes</Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default Profile;
