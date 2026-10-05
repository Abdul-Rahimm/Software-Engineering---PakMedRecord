import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiAward, FiClock, FiDollarSign, FiExternalLink, FiGlobe, FiHome, FiLock, FiMail, FiMapPin, FiPhone, FiSave, FiUser } from 'react-icons/fi';
import VerificationCard from '../../ui/VerificationCard';
import PaymentAccountCard from '../../ui/PaymentAccountCard';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { apiError, formatCNIC } from '../../lib/format';
import { SPECIALIZATIONS } from '../../lib/constants';
import { Button, PageHeader } from '../../ui/Bits';
import AvatarUpload from '../../ui/AvatarUpload';
import Field from '../../ui/Field';
import HealthCard from '../../ui/HealthCard';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', hospital: '', specialization: 'General Physician', yearsExperience: '', bio: '', city: '', clinicAddress: '', fee: '', languages: '', qualifications: '', password: '', confirm: '' };

const DoctorProfile = () => {
  const { cnic, profile, reloadProfile } = useShell();
  const { toast } = useFeedback();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone || '',
        hospital: profile.hospital,
        specialization: profile.specialization || 'General Physician',
        yearsExperience: profile.yearsExperience ?? '',
        bio: profile.bio || '',
        city: profile.city || '',
        clinicAddress: profile.clinicAddress || '',
        fee: profile.fee ?? '',
        languages: (profile.languages || []).join(', '),
        qualifications: profile.qualifications || '',
      }));
    }
  }, [profile]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mismatch = form.password && form.confirm && form.password !== form.confirm;

  const save = async (e) => {
    e.preventDefault();
    if (mismatch) return;
    setSaving(true);
    try {
      const { password } = form;
      const body = Object.fromEntries(Object.entries(form).filter(([k]) => k !== 'confirm' && k !== 'password'));
      await api.put(`/doctor/update/${cnic}`, { ...body, languages: form.languages.split(',').map((l) => l.trim()).filter(Boolean), ...(password && { password }) });
      setForm((f) => ({ ...f, password: '', confirm: '' }));
      await reloadProfile();
      toast('Profile updated');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        subtitle="Patients see your specialty, fee, clinic and timings in the public doctor directory once you're verified."
        actions={
          <>
            <Link to={`/doctor/hours/${cnic}`} className="btn"><FiClock /> Clinic hours</Link>
            {profile?.isVerified && <a href={`/find-doctors/${profile._id}`} target="_blank" rel="noreferrer" className="btn"><FiExternalLink /> Public profile</a>}
          </>
        }
      />
      {profile && <div className="glass card-pad" style={{ marginBottom: 20 }}><AvatarUpload person={profile} first={profile.firstName} last={profile.lastName} seed={cnic} onChange={reloadProfile} /></div>}
      {profile && <div style={{ marginBottom: 20 }}><VerificationCard doctor={profile} onChange={reloadProfile} /></div>}
      {profile?.isVerified && <div style={{ marginBottom: 20 }}><PaymentAccountCard path="/payments/account/doctor" owner="your own Safepay account" /></div>}
      <div className="grid profile-grid">
        <div className="stack gap-20">
          <HealthCard person={profile} cnic={cnic} role="doctor" />
          <div className="glass card-pad">
            <div className="summary-row"><span className="k" style={{ width: 110 }}>CNIC</span><span className="mono">{formatCNIC(cnic)}</span></div>
            <div className="summary-row"><span className="k" style={{ width: 110 }}>Specialty</span><span>{profile?.specialization || '—'}</span></div>
            <div className="summary-row"><span className="k" style={{ width: 110 }}>Hospital</span><span>{profile?.hospital || '—'}</span></div>
          </div>
        </div>

        <form className="glass card-pad-lg stack gap-20" onSubmit={save}>
          <h2 className="section-title">Professional details</h2>
          <div className="grid grid-2" style={{ gap: 16 }}>
            <Field label="First name" icon={FiUser} value={form.firstName} onChange={set('firstName')} required />
            <Field label="Last name" icon={FiUser} value={form.lastName} onChange={set('lastName')} required />
            <Field as="select" label="Specialization" icon={FiAward} value={form.specialization} onChange={set('specialization')}>
              {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Field>
            <Field label="Years of experience" type="number" min="0" max="70" value={form.yearsExperience} onChange={set('yearsExperience')} />
            <Field label="Hospital" icon={FiHome} value={form.hospital} onChange={set('hospital')} required />
            <Field label="Phone" icon={FiPhone} type="tel" value={form.phone} onChange={set('phone')} placeholder="03xx-xxxxxxx" />
          </div>
          <Field label="Email" icon={FiMail} type="email" value={form.email} onChange={set('email')} required />
          <h2 className="section-title" style={{ marginTop: 8 }}>Directory listing</h2>
          <div className="grid grid-2" style={{ gap: 16 }}>
            <Field label="City" icon={FiMapPin} value={form.city} onChange={set('city')} placeholder="e.g. Karachi" />
            <Field label="Consultation fee (Rs)" icon={FiDollarSign} type="number" min="0" value={form.fee} onChange={set('fee')} placeholder="e.g. 2500" />
            <Field label="Qualifications" icon={FiAward} value={form.qualifications} onChange={set('qualifications')} placeholder="e.g. MBBS, FCPS (Cardiology)" />
            <Field label="Languages" icon={FiGlobe} value={form.languages} onChange={set('languages')} placeholder="Urdu, English, Sindhi" hint="Separate with commas" />
          </div>
          <Field label="Clinic address" icon={FiHome} value={form.clinicAddress} onChange={set('clinicAddress')} placeholder="Room, building, area" />
          <Field as="textarea" label="Bio" value={form.bio} onChange={set('bio')} maxLength={600} hint={`${form.bio.length}/600 · shown in the doctor directory`} placeholder="Training, areas of interest, languages spoken…" style={{ minHeight: 100 }} />

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

export default DoctorProfile;
