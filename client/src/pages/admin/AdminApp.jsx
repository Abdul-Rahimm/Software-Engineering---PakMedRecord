import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiActivity, FiAlertOctagon, FiCheck, FiCopy, FiFlag, FiKey, FiLogOut, FiSearch, FiShield, FiUserCheck, FiUsers, FiX,
} from 'react-icons/fi';
import api from '../../api';
import { clearSession, getSession } from '../../session';
import Logo from '../../ui/Logo';
import Modal from '../../ui/Modal';
import PdfPreview from '../../ui/PdfPreview';
import { Button, CountUp, EmptyState, Skeleton, Spinner } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';
import { ThemeToggle } from '../../ui/Theme';
import { LangToggle } from '../../lib/i18n';
import { useFetch } from '../../lib/data';
import { apiError, formatCNIC, formatDate, formatDateTime } from '../../lib/format';
import '../dashboard.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: FiActivity },
  { id: 'doctors', label: 'Doctor verification', icon: FiUserCheck },
  { id: 'users', label: 'Accounts', icon: FiUsers },
  { id: 'reports', label: 'Reports', icon: FiFlag },
  { id: 'partners', label: 'Partners', icon: FiKey },
  { id: 'errors', label: 'Errors', icon: FiAlertOctagon },
];

const Stat = ({ label, value, tone }) => (
  <div className="glass card-pad stack gap-8">
    <span className="subtle" style={{ fontSize: 13 }}>{label}</span>
    <strong style={{ fontSize: 30, color: tone }}>{value == null ? '—' : <CountUp value={value} />}</strong>
  </div>
);

const Overview = ({ go }) => {
  const { data } = useFetch(async () => (await api.get('/admin/stats')).data, []);
  if (!data) return <Skeleton height={300} />;
  return (
    <div className="stack gap-20">
      {(data.pendingDoctors > 0 || data.openReports > 0) && (
        <div className="row gap-12 wrap">
          {data.pendingDoctors > 0 && <button className="btn btn-primary" onClick={() => go('doctors')}><FiUserCheck /> {data.pendingDoctors} doctor{data.pendingDoctors > 1 ? 's' : ''} waiting for verification</button>}
          {data.openReports > 0 && <button className="btn" onClick={() => go('reports')}><FiFlag /> {data.openReports} open report{data.openReports > 1 ? 's' : ''}</button>}
        </div>
      )}
      <div className="grid grid-auto">
        <Stat label="Patients" value={data.patients} />
        <Stat label="Doctors" value={data.doctors} />
        <Stat label="New patients (30 days)" value={data.newPatients} />
        <Stat label="New doctors (30 days)" value={data.newDoctors} />
        <Stat label="Records" value={data.records} />
        <Stat label="Appointments" value={data.appointments} />
        <Stat label="Prescriptions" value={data.prescriptions} />
        <Stat label="Clinics" value={data.clinics} />
        <Stat label="Uploaded files" value={data.files} />
        <Stat label="Database size (MB)" value={data.storageMB} tone={data.storageMB > 400 ? 'var(--amber)' : undefined} />
        <Stat label="Server errors (24h)" value={data.errorsToday} tone={data.errorsToday ? 'var(--rose-text)' : undefined} />
      </div>
      {data.storageMB > 400 && <p className="auth-notice"><FiAlertOctagon /> The database is close to the 512 MB free-tier limit. Upgrade the Atlas cluster before it fills up.</p>}
    </div>
  );
};

