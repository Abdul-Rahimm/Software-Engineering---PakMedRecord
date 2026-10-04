import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiCheck, FiChevronLeft, FiChevronRight, FiDollarSign, FiPlus, FiSearch, FiUserCheck, FiUserX, FiVideo, FiX } from 'react-icons/fi';
import api from '../../api';
import Modal from '../../ui/Modal';
import Field from '../../ui/Field';
import { Button, EmptyState, Skeleton, StatusBadge } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';
import { useFetch } from '../../lib/data';
import { apiError, formatCNIC, formatTime, maskCNIC, parseCNIC } from '../../lib/format';
import RefundButton from '../../ui/RefundButton';

const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const shift = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Walk-in / phone booking for a registered patient
const BookModal = ({ open, onClose, day, onBooked, orgId }) => {
  const { toast } = useFeedback();
  const [cnic, setCnic] = useState('');
  const [patient, setPatient] = useState(null);
  const [doctor, setDoctor] = useState('');
  const [facility, setFacility] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setCnic(''); setPatient(null); setDoctor(''); setTime(''); setReason(''); setFacility(day?.facilities.length === 1 ? day.facilities[0]._id : ''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const lookup = async () => {
    try {
      const { data } = await api.get(`/orgs/${orgId}/desk/patient/${parseCNIC(cnic)}`);
      setPatient(data);
    } catch (err) {
      setPatient(null);
      toast(apiError(err), 'error');
    }
  };

  const doctorsHere = (day?.doctors || []).filter((d) => !facility || d.facilityIds.includes(facility));
  const doc = doctorsHere.find((d) => String(d.doctorCNIC) === doctor);
  const slots = (doc && facility && doc.slots[facility]) || [];
  const taken = day?.appointments.filter((a) => String(a.doctorCNIC) === doctor && a.status !== 'cancelled').map((a) => a.time) || [];

  const book = async () => {
    setBusy(true);
    try {
      await api.post(`/orgs/${orgId}/desk/book`, { patientCNIC: patient.patientCNIC, doctorCNIC: Number(doctor), facilityId: facility, date: day.date, time, reason });
      toast('Appointment booked. The patient was notified.');
      onBooked();
      onClose();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New booking" subtitle={day && new Date(`${day.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} width={560}>
      <div className="stack gap-16">
        <div className="row gap-8" style={{ alignItems: 'flex-end' }}>
          <Field className="grow" label="Patient CNIC" placeholder="42101-1234567-1" value={cnic} onChange={(e) => { setCnic(maskCNIC(e.target.value)); setPatient(null); }} inputMode="numeric" />
          <button className="btn" type="button" onClick={lookup} disabled={parseCNIC(cnic).length !== 13}><FiSearch /> Find</button>
        </div>
        {patient && <div className="feed-item"><FiUserCheck /> <span><strong>{patient.firstName} {patient.lastName}</strong> · {patient.gender}{patient.phone ? ` · ${patient.phone}` : ''}</span></div>}
        {day?.facilities.length > 1 && (
          <Field as="select" label="Branch" value={facility} onChange={(e) => { setFacility(e.target.value); setDoctor(''); setTime(''); }}>
            <option value="">Choose a branch</option>
            {day.facilities.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
          </Field>
        )}
        <Field as="select" label="Doctor" value={doctor} onChange={(e) => { setDoctor(e.target.value); setTime(''); }}>
          <option value="">Choose a doctor</option>
          {doctorsHere.map((d) => <option key={d.doctorCNIC} value={d.doctorCNIC}>Dr. {d.firstName} {d.lastName} · {d.specialization}</option>)}
        </Field>
        {doc && facility && (
          <div className="field">
            <span className="field-label">Time</span>
            {slots.length ? (
              <div className="chips">
                {slots.map((s) => <button key={s} type="button" className="chip" aria-pressed={time === s} disabled={taken.includes(s)} style={taken.includes(s) ? { opacity: 0.3, textDecoration: 'line-through' } : undefined} onClick={() => setTime(s)}>{formatTime(s)}</button>)}
              </div>
            ) : <span className="subtle">Not working at this branch on this day.</span>}
          </div>
        )}
        <Field label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Walk-in, fever" />
        <Button className="btn btn-primary btn-block" disabled={!patient || !doctor || !facility || !time} loading={busy} onClick={book}>Book appointment</Button>
      </div>
    </Modal>
  );
};

// The day's appointments across the organization's doctors: check-in, payments, walk-in bookings
const DeskBoard = ({ orgId }) => {
  const { toast, confirm } = useFeedback();
  const [date, setDate] = useState(todayKey());
  const [booking, setBooking] = useState(false);
  const [filter, setFilter] = useState('all');
  const [branch, setBranch] = useState('');
  const { data, loading, reload } = useFetch(async () => (await api.get(`/orgs/${orgId}/desk`, { params: { date, facilityId: branch || undefined } })).data, [orgId, date, branch]);

  // keep the board fresh while the desk works
  useEffect(() => {
    const t = setInterval(() => reload(true), 30000);
    return () => clearInterval(t);
  }, [reload]);

  const list = useMemo(() => (data?.appointments || []).filter((a) => filter === 'all' || String(a.doctorCNIC) === filter), [data, filter]);

  const act = async (a, action) => {
    if (action === 'cancel' && !(await confirm({ title: 'Cancel this appointment?', message: 'The patient will be notified.', confirmLabel: 'Cancel appointment', danger: true }))) return;
    try {
      await api.post(`/orgs/${orgId}/desk/appointments/${a._id}`, { action });
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };
  const paid = async (a) => {
    const amount = window.prompt('Amount received (Rs)', a.fee || '');
    if (!amount) return;
    try {
      await api.post(`/appointments/${a._id}/paid`, { amount: Number(amount) });
      toast('Payment recorded');
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  const doctorName = (cnic) => {
    const d = data?.doctors.find((x) => x.doctorCNIC === cnic);
    return d ? `Dr. ${d.firstName} ${d.lastName}` : '';
  };
  const counts = {
    total: list.filter((a) => a.status !== 'cancelled').length,
    waiting: list.filter((a) => a.status === 'pending' && a.checkedInAt).length,
    done: list.filter((a) => a.status === 'completed').length,
  };

  return (
    <div className="stack gap-20">
        <div className="row between wrap gap-12 desk-toolbar">
          <div className="row gap-8">
            <button className="btn btn-icon" onClick={() => setDate(shift(date, -1))} aria-label="Previous day"><FiChevronLeft /></button>
            <div className="stack" style={{ minWidth: 200, textAlign: 'center' }}>
              <strong style={{ fontSize: 18 }}>{new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              {date !== todayKey() && <button className="btn btn-ghost btn-sm" onClick={() => setDate(todayKey())}>Back to today</button>}
            </div>
            <button className="btn btn-icon" onClick={() => setDate(shift(date, 1))} aria-label="Next day"><FiChevronRight /></button>
          </div>
          <div className="row gap-8 wrap">
            {data?.facilities.length > 1 && (
              <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)} style={{ width: 200 }} aria-label="Branch">
                <option value="">All branches</option>
                {data.facilities.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            )}
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 220 }} aria-label="Doctor">
              <option value="all">All doctors</option>
              {data?.doctors.map((d) => <option key={d.doctorCNIC} value={d.doctorCNIC}>Dr. {d.firstName} {d.lastName}</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => setBooking(true)} disabled={!data}><FiPlus /> New booking</button>
          </div>
        </div>
        <div className="grid grid-3 desk-stats">
          <div className="glass card-pad"><span className="subtle">Booked</span><div style={{ fontSize: 28, fontWeight: 700 }}>{counts.total}</div></div>
          <div className="glass card-pad"><span className="subtle">Waiting (checked in)</span><div style={{ fontSize: 28, fontWeight: 700 }}>{counts.waiting}</div></div>
          <div className="glass card-pad"><span className="subtle">Seen</span><div style={{ fontSize: 28, fontWeight: 700 }}>{counts.done}</div></div>
        </div>
        {loading && !data ? <Skeleton height={300} /> : !list.length ? (
          <div className="glass"><EmptyState icon={FiCalendar} title="No appointments" action={<button className="btn btn-primary" onClick={() => setBooking(true)}><FiPlus /> New booking</button>}>Nothing booked for this day yet.</EmptyState></div>
        ) : (
          <>
          <div className="desk-cards stack gap-12">
            {list.map((a) => (
              <div key={a._id} className={`glass desk-card ${a.status}`}>
                <div className="row between gap-8">
                  <strong className="mono" style={{ fontSize: 17 }}>{formatTime(a.time)}{a.mode === 'video' && <FiVideo title="Video visit" style={{ marginInlineStart: 6 }} />}</strong>
                  {a.status === 'pending' && a.checkedInAt ? <span className="badge badge-cyan">Waiting</span> : <StatusBadge status={a.status} />}
                </div>
                <div>
                  <strong>{a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—'}</strong>
                  <div className="subtle mono" style={{ fontSize: 12.5 }}>{formatCNIC(a.patientCNIC)}</div>
                  {a.patient?.phone && <a className="subtle" style={{ fontSize: 13 }} href={`tel:${a.patient.phone}`}>{a.patient.phone}</a>}
                </div>
                <div className="row between wrap gap-8 subtle" style={{ fontSize: 13.5 }}>
                  <span>{doctorName(a.doctorCNIC)}</span>
                  <span>{a.payment?.status === 'paid' ? <span className="badge badge-green">Paid</span> : a.payment?.status === 'refund_due' ? <span className="badge badge-amber">Refund due</span> : a.payment?.status === 'refunded' ? <span className="badge">Refunded</span> : a.fee ? `Rs ${a.fee}` : ''}</span>
                </div>
                <RefundButton appointment={a} onDone={() => reload(true)} className="btn btn-sm btn-block" />
                {a.reason && <div className="subtle" style={{ fontSize: 13 }}>{a.reason}</div>}
                {a.status === 'pending' && (
                  <div className="desk-card-actions">
                    {!a.checkedInAt ? <button className="btn btn-sm btn-primary" onClick={() => act(a, 'check-in')}><FiCheck /> Check in</button> : <button className="btn btn-sm" onClick={() => act(a, 'undo-check-in')}>Undo</button>}
                    {a.payment?.status !== 'paid' && <button className="btn btn-sm" onClick={() => paid(a)}><FiDollarSign /> Paid</button>}
                    <button className="btn btn-sm btn-ghost" onClick={() => act(a, 'no-show')} aria-label="Mark no-show"><FiUserX /> No-show</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => act(a, 'cancel')} aria-label="Cancel"><FiX /> Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="glass table-wrap desk-table">
            <table className="table">
              <thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Fee</th><th /></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a._id} style={a.status === 'cancelled' ? { opacity: 0.5 } : undefined}>
                    <td className="mono"><strong>{formatTime(a.time)}</strong>{a.mode === 'video' && <FiVideo title="Video visit" style={{ marginLeft: 6 }} />}</td>
                    <td><strong>{a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—'}</strong><div className="subtle mono" style={{ fontSize: 12 }}>{formatCNIC(a.patientCNIC)}{a.patient?.phone ? ` · ${a.patient.phone}` : ''}</div>{a.reason && <div className="subtle" style={{ fontSize: 12.5 }}>{a.reason}</div>}</td>
                    <td>{doctorName(a.doctorCNIC)}</td>
                    <td>{a.status === 'pending' && a.checkedInAt ? <span className="badge badge-cyan">Waiting</span> : <StatusBadge status={a.status} />}</td>
                    <td>{a.payment?.status === 'paid' ? <span className="badge badge-green">Paid</span> : a.payment?.status === 'refund_due' ? <div className="stack gap-4"><span className="badge badge-amber">Refund due</span><RefundButton appointment={a} onDone={() => reload(true)} /></div> : a.payment?.status === 'refunded' ? <span className="badge">Refunded</span> : a.fee ? `Rs ${a.fee}` : '—'}</td>
                    <td>
                      {a.status === 'pending' && (
                        <div className="row gap-4 wrap" style={{ justifyContent: 'flex-end' }}>
                          {!a.checkedInAt ? <button className="btn btn-sm btn-primary" onClick={() => act(a, 'check-in')}><FiCheck /> Check in</button> : <button className="btn btn-sm" onClick={() => act(a, 'undo-check-in')}>Undo</button>}
                          {a.payment?.status !== 'paid' && <button className="btn btn-sm" onClick={() => paid(a)}><FiDollarSign /> Paid</button>}
                          <button className="btn btn-sm btn-ghost" onClick={() => act(a, 'no-show')} title="Mark no-show"><FiUserX /></button>
                          <button className="btn btn-sm btn-ghost" onClick={() => act(a, 'cancel')} title="Cancel"><FiX /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <p className="subtle" style={{ fontSize: 12.5 }}>Front-desk accounts manage the schedule and payments only. Medical records stay private to the patient and their doctors.</p>
      <BookModal open={booking} onClose={() => setBooking(false)} day={data} onBooked={() => reload(true)} orgId={orgId} />
    </div>
  );
};

export default DeskBoard;
