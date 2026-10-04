import { useState } from 'react';
import {
  FiActivity, FiAlertTriangle, FiShield, FiCalendar, FiCheckCircle, FiClock, FiCreditCard, FiEdit2, FiGrid, FiLayers, FiMapPin, FiPlus, FiSettings, FiUploadCloud, FiUserPlus, FiUsers, FiX,
} from 'react-icons/fi';
import api from '../../api';
import { useFetch } from '../../lib/data';
import { apiError, formatCNIC, parseCNIC } from '../../lib/format';
import { Avatar, Button, EmptyState, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import BranchHours from '../../ui/BranchHours';
import PaymentAccountCard from '../../ui/PaymentAccountCard';
import PracticeStats from '../../ui/PracticeStats';
import { useFeedback } from '../../ui/Feedback';
import DeskBoard from './DeskBoard';

export const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Kashmir'];
export const ORG_TYPES = [['hospital', 'Hospital'], ['clinic', 'Clinic'], ['lab', 'Laboratory'], ['diagnostic', 'Diagnostic centre']];
const STAFF_ROLES = [['org_admin', 'Administrator', 'Everything: branches, doctors, staff, payments'], ['facility_admin', 'Branch manager', 'Front desk and schedules at their branches'], ['reception', 'Receptionist', 'Front desk at their branches'], ['billing', 'Billing', 'Payments and reports']];
const roleLabel = (r) => STAFF_ROLES.find((x) => x[0] === r)?.[1] || r;

// Runs fn, shows its message or error, then reloads
const useCall = (reload) => {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const call = async (fn, msg) => {
    setBusy(true);
    try {
      const r = await fn();
      toast(msg || r?.data?.message || 'Saved');
      await reload?.(true);
      return r || true;
    } catch (err) {
      toast(apiError(err), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return [call, busy];
};

export const VerificationBanner = ({ org, go }) => {
  const s = org.verification?.status || 'unverified';
  if (s === 'verified') return null;
  const text = {
    unverified: 'Patients can’t find or book you yet. Upload your healthcare commission registration to get verified.',
    pending: 'Your registration is being reviewed. Patients will be able to find you once it’s verified (usually within two working days).',
    rejected: `Verification was not approved: ${org.verification?.note || ''} Upload a clearer document.`,
  }[s];
  return (
    <div className="auth-notice row between wrap gap-12" style={s === 'pending' ? { borderColor: 'rgba(34,211,238,.35)', background: 'rgba(34,211,238,.07)' } : undefined}>
      <span className="row gap-8"><FiAlertTriangle /> {text}</span>
      {s !== 'pending' && go && <button className="btn btn-sm" onClick={() => go('setup')}><FiUploadCloud /> Verify now</button>}
    </div>
  );
};

// ---------- profile & verification ----------
const SetupTab = ({ ov, reload }) => {
  const { org } = ov;
  const [form, setForm] = useState(() => ({ name: org.name, type: org.type, registrationNo: org.registrationNo || '', regulator: org.regulator || '', city: org.city || '', province: org.province || '', address: org.address || '', phone: org.phone || '', email: org.email || '', website: org.website || '', about: org.about || '' }));
  const [file, setFile] = useState(null);
  const [call, busy] = useCall(reload);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const status = org.verification?.status || 'unverified';
  const upload = () => call(() => api.post(`/orgs/${org._id}/verification`, file, { headers: { 'Content-Type': 'application/octet-stream', 'X-Registration-No': form.registrationNo, 'X-File-Name': encodeURIComponent(file.name) } }));
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <form className="glass card-pad-lg stack gap-16" onSubmit={(e) => { e.preventDefault(); call(() => api.put(`/orgs/${org._id}`, form)); }}>
        <h2 className="section-title">Profile</h2>
        <Field label="Name" value={form.name} onChange={set('name')} />
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field as="select" label="Type" value={form.type} onChange={set('type')}>{ORG_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Field>
          <Field as="select" label="Province" value={form.province} onChange={set('province')}><option value="">Choose</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</Field>
          <Field label="City" value={form.city} onChange={set('city')} />
          <Field label="Phone" value={form.phone} onChange={set('phone')} />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} />
          <Field label="Website" value={form.website} onChange={set('website')} />
        </div>
        <Field label="Head office address" value={form.address} onChange={set('address')} />
        <Field as="textarea" label="About (shown to patients)" value={form.about} onChange={set('about')} maxLength={800} />
        <Button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} loading={busy}>Save profile</Button>
      </form>
      <section className="glass card-pad-lg stack gap-16">
        <div className="row between wrap gap-8">
          <h2 className="section-title">Verification</h2>
          <span className={`badge ${status === 'verified' ? 'badge-green' : status === 'pending' ? 'badge-cyan' : 'badge-amber'}`}>{status === 'verified' ? <><FiCheckCircle /> Verified</> : status === 'pending' ? 'Under review' : status === 'rejected' ? 'Not approved' : 'Not verified'}</span>
        </div>
        <p className="subtle" style={{ fontSize: 13.5 }}>PakMedRecord checks every hospital and clinic against its healthcare commission registration (e.g. PHC, SHCC, KP HCC, IHRA) before patients can see it.</p>
        {status === 'rejected' && org.verification?.note && <p className="auth-notice">{org.verification.note}</p>}
        {status !== 'verified' && (
          <>
            <div className="grid grid-2" style={{ gap: 14 }}>
              <Field label="Registration / licence no." value={form.registrationNo} onChange={set('registrationNo')} />
              <Field label="Regulator" value={form.regulator} onChange={set('regulator')} placeholder="e.g. Sindh Healthcare Commission" />
            </div>
            <label className="upload-drop">
              <FiUploadCloud size={22} />
              <span>{file ? file.name : 'Registration certificate (PDF or photo, up to 4 MB)'}</span>
              <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <Button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} loading={busy} disabled={!file || form.registrationNo.trim().length < 3} onClick={upload}>{status === 'pending' ? 'Replace document' : 'Submit for verification'}</Button>
          </>
        )}
        {status === 'verified' && <p className="subtle">Registration {org.registrationNo}. Changing the registration number sends it back for review.</p>}
        <div className="auth-notice" style={{ borderColor: 'var(--border)', background: 'var(--tint-1)' }}>
          <FiShield /> <span>Administrators: verify your own identity with your CNIC and a live face check. It speeds up approval. <a href="/verify-identity">Verify my identity</a></span>
        </div>
      </section>
    </div>
  );
};

// ---------- branches & departments ----------
const emptyBranch = { name: '', city: '', district: '', province: '', address: '', phone: '' };
const BranchesTab = ({ ov, reload }) => {
  const { org, facilities, departments } = ov;
  const [edit, setEdit] = useState(null); // branch being added/edited
  const [dept, setDept] = useState({ name: '', facilityId: '' });
  const [call, busy] = useCall(reload);
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  const saveBranch = async () => {
    const body = { name: edit.name, city: edit.city, district: edit.district, province: edit.province, address: edit.address, phone: edit.phone };
    if (await call(() => (edit._id ? api.put(`/orgs/${org._id}/facilities/${edit._id}`, body) : api.post(`/orgs/${org._id}/facilities`, body)), edit._id ? 'Branch saved' : 'Branch added')) setEdit(null);
  };
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <section className="glass card-pad-lg stack gap-16">
        <div className="row between"><h2 className="section-title row gap-8"><FiMapPin /> Branches</h2><button className="btn btn-sm btn-primary" onClick={() => setEdit({ ...emptyBranch, city: org.city, province: org.province })}><FiPlus /> Add branch</button></div>
        {facilities.map((f) => (
          <div key={f._id} className="item-row" style={f.active ? undefined : { opacity: 0.55 }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <strong data-no-translate>{f.name}</strong>{!f.active && <span className="badge" style={{ marginInlineStart: 8 }}>Closed</span>}
              <div className="subtle" style={{ fontSize: 12.5 }}>{[f.address, f.city, f.province].filter(Boolean).join(', ') || 'No address yet'}</div>
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEdit({ ...emptyBranch, ...f })} aria-label="Edit branch"><FiEdit2 /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => call(() => api.put(`/orgs/${org._id}/facilities/${f._id}`, { active: !f.active }), f.active ? 'Branch closed' : 'Branch reopened')}>{f.active ? 'Close' : 'Reopen'}</button>
          </div>
        ))}
      </section>
      <section className="glass card-pad-lg stack gap-16">
        <h2 className="section-title row gap-8"><FiLayers /> Departments</h2>
        <p className="subtle" style={{ fontSize: 13.5 }}>Optional. Group doctors (e.g. Cardiology, Paediatrics, OPD) so patients can browse by department.</p>
        {departments.map((d) => (
          <div key={d._id} className="item-row">
            <div className="grow"><strong>{d.name}</strong><div className="subtle" style={{ fontSize: 12.5 }}>{facilities.find((f) => f._id === d.facilityId)?.name || 'All branches'}</div></div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => call(() => api.delete(`/orgs/${org._id}/departments/${d._id}`), 'Department removed')} aria-label="Remove department"><FiX /></button>
          </div>
        ))}
        <form className="row gap-8 wrap" onSubmit={async (e) => { e.preventDefault(); if (await call(() => api.post(`/orgs/${org._id}/departments`, { name: dept.name, facilityId: dept.facilityId || undefined }), 'Department added')) setDept({ name: '', facilityId: '' }); }}>
          <input className="input grow" placeholder="Department name" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} aria-label="Department name" style={{ minWidth: 160 }} />
          <select className="select" style={{ width: 170 }} value={dept.facilityId} onChange={(e) => setDept({ ...dept, facilityId: e.target.value })} aria-label="Branch">
            <option value="">All branches</option>{facilities.filter((f) => f.active).map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
          <button className="btn" disabled={!dept.name.trim()}><FiPlus /> Add</button>
        </form>
      </section>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit branch' : 'New branch'} width={520}>
        {edit && (
          <div className="stack gap-16">
            <Field label="Branch name" value={edit.name} onChange={set('name')} placeholder="e.g. Clifton Campus" />
            <div className="grid grid-2" style={{ gap: 14 }}>
              <Field label="City" value={edit.city} onChange={set('city')} />
              <Field label="District" value={edit.district} onChange={set('district')} />
              <Field as="select" label="Province" value={edit.province} onChange={set('province')}><option value="">Choose</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</Field>
              <Field label="Phone" value={edit.phone} onChange={set('phone')} />
            </div>
            <Field label="Address" value={edit.address} onChange={set('address')} />
            <Button className="btn btn-primary btn-block" loading={busy} disabled={!edit.name.trim()} onClick={saveBranch}>Save branch</Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ---------- doctors ----------
const DoctorsTab = ({ ov, reload: reloadOv }) => {
  const { org, facilities, departments } = ov;
  const open = facilities.filter((f) => f.active);
  const { data, loading, reload } = useFetch(async () => (await api.get(`/orgs/${org._id}/doctors`)).data, [org._id]);
  const reloadAll = async () => { await reload(true); reloadOv(true); };
  const [call, busy] = useCall(reloadAll);
  const { confirm } = useFeedback();
  const [invite, setInvite] = useState(null);
  const [edit, setEdit] = useState(null);
  const [hours, setHours] = useState(null);

  const sendInvite = async () => {
    const isCnic = /^[\d-]+$/.test(invite.id.trim()) && parseCNIC(invite.id).length === 13;
    const body = { ...(isCnic ? { doctorCNIC: parseCNIC(invite.id) } : { pmdcNumber: invite.id.trim() }), facilityIds: invite.facilityIds, departmentId: invite.departmentId || undefined, fee: invite.fee };
    if (await call(() => api.post(`/orgs/${org._id}/doctors`, body))) setInvite(null);
  };
  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const branchPicker = (value, onChange) => (
    <div className="field">
      <span className="field-label">Branches</span>
      <div className="chips">{open.map((f) => <button type="button" key={f._id} className="chip" aria-pressed={value.includes(f._id)} onClick={() => onChange(toggle(value, f._id))}>{f.name}</button>)}</div>
    </div>
  );

  if (loading) return <Skeleton height={240} />;
  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row between wrap gap-8">
        <h2 className="section-title row gap-8"><FiUsers /> Doctors</h2>
        <button className="btn btn-primary btn-sm" disabled={org.verification?.status !== 'verified'} onClick={() => setInvite({ id: '', facilityIds: open.length === 1 ? [open[0]._id] : [], departmentId: '', fee: '' })}><FiUserPlus /> Invite doctor</button>
      </div>
      {org.verification?.status !== 'verified' && <p className="subtle" style={{ fontSize: 13 }}>You can invite doctors once PakMedRecord has verified your registration (Settings tab). This stops fake hospitals from looking doctors up.</p>}
      {!data.length ? <EmptyState icon={FiUsers} title="No doctors yet">Invite doctors by CNIC or PMDC number. They accept from their own account, then you set where and when they see patients.</EmptyState> : data.map((m) => {
        const noHours = m.status === 'active' && !(m.availability?.blocks || []).length;
        return (
          <div key={m._id} className="item-row wrap">
            <Avatar first={m.doctor?.firstName} last={m.doctor?.lastName} seed={m.doctorCNIC} size={38} />
            <div className="grow" style={{ minWidth: 180 }}>
              <strong className="truncate">{m.doctor ? `Dr. ${m.doctor.firstName} ${m.doctor.lastName}` : formatCNIC(m.doctorCNIC)}</strong>
              <div className="subtle" style={{ fontSize: 12.5 }}>
                {[m.doctor?.specialization, departments.find((d) => d._id === m.departmentId)?.name, (m.facilityIds || []).map((id) => facilities.find((f) => f._id === id)?.name).filter(Boolean).join(', '), m.fee ? `Rs ${m.fee}` : null].filter(Boolean).join(' · ')}
              </div>
              <div className="row gap-4 wrap" style={{ marginTop: 4 }}>
                {m.status === 'invited' && <span className="badge badge-amber">Invited</span>}
                {m.roles.includes('org_admin') && <span className="badge badge-cyan">Admin</span>}
                {noHours && <span className="badge badge-amber"><FiClock /> No hours set</span>}
              </div>
            </div>
            <div className="row gap-4">
              {m.status === 'active' && <button className="btn btn-sm" onClick={() => setHours(m)}><FiClock /> Hours</button>}
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEdit({ ...m, fee: m.fee ?? '', departmentId: m.departmentId || '', facilityIds: (m.facilityIds || []).map(String), admin: m.roles.includes('org_admin') })} aria-label="Edit"><FiEdit2 /></button>
              <button className="btn btn-ghost btn-sm btn-icon" aria-label="Remove" onClick={async () => { if (await confirm({ title: m.status === 'invited' ? 'Cancel this invitation?' : 'Remove this doctor?', message: 'Their existing appointments here stay as they are.', confirmLabel: 'Remove', danger: true })) call(() => api.put(`/orgs/${org._id}/doctors/${m.doctorCNIC}`, { status: 'removed' })); }}><FiX /></button>
            </div>
          </div>
        );
      })}

      <Modal open={Boolean(invite)} onClose={() => setInvite(null)} title="Invite a doctor" subtitle="The doctor must already have a PakMedRecord doctor account." width={520}>
        {invite && (
          <div className="stack gap-16">
            <Field label="Doctor's CNIC or PMDC number" className="mono-input" value={invite.id} onChange={(e) => setInvite({ ...invite, id: e.target.value })} placeholder="42101-1234567-1 or 12345-P" />
            {branchPicker(invite.facilityIds, (v) => setInvite({ ...invite, facilityIds: v }))}
            <div className="grid grid-2" style={{ gap: 14 }}>
              <Field as="select" label="Department" value={invite.departmentId} onChange={(e) => setInvite({ ...invite, departmentId: e.target.value })}><option value="">None</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</Field>
              <Field label="Consultation fee here (Rs)" type="number" min={0} value={invite.fee} onChange={(e) => setInvite({ ...invite, fee: e.target.value })} hint="Blank = doctor's usual fee" />
            </div>
            <Button className="btn btn-primary btn-block" loading={busy} disabled={invite.id.trim().length < 3 || !invite.facilityIds.length} onClick={sendInvite}>Send invitation</Button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Doctor at this organization" width={520}>
        {edit && (
          <div className="stack gap-16">
            {branchPicker(edit.facilityIds, (v) => setEdit({ ...edit, facilityIds: v }))}
            <div className="grid grid-2" style={{ gap: 14 }}>
              <Field as="select" label="Department" value={edit.departmentId} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value })}><option value="">None</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</Field>
              <Field label="Fee here (Rs)" type="number" min={0} value={edit.fee} onChange={(e) => setEdit({ ...edit, fee: e.target.value })} />
            </div>
            <label className="row between gap-12"><span>Administrator of {org.name}</span><input type="checkbox" className="switch" checked={edit.admin} onChange={(e) => setEdit({ ...edit, admin: e.target.checked })} /></label>
            <Button className="btn btn-primary btn-block" loading={busy} disabled={!edit.facilityIds.length} onClick={async () => { if (await call(() => api.put(`/orgs/${org._id}/doctors/${edit.doctorCNIC}`, { facilityIds: edit.facilityIds, departmentId: edit.departmentId || null, fee: edit.fee, roles: edit.admin ? ['doctor', 'org_admin'] : ['doctor'] }))) setEdit(null); }}>Save</Button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(hours)} onClose={() => setHours(null)} title={hours?.doctor ? `Dr. ${hours.doctor.firstName} ${hours.doctor.lastName}'s hours` : 'Hours'} subtitle="Patients can book only these times, at these branches." width={620}>
        {hours && <BranchHours facilities={facilities.filter((f) => (hours.facilityIds || []).map(String).includes(f._id))} value={hours.availability} saving={busy} onSave={async (availability) => { if (await call(() => api.put(`/orgs/${org._id}/doctors/${hours.doctorCNIC}`, { availability }), 'Hours saved')) setHours(null); }} />}
      </Modal>
    </section>
  );
};

// ---------- staff ----------
const StaffTab = ({ ov }) => {
  const { org, facilities } = ov;
  const { data, loading, reload } = useFetch(async () => (await api.get(`/orgs/${org._id}/staff`)).data, [org._id]);
  const [call, busy] = useCall(reload);
  const { confirm } = useFeedback();
  const [form, setForm] = useState(null);
  if (loading) return <Skeleton height={200} />;
  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row between wrap gap-8"><h2 className="section-title row gap-8"><FiUsers /> Staff accounts</h2><button className="btn btn-sm btn-primary" onClick={() => setForm({ name: '', email: '', password: '', role: 'reception', facilityIds: [] })}><FiPlus /> Add staff</button></div>
      <p className="subtle" style={{ fontSize: 13.5 }}>Staff sign in at <span className="mono">/desk/signin</span>. They manage schedules and payments, never medical records.</p>
      {data.map((s) => (
        <div key={s._id} className="item-row wrap">
          <div className="grow" style={{ minWidth: 180 }}>
            <strong>{s.name}</strong> <span className="badge">{roleLabel(s.role)}</span>{s.disabled && <span className="badge badge-amber" style={{ marginInlineStart: 6 }}>Disabled</span>}
            <div className="subtle" style={{ fontSize: 12.5 }}>{s.email} · {s.role === 'org_admin' || !s.facilityIds?.length ? 'All branches' : s.facilityIds.map((id) => facilities.find((f) => f._id === id)?.name).filter(Boolean).join(', ')}</div>
          </div>
          <select className="select" style={{ width: 160 }} value={s.role} onChange={(e) => call(() => api.patch(`/orgs/${org._id}/staff/${s._id}`, { role: e.target.value }), 'Role changed')} aria-label="Role">
            {STAFF_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => call(() => api.patch(`/orgs/${org._id}/staff/${s._id}`, { disabled: !s.disabled }), s.disabled ? 'Enabled' : 'Disabled')}>{s.disabled ? 'Enable' : 'Disable'}</button>
          <button className="btn btn-ghost btn-sm btn-icon" aria-label="Remove staff" onClick={async () => { if (await confirm({ title: `Remove ${s.name}?`, confirmLabel: 'Remove', danger: true })) call(() => api.patch(`/orgs/${org._id}/staff/${s._id}`, { remove: true }), 'Removed'); }}><FiX /></button>
        </div>
      ))}
      <Modal open={Boolean(form)} onClose={() => setForm(null)} title="Add a staff account" width={520}>
        {form && (
          <div className="stack gap-16">
            <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="Password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="At least 12 characters. Share it privately." />
            <div className="field">
              <span className="field-label">Role</span>
              <div className="stack gap-8">
                {STAFF_ROLES.map(([v, l, d]) => (
                  <label key={v} className="row gap-8" style={{ cursor: 'pointer' }}><input type="radio" name="staff-role" checked={form.role === v} onChange={() => setForm({ ...form, role: v })} /> <span><strong>{l}</strong> <span className="subtle" style={{ fontSize: 12.5 }}>· {d}</span></span></label>
                ))}
              </div>
            </div>
            {form.role !== 'org_admin' && facilities.length > 1 && (
              <div className="field">
                <span className="field-label">Branches (none = all)</span>
                <div className="chips">{facilities.filter((f) => f.active).map((f) => <button type="button" key={f._id} className="chip" aria-pressed={form.facilityIds.includes(f._id)} onClick={() => setForm({ ...form, facilityIds: form.facilityIds.includes(f._id) ? form.facilityIds.filter((x) => x !== f._id) : [...form.facilityIds, f._id] })}>{f.name}</button>)}</div>
              </div>
            )}
            <Button className="btn btn-primary btn-block" loading={busy} disabled={!form.name.trim() || !form.email.trim() || form.password.length < 12} onClick={async () => { if (await call(() => api.post(`/orgs/${org._id}/staff`, form))) setForm(null); }}>Create account</Button>
          </div>
        )}
      </Modal>
    </section>
  );
};