const VerificationTab = () => {
  const { toast } = useFeedback();
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const { data, loading, reload } = useFetch(async () => (await api.get('/admin/doctors', { params: { status, q: q || undefined } })).data, [status, q]);
  const [doc, setDoc] = useState(null); // { doctor, url, mime }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const open = async (doctor) => {
    setNote('');
    setDoc({ doctor, url: null });
    if (!doctor.verification?.document?.name) return;
    try {
      const res = await api.get(`/admin/doctors/${doctor.doctorCNIC}/document`, { responseType: 'blob' });
      setDoc({ doctor, url: URL.createObjectURL(res.data), mime: res.data.type });
    } catch {
      toast('Could not load the document', 'error');
    }
  };

  const decide = async (decision) => {
    setBusy(true);
    try {
      await api.post(`/admin/doctors/${doc.doctor.doctorCNIC}/review`, { decision, note });
      toast(decision === 'verified' ? 'Doctor verified' : 'Doctor rejected');
      setDoc(null);
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-16">
      <div className="row between wrap gap-12">
        <div className="chips">
          {['pending', 'unverified', 'rejected', 'verified', 'all'].map((s) => <button key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}
        </div>
        <div className="search input-wrap"><FiSearch size={16} /><input className="input" placeholder="Name, email, PMDC no. or CNIC" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {loading ? <Skeleton height={200} /> : !data.length ? (
        <div className="glass"><EmptyState icon={FiShield} title="Nothing here">No doctors with this status.</EmptyState></div>
      ) : (
        <div className="glass table-wrap">
          <table className="table">
            <thead><tr><th>Doctor</th><th>PMDC no.</th><th>Specialty / hospital</th><th>Submitted</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.doctorCNIC}>
                  <td><strong>Dr. {d.firstName} {d.lastName}</strong><div className="subtle mono" style={{ fontSize: 12 }}>{formatCNIC(d.doctorCNIC)} · {d.email}</div></td>
                  <td className="mono">{d.verification?.pmdcNumber || '—'}</td>
                  <td>{d.specialization}<div className="subtle" style={{ fontSize: 12.5 }}>{d.hospital}</div></td>
                  <td>{formatDate(d.verification?.submittedAt || d.createdAt)}</td>
                  <td><span className={`badge ${{ verified: 'badge-green', pending: 'badge-amber', rejected: 'badge-rose' }[d.verification?.status || 'verified'] || ''}`}>{d.verification?.status || 'verified (legacy)'}</span></td>
                  <td><button className="btn btn-sm" onClick={() => open(d)}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(doc)} onClose={() => setDoc(null)} title={doc && `Dr. ${doc.doctor.firstName} ${doc.doctor.lastName}`} subtitle={doc && `PMDC ${doc.doctor.verification?.pmdcNumber || 'not given'} · ${doc.doctor.specialization} · ${doc.doctor.hospital}`} width={980}>
        {doc && (
          <div className="stack gap-16">
            <div className="viewer" style={{ minHeight: 380 }}>
              <div className="viewer-doc">
                {!doc.doctor.verification?.document?.name ? <p className="subtle">No certificate uploaded yet.</p>
                  : !doc.url ? <Spinner size={24} />
                    : doc.mime === 'application/pdf' ? <PdfPreview url={doc.url} /> : <img src={doc.url} alt="PMDC certificate" />}
              </div>
              <div className="viewer-text stack gap-12">
                <p className="muted" style={{ fontSize: 13.5 }}>Check that the name and registration number match the PMDC register at <a href="https://www.pmdc.pk" target="_blank" rel="noreferrer">pmdc.pk</a>, and that the certificate is current.</p>
                {doc.doctor.verification?.note && <p className="subtle">Previous note: {doc.doctor.verification.note}</p>}
                <label className="field-label" htmlFor="adm-note">Note to the doctor (required to reject)</label>
                <textarea id="adm-note" className="textarea" style={{ minHeight: 100 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Certificate image is blurry; please upload a clearer scan." />
                <div className="row gap-8">
                  <Button className="btn btn-primary" loading={busy} onClick={() => decide('verified')}><FiCheck /> Verify</Button>
                  <Button className="btn btn-danger" loading={busy} disabled={!note.trim()} onClick={() => decide('rejected')}><FiX /> Reject</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const UsersTab = () => {
  const { toast, confirm } = useFeedback();
  const [role, setRole] = useState('patient');
  const [q, setQ] = useState('');
  const { data, loading, reload } = useFetch(async () => (await api.get('/admin/users', { params: { role, q: q || undefined } })).data, [role, q]);
  const key = role === 'doctor' ? 'doctorCNIC' : 'patientCNIC';

  const toggle = async (u) => {
    const suspending = !u.disabled;
    const ok = await confirm({ title: suspending ? 'Suspend this account?' : 'Restore this account?', message: suspending ? 'They will be signed out and cannot sign in until restored.' : 'They will be able to sign in again.', confirmLabel: suspending ? 'Suspend' : 'Restore', danger: suspending });
    if (!ok) return;
    try {
      await api.post(`/admin/users/${role}/${u[key]}/disabled`, { disabled: suspending, reason: suspending ? 'Suspended by admin' : '' });
      toast(suspending ? 'Account suspended' : 'Account restored');
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  return (
    <div className="stack gap-16">
      <div className="row between wrap gap-12">
        <div className="chips">
          <button className="chip" aria-pressed={role === 'patient'} onClick={() => setRole('patient')}>Patients</button>
          <button className="chip" aria-pressed={role === 'doctor'} onClick={() => setRole('doctor')}>Doctors</button>
        </div>
        <div className="search input-wrap"><FiSearch size={16} /><input className="input" placeholder="Name, email or CNIC" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {loading ? <Skeleton height={200} /> : (
        <div className="glass table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>CNIC</th><th>Email</th><th>Joined</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u[key]}>
                  <td><strong>{role === 'doctor' ? 'Dr. ' : ''}{u.firstName} {u.lastName}</strong>{u.guardianCNIC && <div className="subtle" style={{ fontSize: 12 }}>Family profile</div>}</td>
                  <td className="mono">{formatCNIC(u[key])}</td>
                  <td>{u.email || '—'}{u.emailVerified === false && <span className="badge badge-amber badge-plain" style={{ marginLeft: 6 }}>unverified</span>}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{u.disabled ? <span className="badge badge-rose">Suspended</span> : <span className="badge badge-green">Active</span>}</td>
                  <td><button className={`btn btn-sm ${u.disabled ? '' : 'btn-danger'}`} onClick={() => toggle(u)}>{u.disabled ? 'Restore' : 'Suspend'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.length && <EmptyState icon={FiUsers} title="No accounts found" />}
        </div>
      )}
    </div>
  );
};

const REASONS = { 'fake-doctor': 'Not a real doctor', inappropriate: 'Inappropriate behaviour', privacy: 'Privacy concern', spam: 'Spam', other: 'Other' };

const ReportsTab = () => {
  const { toast } = useFeedback();
  const [status, setStatus] = useState('open');
  const { data, loading, reload } = useFetch(async () => (await api.get('/admin/reports', { params: { status } })).data, [status]);
  const act = async (r, next) => {
    try {
      await api.post(`/admin/reports/${r._id}`, { status: next });
      toast('Report updated');
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };
  return (
    <div className="stack gap-16">
      <div className="chips">{['open', 'resolved', 'dismissed'].map((s) => <button key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      {loading ? <Skeleton height={200} /> : !data.length ? <div className="glass"><EmptyState icon={FiFlag} title="No reports" /></div> : data.map((r) => (
        <div key={r._id} className="glass card-pad stack gap-8">
          <div className="row between wrap gap-8">
            <strong>{r.targetInfo.name} <span className="subtle mono" style={{ fontSize: 12 }}>({r.target.role} {formatCNIC(r.target.cnic)})</span></strong>
            <span className="subtle" style={{ fontSize: 13 }}>{formatDateTime(r.createdAt)}</span>
          </div>
          <span className="badge badge-amber" style={{ alignSelf: 'flex-start' }}>{REASONS[r.reason]}</span>
          {r.details && <p className="muted" style={{ margin: 0 }}>{r.details}</p>}
          <span className="subtle" style={{ fontSize: 12.5 }}>Reported by a {r.reporter.role}{r.targetInfo.disabled ? ' · account already suspended' : ''}</span>
          {status === 'open' && (
            <div className="row gap-8">
              <button className="btn btn-sm btn-primary" onClick={() => act(r, 'resolved')}>Mark resolved</button>
              <button className="btn btn-sm" onClick={() => act(r, 'dismissed')}>Dismiss</button>
            </div>
          )}
        </div>
      ))}
      <p className="subtle" style={{ fontSize: 13 }}>To suspend a reported account, find it under Accounts.</p>
    </div>
  );
};

const PartnersTab = () => {
  const { toast } = useFeedback();
  const { data, loading, reload } = useFetch(async () => (await api.get('/admin/partners')).data, []);
  const [form, setForm] = useState({ name: '', type: 'lab' });
  const [newKey, setNewKey] = useState(null);
  const create = async (e) => {
    e.preventDefault();
    try {
      const { data: res } = await api.post('/admin/partners', form);
      setNewKey(res);
      setForm({ name: '', type: 'lab' });
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };
  const setActive = async (p, active) => {
    await api.patch(`/admin/partners/${p._id}`, { active });
    reload(true);
  };
  return (
    <div className="stack gap-16">
      <form className="glass card-pad row gap-12 wrap" onSubmit={create}>
        <input className="input grow" placeholder="Organisation name, e.g. Chughtai Lab" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ minWidth: 220 }} />
        <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: 160 }}>
          <option value="lab">Laboratory</option>
          <option value="pharmacy">Pharmacy</option>
        </select>
        <button className="btn btn-primary" disabled={!form.name.trim()}><FiKey /> Issue API key</button>
      </form>
      {loading ? <Skeleton height={120} /> : (
        <div className="glass table-wrap">
          <table className="table">
            <thead><tr><th>Partner</th><th>Type</th><th>Key</th><th>Last used</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p._id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.type === 'lab' ? 'Laboratory' : 'Pharmacy'}</td>
                  <td className="mono">{p.keyPrefix}…</td>
                  <td>{p.lastUsedAt ? formatDateTime(p.lastUsedAt) : 'Never'}</td>
                  <td>{p.active ? <span className="badge badge-green">Active</span> : <span className="badge badge-rose">Revoked</span>}</td>
                  <td><button className="btn btn-sm" onClick={() => setActive(p, !p.active)}>{p.active ? 'Revoke' : 'Re-enable'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.length && <EmptyState icon={FiKey} title="No partners yet">Issue a key to a lab or pharmacy. Share the Developers page with them.</EmptyState>}
        </div>
      )}
      <Modal open={Boolean(newKey)} onClose={() => setNewKey(null)} title="API key created" subtitle="Copy it now: for security it won't be shown again." width={560}>
        {newKey && (
          <div className="stack gap-12">
            <code className="code-block" data-no-translate style={{ wordBreak: 'break-all' }}>{newKey.apiKey}</code>
            <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(newKey.apiKey); toast('Key copied'); }}><FiCopy /> Copy key</button>
          </div>
        )}
      </Modal>
    </div>
  );
};

const ErrorsTab = () => {
  const { data, loading } = useFetch(async () => (await api.get('/admin/errors')).data, []);
  if (loading) return <Skeleton height={200} />;
  if (!data.length) return <div className="glass"><EmptyState icon={FiCheck} title="No errors">The server hasn&apos;t logged any errors in the last 30 days.</EmptyState></div>;
  return (
    <div className="stack gap-8">
      {data.map((e) => (
        <details key={e._id} className="glass card-pad">
          <summary className="row between gap-12" style={{ cursor: 'pointer' }}>
            <span className="truncate"><span className="mono subtle">{e.method} {e.path}</span> · {e.message}</span>
            <span className="subtle" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{formatDateTime(e.createdAt)}</span>
          </summary>
          <pre className="code-block" data-no-translate style={{ marginTop: 12 }}>{e.stack}{e.user ? `\n\nuser: ${e.user}` : ''}</pre>
        </details>
      ))}
    </div>
  );
};

const AdminApp = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    if (session?.role !== 'admin') navigate('/admin/signin', { replace: true });
  }, [session, navigate]);
  if (session?.role !== 'admin') return null;
  const Tab = { overview: Overview, doctors: VerificationTab, users: UsersTab, reports: ReportsTab, partners: PartnersTab, errors: ErrorsTab }[tab];
  return (
    <div className="admin">
      <header className="public-head">
        <div className="row gap-12"><Logo to="/admin" /><span className="badge badge-cyan">Admin</span></div>
        <div className="row gap-8">
          <span className="subtle hide-sm" style={{ fontSize: 13 }}>{session.name}</span>
          <LangToggle />
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={() => { clearSession(); navigate('/admin/signin'); }}><FiLogOut /> Sign out</button>
        </div>
      </header>
      <main className="public-main wide">
        <div className="tabs" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
              <Icon size={15} /> {label}
              {tab === id && <span className="tab-line" />}
            </button>
          ))}
        </div>
        <Tab go={setTab} />
      </main>
    </div>
  );
};

export default AdminApp;
