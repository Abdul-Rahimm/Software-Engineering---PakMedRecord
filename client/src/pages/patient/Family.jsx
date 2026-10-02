import { useState } from 'react';
import { FiArrowRight, FiKey, FiPlus, FiTrash2, FiUsers } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch } from '../../lib/data';
import { switchProfile } from '../../lib/family';
import { apiError, formatCNIC, maskCNIC, parseCNIC } from '../../lib/format';
import { Avatar, Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import Segmented from '../../ui/Segmented';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const ageText = (dob) => {
  if (!dob) return '';
  const months = Math.floor((Date.now() - new Date(dob)) / (30.44 * 86400000));
  return months < 24 ? `${months} months` : `${Math.floor(months / 12)} years`;
};

const RELATIONS = ['Son', 'Daughter', 'Mother', 'Father', 'Spouse', 'Grandparent', 'Sibling', 'Other'];

const Family = () => {
  const { profile } = useShell();
  const { toast, confirm } = useFeedback();
  const { data, loading, reload } = useFetch(async () => (await api.get('/family')).data, []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ cnic: '', firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', relation: 'Son' });
  const [handover, setHandover] = useState(null);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const acting = Boolean(data?.actingFor);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/family', { ...form, cnic: parseCNIC(form.cnic) });
      toast(`${form.firstName} added`);
      setAdding(false);
      setForm({ cnic: '', firstName: '', lastName: profile?.lastName || '', gender: 'Male', dateOfBirth: '', relation: 'Son' });
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d) => {
    const ok = await confirm({ title: `Delete ${d.firstName}'s profile?`, message: 'All of their records, documents and appointments will be permanently deleted.', confirmLabel: 'Delete profile', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/family/${d.patientCNIC}`);
      toast('Profile deleted');
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  const giveLogin = async () => {
    setBusy(true);
    try {
      const { data: res } = await api.post(`/family/${handover.patientCNIC}/handover`, login);
      toast(res.message);
      setHandover(null);
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'cnic' ? maskCNIC(e.target.value) : e.target.value }));

  return (
    <>
      <PageHeader
        eyebrow="Family"
        title="Family profiles"
        subtitle="Keep your children's and parents' records under your login. Switch to a profile to see records, book appointments and track vaccines for them."
        actions={!acting && <button className="btn btn-primary" onClick={() => { setForm((f) => ({ ...f, lastName: profile?.lastName || '' })); setAdding(true); }}><FiPlus /> Add family member</button>}
      />
      {loading ? <Skeleton height={200} /> : (
        <div className="grid grid-auto">
          {data.guardian && (
            <div className={`glass card-pad stack gap-12 family-card ${!acting ? 'current' : ''}`}>
              <div className="row gap-12">
                <Avatar first={data.guardian.firstName} last={data.guardian.lastName} seed={data.guardian.patientCNIC} size={48} />
                <div className="grow"><strong>{data.guardian.firstName} {data.guardian.lastName}</strong><div className="subtle" style={{ fontSize: 13 }}>You · {ageText(data.guardian.dateOfBirth)}</div></div>
              </div>
              {acting ? <button className="btn btn-sm" onClick={() => switchProfile(data.guardian.patientCNIC)}>Switch back to me <FiArrowRight /></button> : <span className="badge badge-green" style={{ alignSelf: 'flex-start' }}>Current profile</span>}
            </div>
          )}
          {data.dependents.map((d) => (
            <div key={d.patientCNIC} className={`glass card-pad stack gap-12 family-card ${data.actingFor === d.patientCNIC ? 'current' : ''}`}>
              <div className="row gap-12">
                <Avatar first={d.firstName} last={d.lastName} seed={d.patientCNIC} size={48} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <strong className="truncate">{d.firstName} {d.lastName}</strong>
                  <div className="subtle" style={{ fontSize: 13 }}>{d.relation || 'Family'} · {ageText(d.dateOfBirth)}{d.bloodGroup ? ` · ${d.bloodGroup}` : ''}</div>
                  <div className="subtle mono" style={{ fontSize: 11.5 }}>{formatCNIC(d.patientCNIC)}</div>
                </div>
              </div>
              <div className="row gap-8 wrap">
                {data.actingFor === d.patientCNIC
                  ? <span className="badge badge-green">Current profile</span>
                  : <button className="btn btn-primary btn-sm" onClick={() => switchProfile(d.patientCNIC)}>Open profile <FiArrowRight /></button>}
                {!acting && <button className="btn btn-ghost btn-sm" onClick={() => { setHandover(d); setLogin({ email: '', password: '' }); }} title="Give them their own login"><FiKey /> Own login</button>}
                {!acting && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(d)} aria-label={`Delete ${d.firstName}`}><FiTrash2 /></button>}
              </div>
            </div>
          ))}
          {!data.dependents.length && (
            <div className="glass" style={{ gridColumn: '1 / -1' }}>
              <EmptyState icon={FiUsers} title="No family members yet" action={<button className="btn btn-primary" onClick={() => setAdding(true)}><FiPlus /> Add family member</button>}>
                Add a child with their B-Form number, or an elderly parent with their CNIC.
              </EmptyState>
            </div>
          )}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a family member" subtitle="They won't need their own login. You can give them one later." width={560}>
        <form className="stack gap-16" onSubmit={add}>
          <Field label="B-Form or CNIC number" placeholder="42101-1234567-1" inputMode="numeric" value={form.cnic} onChange={set('cnic')} hint="Children: the 13-digit number on their NADRA B-Form" className="mono-input" />
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label="First name" value={form.firstName} onChange={set('firstName')} />
            <Field label="Last name" value={form.lastName} onChange={set('lastName')} />
          </div>
          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} />
            <Field as="select" label="Relation" value={form.relation} onChange={set('relation')}>
              {RELATIONS.map((r) => <option key={r}>{r}</option>)}
            </Field>
          </div>
          <div className="field">
            <span className="field-label">Gender</span>
            <Segmented id="fam-g" value={form.gender} onChange={(g) => setForm((f) => ({ ...f, gender: g }))} options={['Male', 'Female', 'Other'].map((g) => ({ value: g, label: g }))} />
          </div>
          <Button className="btn btn-primary btn-block" loading={busy} disabled={parseCNIC(form.cnic).length !== 13 || !form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth}>Add {form.firstName || 'family member'}</Button>
        </form>
      </Modal>

      <Modal open={Boolean(handover)} onClose={() => setHandover(null)} title={handover && `Give ${handover.firstName} their own login`} subtitle="They'll sign in with their CNIC and this password. The profile moves out of your family list." width={500}>
        <div className="stack gap-16">
          <Field label="Their email" type="email" value={login.email} onChange={(e) => setLogin((l) => ({ ...l, email: e.target.value }))} />
          <Field label="Temporary password" type="password" autoComplete="new-password" value={login.password} onChange={(e) => setLogin((l) => ({ ...l, password: e.target.value }))} hint="At least 8 characters. Ask them to change it after signing in." />
          <Button className="btn btn-primary btn-block" loading={busy} disabled={!login.email || login.password.length < 8} onClick={giveLogin}>Create login</Button>
        </div>
      </Modal>
    </>
  );
};

export default Family;
