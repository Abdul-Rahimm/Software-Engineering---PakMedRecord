import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle, FiCalendar, FiClock, FiCreditCard, FiDownload, FiHome, FiPlus, FiRepeat, FiVideo, FiX } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchAllDoctors, indexBy } from '../../lib/data';
import { downloadReceiptPDF } from '../../lib/pdf';
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

const PAY_LABEL = { paid: 'paid', refund_due: 'refund on its way', refunded: 'refunded', unpaid: 'unpaid' };

// Video visits open 15 minutes before the slot and stay open for 2 hours
const videoOpen = (a) => {
  const d = apptDay(a.date);
  const [h, m] = a.time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  const diff = d.getTime() - Date.now();
  return diff < 15 * 60000 && diff > -2 * 3600000;
};

const NOTICE = {
  doctor_left: 'The doctor no longer works at this hospital.',
  branch_closed: 'This branch has closed.',
  org_suspended: 'This hospital is not taking appointments right now.',
};

const MyAppointments = () => {
  const { cnic, profile } = useShell();
  const { toast } = useFeedback();
  const [paying, setPaying] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, setData } = useFetch(async () => {
    const [appts, doctors] = await Promise.all([
      api.get(`/appointments/mine/${cnic}`).then((r) => r.data.appointments),
      fetchAllDoctors(),
    ]);
    // which online payment methods each unpaid upcoming appointment's clinic accepts
    const unpaid = appts.filter((a) => a.status === 'pending' && a.fee > 0 && a.payment?.status !== 'paid').map((a) => a._id);
    const payOptions = unpaid.length ? (await api.get('/payments/options', { params: { ids: unpaid.join(',') } }).catch(() => ({ data: {} }))).data : {};
    return { appts, doctorsById: indexBy(doctors, 'doctorCNIC'), payOptions };
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

  // Online payment: Safepay's hosted checkout, or our simulated one in test mode
  const pay = async (a, provider) => {
    setPaying(a._id);
    try {
      const { data: res } = await api.post('/payments/checkout', { appointmentId: a._id, provider });
      window.location.assign(res.checkout.url || res.checkout.redirect);
    } catch (err) {
      toast(apiError(err), 'error');
      setPaying(null);
    }
  };

  const receipt = async (a) => {
    try {
      const { data: res } = await api.get(`/payments/${a.payment.paymentId}`);
      await downloadReceiptPDF({ ...res, patient: profile });
    } catch (err) {
      toast(apiError(err, 'Receipt not available'), 'error');
    }
  };

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
                      <Avatar photo={doc} first={doc?.firstName} last={doc?.lastName} seed={a.doctorCNIC} size={34} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }} className="truncate">{doctorName(doc)}</div>
                        <div className="subtle" style={{ fontSize: 12.5 }}>{doc?.specialization}</div>
                      </div>
                    </div>
                    <div className="tl-meta">
                      <span><FiClock /> {formatTime(a.time)}</span>
                      {a.mode === 'video' ? <span><FiVideo /> Video visit{a.place ? ` · ${a.place.orgName}` : ''}</span> : a.place ? <span><FiHome /> {a.place.orgName}, {a.place.facilityName}</span> : doc?.hospital && <span><FiHome /> {doc.clinicAddress || doc.hospital}</span>}
                      {a.fee ? <span><FiCreditCard /> Rs {a.fee.toLocaleString('en-PK')} · {PAY_LABEL[a.payment?.status] || 'unpaid'}</span> : null}
                    </div>
                    {a.reason && <p className="muted" style={{ fontSize: 13.5 }}>“{a.reason}”</p>}
                    {isUpcoming(a) && a.notice && (
                      <p className="auth-notice" style={{ fontSize: 13 }}><FiAlertTriangle /> {NOTICE[a.notice]} Move it to another hospital or time with the same doctor, or cancel.</p>
                    )}
                    {a.status === 'cancelled' && (
                      <p className="subtle" style={{ fontSize: 12.5 }}>{a.movedTo ? 'Moved to a new time or place' : <>Cancelled by {a.cancelledBy === 'patient' ? 'you' : 'the doctor'}{a.cancelReason ? `: ${a.cancelReason}` : ''}</>}</p>
                    )}
                  </div>
                  <div className="stack gap-8 appt-actions" style={{ alignItems: 'flex-end' }}>
                    {isUpcoming(a) ? <span className="badge badge-cyan">Scheduled</span> : <StatusBadge status={a.status === 'pending' ? 'missed' : a.status} />}
                    {isUpcoming(a) && a.mode === 'video' && (
                      videoOpen(a)
                        ? <Link to={`/visit/${a._id}`} className="btn btn-primary btn-sm"><FiVideo /> Join video</Link>
                        : <span className="subtle" style={{ fontSize: 12 }}>Join opens 15 min before</span>
                    )}
                    {isUpcoming(a) && a.fee > 0 && a.payment?.status !== 'paid' && (data.payOptions[a._id] || []).map((p) => (
                      <Button key={p} className={`btn btn-sm ${p === 'safepay' ? 'btn-primary' : ''}`} loading={paying === a._id} onClick={() => pay(a, p)}>
                        <FiCreditCard /> {p === 'safepay' ? 'Pay online' : 'Pay online (test)'}
                      </Button>
                    ))}
                    {['paid', 'refund_due', 'refunded'].includes(a.payment?.status) && a.payment.paymentId && <button className="btn btn-ghost btn-sm" onClick={() => receipt(a)}><FiDownload /> Receipt</button>}
                    {isUpcoming(a) && <Link to={`/appointments/book/${cnic}`} state={{ moveFrom: a._id, doctorCNIC: a.doctorCNIC, mode: a.mode }} className={`btn btn-sm ${a.notice ? 'btn-primary' : ''}`}><FiRepeat /> Move</Link>}
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
