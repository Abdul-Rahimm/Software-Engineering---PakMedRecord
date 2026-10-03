import { useState } from 'react';
import { FiCheck, FiExternalLink, FiHome, FiLogOut, FiPlus, FiUserPlus, FiUsers, FiX } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch } from '../../lib/data';
import { apiError, formatCNIC, maskCNIC, parseCNIC } from '../../lib/format';
import { Avatar, Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import PracticeStats from '../../ui/PracticeStats';
import PaymentAccountCard from '../../ui/PaymentAccountCard';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const Clinic = () => {
  const { cnic, profile, reloadProfile } = useShell();
  const { toast, confirm } = useFeedback();
  const { data, loading, reload } = useFetch(async () => (await api.get('/clinics/mine')).data, []);
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '' });
  const [invite, setInvite] = useState('');
  const [staffOpen, setStaffOpen] = useState(false);
  const [staff, setStaff] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const call = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      if (msg) toast(msg);
      await reload(true);
      reloadProfile();
      return true;
    } catch (err) {
      toast(apiError(err), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <><PageHeader eyebrow="Clinic" title="My clinic" /><Skeleton height={300} /></>;

  if (!data.clinic) {
    return (
      <>
        <PageHeader eyebrow="Clinic" title="Set up your clinic" subtitle="Bring your clinic's doctors together with a shared front desk, one schedule and clinic-wide analytics." />
        <form className="glass card-pad-lg stack gap-16" style={{ maxWidth: 640 }} onSubmit={(e) => { e.preventDefault(); call(() => api.post('/clinics', form), 'Clinic created'); }}>
          {!profile?.isVerified && <p className="auth-notice">Get your PMDC registration verified on your Profile page first.</p>}
          <Field label="Clinic name" icon={FiHome} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Clifton Family Clinic" />
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Field label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Field label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} loading={busy} disabled={!form.name.trim() || !profile?.isVerified}><FiPlus /> Create clinic</Button>
          <p className="subtle" style={{ fontSize: 13 }}>Joining an existing clinic? Ask its admin to invite your CNIC; the invitation will appear here.</p>
        </form>
      </>
    );
  }

  const { clinic, myRole, myStatus, members } = data;
  const admin = myRole === 'admin' && myStatus === 'active';

  if (myStatus === 'invited') {
    return (
      <>
        <PageHeader eyebrow="Clinic" title="Clinic invitation" />
        <div className="glass card-pad-lg stack gap-16" style={{ maxWidth: 560 }}>
          <p>You&apos;ve been invited to join <strong>{clinic.name}</strong>{clinic.city ? `, ${clinic.city}` : ''}. Its front desk will be able to manage your appointments (not your patients&apos; records).</p>
          <div className="row gap-8">
            <Button className="btn btn-primary" loading={busy} onClick={() => call(() => api.post(`/clinics/${clinic._id}/respond`, { accept: true }), `You joined ${clinic.name}`)}><FiCheck /> Accept</Button>
            <button className="btn" onClick={() => call(() => api.post(`/clinics/${clinic._id}/respond`, { accept: false }), 'Invitation declined')}><FiX /> Decline</button>
          </div>
        </div>
      </>
    );
  }

  const removeMember = async (m) => {
    const self = m.doctorCNIC === cnic;
    if (!(await confirm({ title: self ? 'Leave this clinic?' : 'Remove this doctor?', confirmLabel: self ? 'Leave' : 'Remove', danger: true }))) return;
    call(() => api.delete(`/clinics/${clinic._id}/doctors/${m.doctorCNIC}`), self ? 'You left the clinic' : 'Doctor removed');
  };

  return (
    <>
      <PageHeader
        eyebrow="Clinic"
        title={clinic.name}
        subtitle={[clinic.address, clinic.city, clinic.phone].filter(Boolean).join(' · ') || 'Your clinic'}
        actions={<a className="btn" href="/desk/signin" target="_blank" rel="noreferrer"><FiExternalLink /> Front-desk sign-in</a>}
      />
      <div className="grid grid-2" style={{ alignItems: 'start', marginBottom: 24 }}>
        <section className="glass card-pad-lg stack gap-16">
          <h2 className="section-title row gap-8"><FiUsers /> Doctors</h2>
          {members.map((m) => (
            <div key={m.doctorCNIC} className="item-row">
              <Avatar first={m.doctor?.firstName} last={m.doctor?.lastName} seed={m.doctorCNIC} size={38} />
              <div className="grow" style={{ minWidth: 0 }}>
                <strong className="truncate">{m.doctor ? `Dr. ${m.doctor.firstName} ${m.doctor.lastName}` : formatCNIC(m.doctorCNIC)}</strong>
                <div className="subtle" style={{ fontSize: 12.5 }}>{m.doctor?.specialization} · {m.role === 'admin' ? 'Admin' : 'Doctor'}{m.status === 'invited' ? ' · invited' : ''}</div>
              </div>
              {(admin || m.doctorCNIC === cnic) && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeMember(m)} aria-label="Remove">{m.doctorCNIC === cnic ? <FiLogOut /> : <FiX />}</button>}
            </div>
          ))}
          {admin && (
            <form className="row gap-8" onSubmit={async (e) => { e.preventDefault(); if (await call(() => api.post(`/clinics/${clinic._id}/invite`, { doctorCNIC: parseCNIC(invite) }), 'Invitation sent')) setInvite(''); }}>
              <input className="input mono grow" placeholder="Doctor's CNIC" value={invite} onChange={(e) => setInvite(maskCNIC(e.target.value))} aria-label="Doctor CNIC to invite" />
              <button className="btn" disabled={parseCNIC(invite).length !== 13}><FiUserPlus /> Invite</button>
            </form>
          )}
        </section>
        {admin && (
          <section className="glass card-pad-lg stack gap-16">
            <div className="row between"><h2 className="section-title">Front-desk staff</h2><button className="btn btn-sm btn-primary" onClick={() => { setStaff({ name: '', email: '', password: '' }); setStaffOpen(true); }}><FiPlus /> Add</button></div>
            {!data.staff.length ? <EmptyState icon={FiUsers} title="No staff yet">Receptionists get their own login to book walk-ins, check patients in and record payments. They can&apos;t see medical records.</EmptyState> : data.staff.map((s) => (
              <div key={s._id} className="item-row">
                <div className="grow"><strong>{s.name}</strong><div className="subtle" style={{ fontSize: 12.5 }}>{s.email}{s.disabled ? ' · disabled' : ''}</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => call(() => api.patch(`/clinics/${clinic._id}/staff/${s._id}`, { disabled: !s.disabled }), s.disabled ? 'Enabled' : 'Disabled')}>{s.disabled ? 'Enable' : 'Disable'}</button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={async () => { if (await confirm({ title: `Remove ${s.name}?`, confirmLabel: 'Remove', danger: true })) call(() => api.patch(`/clinics/${clinic._id}/staff/${s._id}`, { remove: true }), 'Removed'); }} aria-label="Remove staff"><FiX /></button>
              </div>
            ))}
          </section>
        )}
      </div>
      {admin && <div style={{ marginBottom: 24 }}><PaymentAccountCard path={`/payments/account/clinic/${clinic._id}`} owner="the clinic's Safepay account" /></div>}
      {admin && <PracticeStats path={`/analytics/clinic/${clinic._id}`} title="Clinic performance" extra={(d) => d.perDoctor?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Doctor</th><th>Completed</th><th>Patients</th><th>No-show rate</th><th>Fees collected</th></tr></thead>
            <tbody>{d.perDoctor.map((r) => <tr key={r.doctorCNIC}><td><strong>{r.name}</strong><div className="subtle" style={{ fontSize: 12 }}>{r.specialization}</div></td><td>{r.completed}</td><td>{r.patients}</td><td>{r.noShowRate == null ? '—' : `${r.noShowRate}%`}</td><td>Rs {r.revenue.toLocaleString('en-PK')}</td></tr>)}</tbody>
          </table>
        </div>
      )} />}
      <Modal open={staffOpen} onClose={() => setStaffOpen(false)} title="Add front-desk staff" subtitle="They sign in at /desk with this email and password." width={480}>
        <div className="stack gap-16">
          <Field label="Name" value={staff.name} onChange={(e) => setStaff({ ...staff, name: e.target.value })} />
          <Field label="Email" type="email" value={staff.email} onChange={(e) => setStaff({ ...staff, email: e.target.value })} />
          <Field label="Password" type="password" autoComplete="new-password" value={staff.password} onChange={(e) => setStaff({ ...staff, password: e.target.value })} hint="At least 8 characters" />
          <Button className="btn btn-primary btn-block" loading={busy} disabled={!staff.name || !staff.email || staff.password.length < 8} onClick={async () => { if (await call(() => api.post(`/clinics/${clinic._id}/staff`, staff), 'Staff account created')) setStaffOpen(false); }}>Create account</Button>
        </div>
      </Modal>
    </>
  );
};

export default Clinic;
