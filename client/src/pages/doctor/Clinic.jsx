import { useState } from 'react';
import { FiCheck, FiChevronLeft, FiClock, FiHome, FiLogOut, FiMapPin, FiPlus, FiSettings, FiX } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch } from '../../lib/data';
import { apiError } from '../../lib/format';
import { Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import BranchHours from '../../ui/BranchHours';
import { useFeedback } from '../../ui/Feedback';
import OrgManager, { PROVINCES } from '../org/OrgManager';
import '../dashboard.css';

const statusBadge = (org) => {
  const s = org?.verification?.status;
  if (s === 'verified') return null;
  return <span className="badge badge-amber">{s === 'pending' ? 'Verification pending' : 'Not verified'}</span>;
};

// A doctor's hospitals: where they practise (many), invitations, hours at each, and the console
// for any organization they administer. They can also set up their own clinic.
const Clinic = () => {
  const { profile, reloadProfile } = useShell();
  const { toast, confirm } = useFeedback();
  const { data, loading, reload } = useFetch(async () => (await api.get('/orgs/mine')).data, []);
  const [managing, setManaging] = useState(null);
  const [hoursFor, setHoursFor] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', province: '', address: '', phone: '' });
  const [busy, setBusy] = useState(false);

  const call = async (fn, msg) => {
    setBusy(true);
    try {
      const r = await fn();
      toast(msg || r.data?.message || 'Saved');
      await reload(true);
      reloadProfile();
      return r;
    } catch (err) {
      toast(apiError(err), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <><PageHeader eyebrow="Practice" title="My hospitals" /><Skeleton height={300} /></>;

  const list = data.memberships;
  if (managing) {
    const m = list.find((x) => String(x.orgId) === managing);
    return (
      <>
        <PageHeader eyebrow="Administration" title={m?.org?.name || 'Organization'} actions={<button className="btn" onClick={() => setManaging(null)}><FiChevronLeft /> My hospitals</button>} />
        <OrgManager orgId={managing} initialTab="doctors" />
      </>
    );
  }

  const invites = list.filter((m) => m.status === 'invited');
  const active = list.filter((m) => m.status === 'active');

  return (
    <>
      <PageHeader
        eyebrow="Practice"
        title="My hospitals"
        subtitle="Every hospital and clinic where you see patients. Each one has its own branches, hours and fee."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)} disabled={!profile?.isVerified}><FiPlus /> Set up my own clinic</button>}
      />
      <div className="glass card-pad row between wrap gap-12" style={{ marginBottom: 20 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <strong>Travel time between hospitals</strong>
          <div className="subtle" style={{ fontSize: 13 }}>Patients can&apos;t book you at one place too soon after a visit somewhere else on the same day.</div>
        </div>
        <select className="select" style={{ width: 150 }} value={profile?.travelBufferMinutes || 0} aria-label="Travel time" onChange={(e) => call(() => api.put(`/doctor/update/${profile.doctorCNIC}`, { travelBufferMinutes: Number(e.target.value) }), 'Travel time saved')}>
          {[0, 15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m ? `${m} minutes` : 'None'}</option>)}
        </select>
      </div>
      {!profile?.isVerified && <p className="auth-notice" style={{ marginBottom: 20 }}>Get your PMDC registration verified on your Profile page before joining or creating a hospital.</p>}

      {invites.length > 0 && (
        <section className="stack gap-12" style={{ marginBottom: 24 }}>
          <h2 className="section-title">Invitations</h2>
          {invites.map((m) => (
            <div key={m._id} className="glass card-pad row between wrap gap-12">
              <div style={{ minWidth: 0 }}>
                <strong>{m.org?.name}</strong> {statusBadge(m.org)}
                <div className="subtle" style={{ fontSize: 13 }}>{m.facilities.filter((f) => m.facilityIds.includes(f._id)).map((f) => f.name).join(', ')}{m.fee ? ` · Rs ${m.fee}` : ''}</div>
                <div className="subtle" style={{ fontSize: 12.5 }}>Its front desk will manage your appointments there. It can&apos;t see your patients&apos; records.</div>
              </div>
              <div className="row gap-8">
                <Button className="btn btn-primary" loading={busy} disabled={!profile?.isVerified} onClick={() => call(() => api.post(`/orgs/${m.orgId}/membership/respond`, { accept: true }))}><FiCheck /> Accept</Button>
                <button className="btn" onClick={() => call(() => api.post(`/orgs/${m.orgId}/membership/respond`, { accept: false }))}><FiX /> Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {!active.length ? (
        <div className="glass"><EmptyState icon={FiHome} title="Not part of a hospital yet">Hospitals invite you using your CNIC or PMDC number, and invitations appear here. You can also set up your own clinic. Your private-practice hours stay under Clinic hours.</EmptyState></div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          {active.map((m) => {
            const branches = m.facilities.filter((f) => m.facilityIds.includes(f._id));
            const admin = m.roles.includes('org_admin');
            const hours = m.availability?.blocks || [];
            return (
              <section key={m._id} className="glass card-pad-lg stack gap-12">
                <div className="row between wrap gap-8">
                  <h2 className="section-title">{m.org?.name}</h2>
                  <div className="row gap-4">{admin && <span className="badge badge-cyan">Admin</span>}{statusBadge(m.org)}</div>
                </div>
                <div className="stack gap-4">
                  {branches.map((f) => (
                    <div key={f._id} className="row gap-8 subtle" style={{ fontSize: 13.5 }}><FiMapPin /> {f.name}{f.city ? `, ${f.city}` : ''} · {hours.filter((b) => b.facilityId === f._id).length ? `${new Set(hours.filter((b) => b.facilityId === f._id).map((b) => b.day)).size} days a week` : 'no hours yet'}</div>
                  ))}
                </div>
                {m.fee ? <div className="subtle" style={{ fontSize: 13.5 }}>Fee here: Rs {m.fee.toLocaleString('en-PK')}</div> : null}
                {!hours.length && <p className="auth-notice" style={{ fontSize: 13 }}><FiClock /> Set your hours so patients can book you here.</p>}
                <div className="row gap-8 wrap">
                  <button className="btn btn-sm" onClick={() => setHoursFor(m)}><FiClock /> My hours here</button>
                  {admin && <button className="btn btn-sm btn-primary" onClick={() => setManaging(String(m.orgId))}><FiSettings /> Manage</button>}
                  <button className="btn btn-sm btn-ghost" onClick={async () => { if (await confirm({ title: `Leave ${m.org?.name}?`, message: 'Patients will no longer be able to book you there. Existing appointments stay.', confirmLabel: 'Leave', danger: true })) call(() => api.delete(`/orgs/${m.orgId}/membership`)); }}><FiLogOut /> Leave</button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(hoursFor)} onClose={() => setHoursFor(null)} title={`My hours at ${hoursFor?.org?.name || ''}`} subtitle="Patients can only book these times at these branches." width={620}>
        {hoursFor && <BranchHours facilities={hoursFor.facilities.filter((f) => hoursFor.facilityIds.includes(f._id))} value={hoursFor.availability} saving={busy} onSave={async (a) => { if (await call(() => api.put(`/orgs/${hoursFor.orgId}/membership/hours`, a))) setHoursFor(null); }} />}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title="Set up your own clinic" subtitle="You become its administrator: add branches, invite other doctors and front-desk staff." width={520}>
        <form className="stack gap-16" onSubmit={async (e) => { e.preventDefault(); const r = await call(() => api.post('/orgs', form)); if (r) { setCreating(false); setManaging(String(r.data.org._id)); } }}>
          <Field label="Clinic name" icon={FiHome} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Clifton Family Clinic" />
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Field as="select" label="Province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}><option value="">Choose</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</Field>
          </div>
          <Field label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Field label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button className="btn btn-primary btn-block" loading={busy} disabled={!form.name.trim()}>Create clinic</Button>
          <p className="subtle" style={{ fontSize: 12.5 }}>A large hospital? Its management can register at <span className="mono">/hospitals/register</span> with their own administrator account.</p>
        </form>
      </Modal>
    </>
  );
};

export default Clinic;