const InsightsTab = ({ ov }) => (
  <PracticeStats path={`/analytics/clinic/${ov.org._id}`} title={`${ov.org.name} performance`} extra={(d) => (
    <div className="stack gap-16">
      {d.perFacility?.length > 1 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Branch</th><th>Completed</th><th>Patients</th><th>No-show rate</th><th>Fees collected</th></tr></thead>
            <tbody>{d.perFacility.map((r) => <tr key={r.facilityId}><td><strong>{r.name}</strong></td><td>{r.completed}</td><td>{r.patients}</td><td>{r.noShowRate == null ? '—' : `${r.noShowRate}%`}</td><td>Rs {r.revenue.toLocaleString('en-PK')}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {d.perDoctor?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Doctor</th><th>Completed</th><th>Patients</th><th>No-show rate</th><th>Fees collected</th></tr></thead>
            <tbody>{d.perDoctor.map((r) => <tr key={r.doctorCNIC}><td><strong>{r.name}</strong><div className="subtle" style={{ fontSize: 12 }}>{r.specialization}</div></td><td>{r.completed}</td><td>{r.patients}</td><td>{r.noShowRate == null ? '—' : `${r.noShowRate}%`}</td><td>Rs {r.revenue.toLocaleString('en-PK')}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )} />
);

const ALL_TABS = [
  { id: 'desk', label: 'Front desk', icon: FiCalendar, roles: ['facility_admin', 'reception'] },
  { id: 'doctors', label: 'Doctors', icon: FiUsers, roles: [] },
  { id: 'branches', label: 'Branches', icon: FiMapPin, roles: [] },
  { id: 'staff', label: 'Staff', icon: FiGrid, roles: [] },
  { id: 'payments', label: 'Payments', icon: FiCreditCard, roles: ['billing'] },
  { id: 'insights', label: 'Insights', icon: FiActivity, roles: ['billing'] },
  { id: 'setup', label: 'Settings', icon: FiSettings, roles: [] },
];

// The whole organization console: used by hospital staff (/desk) and by doctors who administer one.
const OrgManager = ({ orgId, initialTab }) => {
  const { data: ov, loading, reload } = useFetch(async () => (await api.get(`/orgs/${orgId}`)).data, [orgId]);
  const tabs = ov ? ALL_TABS.filter((t) => ov.isAdmin || t.roles.some((r) => ov.roles.includes(r))) : [];
  const [tab, setTab] = useState(initialTab);
  if (loading || !ov) return <Skeleton height={320} />;
  const current = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id;
  const Panel = { desk: DeskBoard, doctors: DoctorsTab, branches: BranchesTab, staff: StaffTab, payments: ({ ov: o }) => <PaymentAccountCard path={`/payments/account/clinic/${o.org._id}`} owner={`${o.org.name}'s Safepay account`} />, insights: InsightsTab, setup: SetupTab }[current];
  return (
    <div className="stack gap-20">
      {ov.isAdmin && <VerificationBanner org={ov.org} go={setTab} />}
      {tabs.length > 1 && (
        <div className="tabs" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={current === id} className="tab" onClick={() => setTab(id)}><Icon /> {label}{current === id && <span className="tab-line" />}</button>
          ))}
        </div>
      )}
      {Panel && <Panel ov={ov} reload={reload} orgId={orgId} />}
    </div>
  );
};

export default OrgManager;
