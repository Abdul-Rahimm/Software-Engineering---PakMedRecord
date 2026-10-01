import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiActivity, FiAlertTriangle, FiArrowLeft, FiFilePlus, FiFileText, FiHeart, FiHome, FiLock, FiMail, FiPhone, FiX,
} from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchAllDoctors, indexBy, byNewest } from '../../lib/data';
import { apiError, formatCNIC, formatDate, fullName } from '../../lib/format';
import { Avatar, EmptyState, Skeleton } from '../../ui/Bits';
import AIStream from '../../ui/AIStream';
import { useFeedback } from '../../ui/Feedback';
import { AssistantGlyph } from '../../layout/Assistant';
import { RecordTimeline } from '../patient/Records';
import { VitalsView } from '../patient/Vitals';
import AddRecordModal from './AddRecordModal';
import '../dashboard.css';

const age = (dob) => (dob ? Math.floor((Date.now() - new Date(dob)) / 3.15576e10) : null);

const TABS = [
  { id: 'records', label: 'Records', icon: FiFileText },
  { id: 'profile', label: 'Health profile', icon: FiHeart },
  { id: 'vitals', label: 'Vitals', icon: FiActivity },
];

const ProfileFacts = ({ p }) => {
  const rows = [
    ['Blood group', p.bloodGroup || '—'],
    ['Date of birth', p.dateOfBirth ? `${formatDate(p.dateOfBirth)} (${age(p.dateOfBirth)} yrs)` : '—'],
    ['Height / weight', p.heightCm || p.weightKg ? `${p.heightCm ?? '?'} cm · ${p.weightKg ?? '?'} kg` : '—'],
    ['Chronic conditions', p.chronicConditions?.join(', ') || 'None recorded'],
    ['Family history', p.familyHistory?.join(', ') || 'None recorded'],
    ['Emergency contact', p.emergencyContact?.name ? `${p.emergencyContact.name}${p.emergencyContact.relation ? ` (${p.emergencyContact.relation})` : ''} · ${p.emergencyContact.phone || '—'}` : '—'],
  ];
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <section className="glass card-pad">
        {rows.map(([k, v]) => (
          <div key={k} className="summary-row"><span className="k" style={{ width: 150 }}>{k}</span><span>{v}</span></div>
        ))}
      </section>
      <div className="stack gap-20">
        <section className="glass card-pad stack gap-12">
          <h2 className="section-title">Current medications</h2>
          {p.medications?.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th></tr></thead>
                <tbody>{p.medications.map((m, i) => <tr key={i}><td style={{ fontWeight: 600 }}>{m.name}</td><td>{m.dose || '—'}</td><td>{m.frequency || '—'}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="subtle">None recorded.</p>}
        </section>
        <section className="glass card-pad stack gap-12">
          <h2 className="section-title">Vaccinations</h2>
          {p.vaccinations?.length ? (
            <div className="chips">{p.vaccinations.map((v, i) => <span key={i} className="badge badge-cyan badge-plain">{v.name}{v.dose ? ` · ${v.dose}` : ''}{v.date ? ` · ${formatDate(v.date)}` : ''}</span>)}</div>
          ) : <p className="subtle">None recorded.</p>}
        </section>
      </div>
    </div>
  );
};

const PatientHistory = () => {
  const { patientCNIC } = useParams();
  const { cnic } = useShell();
  const { toast, confirm } = useFeedback();
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState('records');
  const [brief, setBrief] = useState(false);

  const { data, loading, error, setData } = useFetch(async () => {
    const [patient, records, doctors] = await Promise.all([
      api.get(`/patient/home/${patientCNIC}`).then((r) => r.data),
      api.get(`/record/getrecords/${patientCNIC}`).then((r) => r.data),
      fetchAllDoctors(),
    ]);
    return { patient, records: [...records].sort(byNewest), doctorsById: indexBy(doctors, 'doctorCNIC') };
  }, [patientCNIC]);

  const back = <Link to={`/affiliation/getmypatients/${cnic}`} className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}><FiArrowLeft /> All patients</Link>;

  if (loading) return <>{back}<Skeleton height={160} style={{ marginBottom: 20 }} /><Skeleton height={200} /></>;

  if (error) {
    return (
      <>
        {back}
        <div className="glass">
          <EmptyState icon={FiLock} title="No access">This patient hasn&apos;t added you to their care team.</EmptyState>
        </div>
      </>
    );
  }

  const { patient, records, doctorsById } = data;

  const deleteRecord = async (r) => {
    const ok = await confirm({ title: 'Delete this record?', message: 'It will be removed from the patient’s history. Use this only to correct a mistake.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/record/remove/${r._id}`);
      setData((d) => ({ ...d, records: d.records.filter((x) => x._id !== r._id) }));
      toast('Record deleted');
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  return (
    <>
      {back}
      <section className="glass dash-hero history-hero">
        <div className="row gap-20 wrap">
          <Avatar first={patient.firstName} last={patient.lastName} seed={patient.patientCNIC} size={76} />
          <div className="stack gap-8" style={{ minWidth: 0 }}>
            <span className="eyebrow">Patient file</span>
            <h1 style={{ fontSize: 'clamp(26px, 3vw, 38px)' }}>{fullName(patient)}</h1>
            <div className="tl-meta">
              <span className="mono">{formatCNIC(patient.patientCNIC)}</span>
              <span>{patient.gender}{age(patient.dateOfBirth) != null ? `, ${age(patient.dateOfBirth)} yrs` : ''}</span>
              {patient.bloodGroup && <span>Blood {patient.bloodGroup}</span>}
              <span><FiHome /> {patient.hospital}</span>
              <span><FiMail /> {patient.email}</span>
              {patient.phone && <span><FiPhone /> {patient.phone}</span>}
            </div>
          </div>
        </div>
        <div className="stack gap-8 history-count">
          <button className="btn btn-ai" onClick={() => setBrief(true)}><AssistantGlyph size={15} /> AI brief</button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}><FiFilePlus /> New record</button>
        </div>
      </section>

      {patient.allergies?.length > 0 && (
        <div className="glass row gap-12" style={{ padding: '14px 18px', marginBottom: 20, borderColor: 'rgba(255,93,143,.35)', background: 'rgba(255,93,143,.06)' }}>
          <FiAlertTriangle style={{ color: 'var(--rose)', flexShrink: 0 }} />
          <span><strong style={{ color: 'var(--rose-text)' }}>Allergies:</strong> {patient.allergies.join(', ')}</span>
        </div>
      )}

      <AnimatePresence>
        {brief && (
          <motion.section className="glass card-pad-lg ai-card stack gap-16" style={{ marginBottom: 24 }} initial={{ opacity: 0, height: 0, rotateX: -20 }} animate={{ opacity: 1, height: 'auto', rotateX: 0 }} exit={{ opacity: 0, height: 0 }}>
            <div className="row between">
              <span className="ai-badge"><AssistantGlyph size={12} /> Pre-consultation brief</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setBrief(false)} aria-label="Close brief"><FiX /></button>
            </div>
            <AIStream path={`/ai/summary/${patient.patientCNIC}`} />
          </motion.section>
        )}
      </AnimatePresence>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon size={15} /> {t.label}{t.id === 'records' ? ` · ${records.length}` : ''}
            {tab === t.id && <motion.span layoutId="history-tab" className="tab-line" />}
          </button>
        ))}
      </div>

      {tab === 'records' && (
        <RecordTimeline
          records={records}
          doctorsById={doctorsById}
          patient={patient}
          canDelete={(r) => r.doctorCNIC === cnic}
          onDelete={deleteRecord}
          emptyAction={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add the first record</button>}
        />
      )}
      {tab === 'profile' && <ProfileFacts p={patient} />}
      {tab === 'vitals' && <VitalsView patientCNIC={patient.patientCNIC} readOnly />}

      <AddRecordModal
        open={adding}
        onClose={() => setAdding(false)}
        patients={[patient]}
        defaultPatient={patient.patientCNIC}
        onCreated={(rec) => rec && setData((d) => ({ ...d, records: [rec, ...d.records] }))}
      />
    </>
  );
};

export default PatientHistory;
