import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheck, FiCheckCircle, FiDownload, FiX } from 'react-icons/fi';
import Modal from '../../ui/Modal';
import { AttachmentChips } from '../../ui/Attachments';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchPatients, indexBy } from '../../lib/data';
import { apiError, formatCNIC, fullName } from '../../lib/format';
import { downloadRecordPDF } from '../../lib/pdf';
import { Avatar, Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const ReviewQueue = () => {
  const { cnic, profile, refreshCounts } = useShell();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');

  const { data, loading, setData } = useFetch(async () => {
    const [pending, patients] = await Promise.all([
      api.get(`/tempRecords/pending/${cnic}`).then((r) => r.data.pendingRecords),
      fetchPatients(cnic),
    ]);
    return { pending, patientsById: indexBy(patients, 'patientCNIC') };
  }, [cnic]);

  const review = async (rec, status, reviewNote) => {
    setBusy(rec._id + status);
    try {
      await api.patch(`/tempRecords/approve/${rec._id}`, { status, reviewNote });
      setRejecting(null);
      setNote('');
      setData((d) => ({ ...d, pending: d.pending.filter((r) => r._id !== rec._id) }));
      refreshCounts();
      toast(status === 'approved' ? 'Approved and added to patient history' : 'Record rejected', status === 'approved' ? 'success' : 'info');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Verification"
        title="Review queue"
        subtitle="Records your patients submitted. Approve to add them to their permanent history."
        actions={data?.pending.length ? <span className="badge badge-amber">{data.pending.length} waiting</span> : null}
      />
      {loading ? (
        <div className="stack gap-16"><Skeleton height={160} /><Skeleton height={160} /></div>
      ) : data.pending.length === 0 ? (
        <div className="glass">
          <EmptyState icon={FiCheckCircle} title="Inbox zero">Nothing to review right now. New submissions will appear here.</EmptyState>
        </div>
      ) : (
        <div className="stack gap-16" style={{ perspective: 1200 }}>
          <AnimatePresence>
            {data.pending.map((r) => {
              const p = data.patientsById[r.patientCNIC];
              return (
                <motion.div
                  key={r._id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, rotateX: 70, y: -30, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                  style={{ transformOrigin: '50% 0' }}
                >
                  <TiltCard className="card-pad stack gap-16" max={3}>
                    <div className="row between wrap gap-12">
                      <div className="row gap-12">
                        <Avatar photo={p} first={p?.firstName} last={p?.lastName} seed={r.patientCNIC} size={44} />
                        <div>
                          {p ? <Link to={`/records/getrecords/${r.patientCNIC}`} style={{ fontWeight: 600, color: 'var(--text)' }}>{fullName(p)}</Link> : <span style={{ fontWeight: 600 }}>Patient</span>}
                          <div className="mono subtle" style={{ fontSize: 12 }}>{formatCNIC(r.patientCNIC)}</div>
                        </div>
                      </div>
                      <div className="row gap-8 wrap">
                        <span className="badge cat-badge">{r.category || 'General'}</span>
                        <span className="badge badge-amber">Pending review</span>
                      </div>
                    </div>
                    {r.title && <h3 style={{ fontSize: 17 }}>{r.title}</h3>}
                    <AttachmentChips attachments={r.attachments} />
                    <p className="tl-body" style={{ padding: 16, borderRadius: 14, background: 'var(--field)', border: '1px solid var(--border)' }}>{r.recordData}</p>
                    <div className="row between wrap gap-12">
                      <button className="btn btn-ghost btn-sm" onClick={() => downloadRecordPDF({ record: { ...r, createdAt: new Date() }, patient: p, doctor: profile })}><FiDownload /> Preview PDF</button>
                      <div className="row gap-8">
                        <Button className="btn btn-danger btn-sm" loading={busy === `${r._id}rejected`} onClick={() => setRejecting(r)}><FiX /> Reject</Button>
                        <Button className="btn btn-primary btn-sm" loading={busy === `${r._id}approved`} onClick={() => review(r, 'approved')}><FiCheck /> Approve</Button>
                      </div>
                    </div>
                  </TiltCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject this record?" subtitle="The patient will be notified and will see your reason." width={500}>
        <div className="stack gap-16">
          <div className="field">
            <label className="field-label" htmlFor="rn">Reason for the patient</label>
            <textarea id="rn" className="textarea" style={{ minHeight: 90 }} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please upload the full lab report, including the reference ranges." />
          </div>
          <div className="row gap-12" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
            <Button className="btn btn-danger" loading={busy === `${rejecting?._id}rejected`} onClick={() => review(rejecting, 'rejected', note.trim())}><FiX /> Reject record</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ReviewQueue;
