import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCalendar, FiCheck, FiClock, FiSearch, FiX } from 'react-icons/fi';
import Modal from '../../ui/Modal';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchPatients, indexBy } from '../../lib/data';
import { apiError, apptDay, formatCNIC, formatTime, fullName } from '../../lib/format';
import { Avatar, Button, EmptyState, PageHeader, Skeleton, StatusBadge } from '../../ui/Bits';
import Segmented from '../../ui/Segmented';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const Appointments = () => {
  const { cnic } = useShell();
  const { toast } = useFeedback();
  const [tab, setTab] = useState('upcoming');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');

  const { data, loading, setData } = useFetch(async () => {
    const [appts, patients] = await Promise.all([
      api.get(`/appointments/fetch/${cnic}`).then((r) => r.data.appointments),
      fetchPatients(cnic),
    ]);
    return { appts, patientsById: indexBy(patients, 'patientCNIC') };
  }, [cnic]);

  const groups = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase().replace(/-/g, '');
    const list = data.appts
      .filter((a) => (tab === 'all' ? true : tab === 'upcoming' ? a.status === 'pending' : a.status === tab))
      .filter((a) => {
        if (!q) return true;
        const p = data.patientsById[a.patientCNIC];
        return `${fullName(p)} ${a.patientCNIC}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (apptDay(a.date) - apptDay(b.date) || a.time.localeCompare(b.time)) * (tab === 'completed' ? -1 : 1));

    // group by calendar day
    const map = new Map();
    list.forEach((a) => {
      const key = apptDay(a.date).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return [...map.entries()];
  }, [data, tab, query]);

  const complete = async (a) => {
    setBusy(a._id);
    try {
      await api.patch(`/appointments/update/${a._id}`);
      setData((d) => ({ ...d, appts: d.appts.map((x) => (x._id === a._id ? { ...x, status: 'completed' } : x)) }));
      toast('Marked as completed');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy(`c${cancelling._id}`);
    try {
      const { data: res } = await api.patch(`/appointments/cancel/${cancelling._id}`, { reason: reason.trim() });
      setData((d) => ({ ...d, appts: d.appts.map((x) => (x._id === cancelling._id ? res.appointment : x)) }));
      toast('Appointment cancelled. The patient has been notified.');
      setCancelling(null);
      setReason('');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const count = (pred) => data?.appts.filter(pred).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Appointments"
        subtitle="Everything booked with you, grouped by day."
        actions={
          <div className="search input-wrap">
            <FiSearch size={16} />
            <input className="input" placeholder="Search patient or CNIC" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        }
      />

      <div style={{ marginBottom: 24 }}>
        <Segmented
          id="appt-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: `Upcoming · ${count((a) => a.status === 'pending')}` },
            { value: 'completed', label: `Completed · ${count((a) => a.status === 'completed')}` },
            { value: 'cancelled', label: `Cancelled · ${count((a) => a.status === 'cancelled')}` },
            { value: 'all', label: `All · ${data?.appts.length ?? 0}` },
          ]}
        />
      </div>

      {loading ? (
        <div className="stack gap-12"><Skeleton height={80} /><Skeleton height={80} /><Skeleton height={80} /></div>
      ) : groups.length === 0 ? (
        <div className="glass"><EmptyState icon={FiCalendar} title="Nothing here">{query ? 'No appointments match your search.' : 'No appointments in this view.'}</EmptyState></div>
      ) : (
        <div className="stack gap-24">
          {groups.map(([day, items]) => {
            const d = new Date(day);
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <section key={day} className="stack gap-12">
                <div className="row gap-12">
                  <h3 style={{ fontSize: 16 }}>{d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                  {isToday && <span className="badge badge-green">Today</span>}
                  <span className="subtle mono" style={{ fontSize: 12 }}>{items.length} visit{items.length === 1 ? '' : 's'}</span>
                </div>
                <AnimatePresence>
                  {items.map((a) => {
                    const p = data.patientsById[a.patientCNIC];
                    return (
                      <motion.div key={a._id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className="glass feed-item" style={{ borderRadius: 18 }}>
                        <div className="date-tile" style={{ width: 76 }}>
                          <FiClock size={13} style={{ color: 'var(--cyan)' }} />
                          <span className="d" style={{ fontSize: 15, marginTop: 4 }}>{formatTime(a.time)}</span>
                        </div>
                        <Avatar first={p?.firstName} last={p?.lastName} seed={a.patientCNIC} size={40} />
                        <div className="grow" style={{ minWidth: 0 }}>
                          {p ? (
                            <Link to={`/records/getrecords/${a.patientCNIC}`} className="truncate" style={{ fontWeight: 600, color: 'var(--text)', display: 'block' }}>{fullName(p)}</Link>
                          ) : (
                            <span style={{ fontWeight: 600 }}>Former patient</span>
                          )}
                          <div className="mono subtle" style={{ fontSize: 12 }}>{formatCNIC(a.patientCNIC)}</div>
                          {a.reason && <div className="muted truncate" style={{ fontSize: 13, marginTop: 2 }}>“{a.reason}”</div>}
                          {a.status === 'cancelled' && <div className="subtle" style={{ fontSize: 12.5, marginTop: 2 }}>Cancelled by {a.cancelledBy === 'doctor' ? 'you' : 'patient'}{a.cancelReason ? `: ${a.cancelReason}` : ''}</div>}
                        </div>
                        {a.status === 'pending' ? <span className="badge badge-cyan">Scheduled</span> : <StatusBadge status={a.status} />}
                        {a.status === 'pending' && (
                          <>
                            <Button className="btn btn-sm" loading={busy === a._id} onClick={() => complete(a)}><FiCheck /> Complete</Button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCancelling(a)} aria-label="Cancel appointment" title="Cancel"><FiX /></button>
                          </>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      )}
      <Modal open={Boolean(cancelling)} onClose={() => setCancelling(null)} title="Cancel this appointment?" subtitle="The patient will be notified." width={480}>
        <div className="stack gap-16">
          <div className="field">
            <label className="field-label" htmlFor="dcr">Reason (shared with the patient)</label>
            <input id="dcr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Clinic closed — please rebook" />
          </div>
          <div className="row gap-12" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setCancelling(null)}>Keep it</button>
            <Button className="btn btn-danger" loading={busy === `c${cancelling?._id}`} onClick={cancel}>Cancel appointment</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default Appointments;
