import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCalendar, FiDownload, FiFileText, FiHome, FiSearch, FiUploadCloud, FiUser } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchAllDoctors, indexBy, byNewest } from '../../lib/data';
import { doctorName, formatDateTime } from '../../lib/format';
import { downloadRecordPDF } from '../../lib/pdf';
import { EmptyState, PageHeader, Skeleton, rise, stagger } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import '../dashboard.css';

// Shared by the patient's own records page and the doctor's patient-history page
export const RecordTimeline = ({ records, doctorsById, patient, emptyAction }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const doc = doctorsById[r.doctorCNIC];
      return `${r.recordData} ${doc?.firstName} ${doc?.lastName} ${doc?.hospital}`.toLowerCase().includes(q);
    });
  }, [records, query, doctorsById]);

  if (records.length === 0) {
    return (
      <div className="glass">
        <EmptyState icon={FiFileText} title="No records yet" action={emptyAction}>
          Approved records will appear here as a timeline of your medical history.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="stack gap-20">
      <div className="search input-wrap">
        <FiSearch size={16} />
        <input className="input" placeholder="Search records, doctors, hospitals…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <div className="glass"><EmptyState icon={FiSearch} title="No matches">Try a different search term.</EmptyState></div>
      ) : (
        <motion.div className="timeline" variants={stagger} initial="hidden" animate="show">
          {filtered.map((r) => {
            const doc = doctorsById[r.doctorCNIC];
            return (
              <motion.div key={r._id} className="tl-item" variants={rise}>
                <span className="tl-node" />
                <TiltCard className="tl-card card-pad" max={3}>
                  <div className="row between wrap gap-12">
                    <div className="tl-meta">
                      <span><FiCalendar /> {formatDateTime(r.createdAt)}</span>
                      <span><FiUser /> {doctorName(doc)}</span>
                      {doc?.hospital && <span><FiHome /> {doc.hospital}</span>}
                    </div>
                    <button className="btn btn-sm" onClick={() => downloadRecordPDF({ record: r, patient, doctor: doc })}>
                      <FiDownload /> PDF
                    </button>
                  </div>
                  <p className="tl-body">{r.recordData}</p>
                </TiltCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

const Records = () => {
  const { cnic, profile } = useShell();
  const { data, loading } = useFetch(async () => {
    const [records, doctors] = await Promise.all([
      api.get(`/record/getrecords/${cnic}`).then((r) => r.data),
      fetchAllDoctors(),
    ]);
    return { records: [...records].sort(byNewest), doctorsById: indexBy(doctors, 'doctorCNIC') };
  }, [cnic]);

  return (
    <>
      <PageHeader
        eyebrow="Medical history"
        title="Health records"
        subtitle="Every approved record from every doctor, newest first. Download any entry as a signed PDF."
        actions={<Link to={`/tempRecords/submit/${cnic}`} className="btn btn-primary"><FiUploadCloud /> Submit a record</Link>}
      />
      {loading ? (
        <div className="stack gap-16"><Skeleton height={140} /><Skeleton height={140} /><Skeleton height={140} /></div>
      ) : (
        <RecordTimeline
          records={data.records}
          doctorsById={data.doctorsById}
          patient={profile}
          emptyAction={<Link to={`/tempRecords/submit/${cnic}`} className="btn btn-primary">Submit your first record</Link>}
        />
      )}
    </>
  );
};

export default Records;
