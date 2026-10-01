import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCalendar, FiClock, FiHome, FiPlus, FiX } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchAllDoctors, indexBy } from '../../lib/data';
import { apiError, apptDay, doctorName, formatTime } from '../../lib/format';
import { Avatar, Button, EmptyState, PageHeader, Skeleton, StatusBadge } from '../../ui/Bits';
import Segmented from '../../ui/Segmented';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const MyAppointments = () => {
  const { cnic } = useShell();
  const { toast } = useFeedback();
  const [tab, setTab] = useState('upcoming');
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, setData } = useFetch(async () => {
    const [appts, doctors] = await Promise.all([
      api.get(`/appointments/mine/${cnic}`).then((r) => r.data.appointments),
      fetchAllDoctors(),
    ]);
    return { appts, doctorsById: indexBy(doctors, 'doctorCNIC') };
  }, [cnic]);

  const isUpcoming = (a) => a.status === 'pending' && apptDay(a.date) >= startOfToday();

  const list = useMemo(() => {
    if (!data) return [];
    const l = data.appts.filter((a) => (tab === 'upcoming' ? isUpcoming(a) : !isUpcoming(a)));
    return tab === 'upcoming' ? l : [...l].reverse();
  }, [data, tab]);

  const cancel = async () => {
    setBusy(true);
    try {
      const { data: res } = await api.patch(`/appointments/cancel/${cancelling._id}`, { reason });
      setData((d) => ({ ...d, appts: d.appts.map((a) => (a._id === cancelling._id ? res.appointment : a)) }));
      toast('Appointment cancelled. Your doctor has been notified.');
      setCancelling(null);
      setReason('');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const upcomingCount = data?.appts.filter(isUpcoming).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Appointments"
        subtitle="Your upcoming visits and history. Cancel anytime before the visit."
        actions={<Link to={`/appointments/book/${cnic}`} className="btn btn-primary"><FiPlus /> Book appointment</Link>}
      />
      <div style={{ marginBottom: 24 }}>
        <Segmented id="my-appt" value={tab} onChange={setTab} options={[
          { value: 'upcoming', label: `Upcoming · ${upcomingCount}` },
          { value: 'past', label: `Past & cancelled · ${(data?.appts.length ?? 0) - upcomingCount}` },
        ]} />
      </div>

      {loading ? (
        <div className="stack gap-12"><Skeleton height={96} /><Skeleton height={96} /></div>
      ) : list.length === 0 ? (
        <div className="glass">
          <EmptyState icon={FiCalendar} title={tab === 'upcoming' ? 'No upcoming appointments' : 'Nothing here yet'} action={tab === 'upcoming' && <Link to={`/appointments/book/${cnic}`} className="btn btn-primary">Book one now</Link>}>
            {tab === 'upcoming' ? 'Book a visit with a doctor from your care team.' : 'Completed and cancelled appointments will appear here.'}
          </EmptyState>
        </div>
      ) : (
        <div className="stack gap-12">
          <AnimatePresence>
            {list.map((a, i) => {
              const d = apptDay(a.date);
              const doc = data.doctorsById[a.doctorCNIC];
              return (
                <motion.div key={a._id} layout className="glass appt-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04 }}>
                  <div className="date-tile" style={{ width: 64, padding: '10px 0' }}>
                    <span className="m">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
                    <span className="d" style={{ fontSize: 24 }}>{d.getDate()}</span>
                    <span className="m" style={{ color: 'var(--text-3)' }}>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                  </div>
                  <div className="grow stack gap-8" style={{ minWidth: 0 }}>
                    <div className="row gap-12 wrap">
                      <Avatar first={doc?.firstName} last={doc?.lastName} seed={a.doctorCNIC} size={34} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }} className="truncate">{doctorName(doc)}</div>
                        <div className="subtle" style={{ fontSize: 12.5 }}>{doc?.specialization}</div>
                      </div>
                    </div>
                    <div className="tl-meta">
                      <span><FiClock /> {formatTime(a.time)}</span>
                      {doc?.hospital && <span><FiHome /> {doc.hospital}</span>}
                    </div>
                    {a.reason && <p className="muted" style={{ fontSize: 13.5 }}>“{a.reason}”</p>}
                    {a.status === 'cancelled' && (
                      <p className="subtle" style={{ fontSize: 12.5 }}>Cancelled by {a.cancelledBy === 'patient' ? 'you' : 'the doctor'}{a.cancelReason ? `: ${a.cancelReason}` : ''}</p>
                    )}
                  </div>
                  <div className="stack gap-8" style={{ alignItems: 'flex-end' }}>
                    {isUpcoming(a) ? <span className="badge badge-cyan">Scheduled</span> : <StatusBadge status={a.status === 'pending' ? 'missed' : a.status} />}
                    {isUpcoming(a) && <button className="btn btn-danger btn-sm" onClick={() => setCancelling(a)}><FiX /> Cancel</button>}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Modal open={Boolean(cancelling)} onClose={() => setCancelling(null)} title="Cancel appointment?" subtitle={cancelling && `${doctorName(data?.doctorsById[cancelling.doctorCNIC])} · ${apptDay(cancelling.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${formatTime(cancelling.time)}`} width={480}>
        <div className="stack gap-16">
          <div className="field">
            <label className="field-label" htmlFor="cr">Reason (optional, shared with your doctor)</label>
            <input id="cr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Feeling better" />
          </div>
          <div className="row gap-12" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setCancelling(null)}>Keep it</button>
            <Button className="btn btn-danger" loading={busy} onClick={cancel}>Cancel appointment</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default MyAppointments;
