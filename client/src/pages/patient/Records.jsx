import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiCalendar, FiDownload, FiFileText, FiHome, FiSearch, FiTrash2, FiUploadCloud, FiUser,
} from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchAllDoctors, indexBy, byNewest } from '../../lib/data';
import { doctorName, formatDateTime } from '../../lib/format';
import { RECORD_CATEGORIES } from '../../lib/constants';
import { downloadHistoryPDF, downloadRecordPDF } from '../../lib/pdf';
import { EmptyState, PageHeader, Skeleton, rise, stagger } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import Modal from '../../ui/Modal';
import AIStream from '../../ui/AIStream';
import { AssistantGlyph } from '../../layout/Assistant';
import { AttachmentChips } from '../../ui/Attachments';
import '../dashboard.css';

// Shared by the patient's own records page and the doctor's patient-history page
export const RecordTimeline = ({ records, doctorsById, patient, emptyAction, canDelete, onDelete }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [explaining, setExplaining] = useState(null);

  const counts = useMemo(() => {
    const c = {};
    records.forEach((r) => { c[r.category || 'General'] = (c[r.category || 'General'] || 0) + 1; });
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (category !== 'All' && (r.category || 'General') !== category) return false;
      if (!q) return true;
      const doc = doctorsById[r.doctorCNIC];
      const fileText = (r.attachments || []).map((a) => `${a?.name} ${a?.ocr?.text || ''}`).join(' ');
      return `${r.title} ${r.recordData} ${r.category} ${doc?.firstName} ${doc?.lastName} ${doc?.hospital} ${fileText}`.toLowerCase().includes(q);
    });
  }, [records, query, category, doctorsById]);

  if (records.length === 0) {
    return (
      <div className="glass">
        <EmptyState icon={FiFileText} title="No records yet" action={emptyAction}>
          Verified records will appear here as a timeline of the medical history.
        </EmptyState>
      </div>
    );
  }

  const usedCategories = RECORD_CATEGORIES.filter((c) => counts[c]);

  return (
    <div className="stack gap-20">
      <div className="row between wrap gap-12">
        <div className="search input-wrap">
          <FiSearch size={16} />
          <input className="input" placeholder="Search records, doctors, hospitals…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {usedCategories.length > 1 && (
          <div className="chips" role="group" aria-label="Filter by category">
            <button className="chip" style={{ fontFamily: 'var(--font)' }} aria-pressed={category === 'All'} onClick={() => setCategory('All')}>All · {records.length}</button>
            {usedCategories.map((c) => (
              <button key={c} className="chip" style={{ fontFamily: 'var(--font)' }} aria-pressed={category === c} onClick={() => setCategory(c)}>{c} · {counts[c]}</button>
            ))}
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="glass"><EmptyState icon={FiSearch} title="No matches">Try a different search or category.</EmptyState></div>
      ) : (
        <motion.div className="timeline" variants={stagger} initial="hidden" animate="show" key={category}>
          {filtered.map((r) => {
            const doc = doctorsById[r.doctorCNIC];
            return (
              <motion.div key={r._id} className="tl-item" variants={rise}>
                <span className="tl-node" />
                <TiltCard className="tl-card card-pad" max={3}>
                  <div className="row between wrap gap-12" style={{ alignItems: 'flex-start' }}>
                    <div className="stack gap-8" style={{ minWidth: 0 }}>
                      <div className="row gap-8 wrap">
                        <span className="badge cat-badge">{r.category || 'General'}</span>
                        {r.source === 'patient' && <span className="badge badge-plain badge-cyan">Patient-submitted · verified</span>}
                      </div>
                      {r.title && <h3 style={{ fontSize: 18 }}>{r.title}</h3>}
                    </div>
                    <div className="row gap-8">
                      <button className="btn btn-ai btn-sm" onClick={() => setExplaining(r)}><AssistantGlyph size={14} /> Explain</button>
                      <button className="btn btn-sm" onClick={() => downloadRecordPDF({ record: r, patient, doctor: doc })} aria-label="Download PDF"><FiDownload /> PDF</button>
                      {canDelete?.(r) && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDelete(r)} aria-label="Delete record"><FiTrash2 /></button>}
                    </div>
                  </div>
                  <p className="tl-body">{r.recordData}</p>
                  <AttachmentChips attachments={r.attachments} />
                  <div className="tl-meta">
                    <span><FiCalendar /> {formatDateTime(r.createdAt)}</span>
                    <span><FiUser /> {doctorName(doc)}</span>
                    {doc?.hospital && <span><FiHome /> {doc.hospital}</span>}
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <Modal
        open={Boolean(explaining)}
        onClose={() => setExplaining(null)}
        title={<span className="row gap-8"><AssistantGlyph size={18} /> {explaining?.title || 'Record'} explained</span>}
        subtitle={explaining && `${explaining.category || 'General'} · ${formatDateTime(explaining.createdAt)}`}
        width={620}
      >
        {explaining && <AIStream path={`/ai/explain/${explaining._id}`} />}
      </Modal>
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
        subtitle="Every verified record from every doctor, newest first. Ask AI to explain any record in plain language."
        actions={
          <>
            {data?.records.length > 0 && profile && (
              <button className="btn" onClick={() => downloadHistoryPDF({ patient: profile, records: data.records, doctorsById: data.doctorsById })}><FiDownload /> Export all</button>
            )}
            <Link to={`/tempRecords/submit/${cnic}`} className="btn btn-primary"><FiUploadCloud /> Submit a record</Link>
          </>
        }
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
