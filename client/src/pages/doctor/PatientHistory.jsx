import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiFilePlus, FiHome, FiLock, FiMail } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchAllDoctors, indexBy, byNewest } from '../../lib/data';
import { formatCNIC, formatDate, fullName } from '../../lib/format';
import { Avatar, EmptyState, Skeleton } from '../../ui/Bits';
import { RecordTimeline } from '../patient/Records';
import AddRecordModal from './AddRecordModal';
import '../dashboard.css';

const PatientHistory = () => {
  const { patientCNIC } = useParams();
  const { cnic } = useShell();
  const [adding, setAdding] = useState(false);

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

  return (
    <>
      {back}
      <section className="glass dash-hero history-hero">
        <div className="row gap-20 wrap">
          <Avatar first={patient.firstName} last={patient.lastName} seed={patient.patientCNIC} size={76} />
          <div className="stack gap-8" style={{ minWidth: 0 }}>
            <span className="eyebrow">Patient history</span>
            <h1 style={{ fontSize: 'clamp(26px, 3vw, 38px)' }}>{fullName(patient)}</h1>
            <div className="tl-meta">
              <span className="mono">{formatCNIC(patient.patientCNIC)}</span>
              <span>{patient.gender}</span>
              <span><FiHome /> {patient.hospital}</span>
              <span><FiMail /> {patient.email}</span>
              <span>Member since {formatDate(patient.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="stack gap-8 history-count">
          <div className="stat-value" style={{ fontSize: 40, marginTop: 0 }}>{records.length}</div>
          <span className="subtle">record{records.length === 1 ? '' : 's'}</span>
          <button className="btn btn-primary" onClick={() => setAdding(true)}><FiFilePlus /> New record</button>
        </div>
      </section>

      <RecordTimeline records={records} doctorsById={doctorsById} patient={patient} emptyAction={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add the first record</button>} />

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
