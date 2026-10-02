import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiAlertTriangle, FiCheck, FiChevronLeft, FiChevronRight, FiClock, FiDownload, FiEdit2, FiFileText, FiMinus, FiPackage, FiPlus, FiSave, FiX,
} from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch } from '../../lib/data';
import { apiError, formatDate, formatTime } from '../../lib/format';
import { downloadPrescriptionPDF } from '../../lib/pdf';
import { Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const pkt = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const shift = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Taken share of scheduled doses, per day and per medicine (also shown to doctors)
export const AdherenceView = ({ cnic, days = 30 }) => {
  const { data, loading } = useFetch(async () => (await api.get(`/meds/${cnic}/adherence`, { params: { days } })).data, [cnic, days]);
  if (loading) return <Skeleton height={160} />;
  if (!data?.scheduled) return <p className="subtle">No dose schedule yet. Adherence appears once medicines have dose times and doses are ticked off.</p>;
  const tone = (r) => (r == null ? 'var(--tint-2)' : r >= 0.9 ? '#12a877' : r >= 0.6 ? '#7ccfae' : r > 0 ? '#e7b768' : '#f0a3b5');
  return (
    <div className="stack gap-16">
      <div className="row gap-20 wrap">
        <div className="stack">
          <strong style={{ fontSize: 40, lineHeight: 1 }}>{data.rate}%</strong>
          <span className="subtle" style={{ fontSize: 13 }}>doses taken · last {data.days} days</span>
        </div>
        <div className="stack gap-8 grow" style={{ minWidth: 220 }}>
          {data.perMed.filter((m) => m.scheduled).map((m) => (
            <div key={m.med} className="stack gap-4">
              <div className="row between" style={{ fontSize: 13 }}><span>{m.med}</span><span className="mono">{m.rate}%</span></div>
              <div className="progress"><span style={{ width: `${m.rate}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="adherence-strip" role="img" aria-label={`Daily adherence for the last ${data.days} days`}>
          {data.daily.map((d) => (
            <span key={d.date} style={{ background: tone(d.scheduled ? d.taken / d.scheduled : null) }} title={`${formatDate(d.date)}: ${d.scheduled ? `${d.taken}/${d.scheduled} doses` : 'nothing scheduled'}`} />
          ))}
        </div>
        <div className="row gap-12 wrap subtle" style={{ fontSize: 12, marginTop: 8 }}>
          <span className="row gap-4"><i className="legend-dot" style={{ background: '#12a877' }} /> All taken</span>
          <span className="row gap-4"><i className="legend-dot" style={{ background: '#7ccfae' }} /> Most</span>
          <span className="row gap-4"><i className="legend-dot" style={{ background: '#e7b768' }} /> Some</span>
          <span className="row gap-4"><i className="legend-dot" style={{ background: '#f0a3b5' }} /> None</span>
          <span className="row gap-4"><i className="legend-dot" style={{ background: 'var(--tint-2)' }} /> Not scheduled</span>
        </div>
      </div>
    </div>
  );
};

const RX_STATUS = { active: ['badge-green', 'Active'], dispensed: ['badge-cyan', 'Dispensed'], cancelled: ['badge-rose', 'Cancelled'] };

export const PrescriptionList = ({ cnic, patient, onCancel }) => {
  const { toast } = useFeedback();
  const { data, loading, reload } = useFetch(async () => (await api.get(`/prescriptions/patient/${cnic}`)).data, [cnic]);
  useEffect(() => {
    const on = () => reload(true);
    window.addEventListener('pakmed:prescriptions', on);
    return () => window.removeEventListener('pakmed:prescriptions', on);
  }, [reload]);
  if (loading) return <Skeleton height={120} />;
  if (!data.length) return <EmptyState icon={FiFileText} title="No e-prescriptions yet">Prescriptions your doctors write in PakMedRecord appear here with a QR code pharmacies can verify.</EmptyState>;
  return (
    <div className="stack gap-12">
      {data.map((rx) => (
        <div key={rx._id} className="rx-card">
          <div className="row between wrap gap-8">
            <div className="row gap-8 wrap">
              <span className={`badge ${RX_STATUS[rx.status][0]}`}>{RX_STATUS[rx.status][1]}</span>
              <strong>{rx.diagnosis || 'Prescription'}</strong>
            </div>
            <span className="subtle" style={{ fontSize: 13 }}>{formatDate(rx.createdAt)}{rx.doctor ? ` · Dr. ${rx.doctor.firstName} ${rx.doctor.lastName}` : ''}</span>
          </div>
          <ul className="rx-items">
            {rx.items.map((i) => <li key={i.name}><strong>{i.name}</strong> {[i.dose, i.frequency, i.durationDays ? `${i.durationDays} days` : null].filter(Boolean).join(' · ')}{i.instructions ? <span className="subtle"> · {i.instructions}</span> : null}</li>)}
          </ul>
          <div className="row gap-8 wrap">
            <span className="mono subtle" style={{ fontSize: 12 }}>{rx.code}</span>
            <div className="grow" />
            {rx.dispensed?.at && <span className="subtle" style={{ fontSize: 12.5 }}>Dispensed by {rx.dispensed.by}</span>}
            <button className="btn btn-sm" onClick={() => downloadPrescriptionPDF({ prescription: rx, doctor: rx.doctor, patient }).catch(() => toast('Could not create the PDF', 'error'))}><FiDownload /> PDF with QR</button>
            {onCancel && rx.status === 'active' && <button className="btn btn-sm btn-ghost" onClick={() => onCancel(rx).then(() => reload(true))}>Cancel</button>}
          </div>
        </div>
      ))}
    </div>
  );
};

// Edit dose times, course dates and refill date for one medicine
const ScheduleModal = ({ med, onClose, onSave }) => {
  const [times, setTimes] = useState([]);
  const [refill, setRefill] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (med) {
      setTimes(med.times?.length ? med.times : ['09:00']);
      setRefill(ymd(med.refillDate));
      setEnd(ymd(med.endDate));
    }
  }, [med]);
  const save = async () => {
    setBusy(true);
    await onSave({ ...med, times: times.filter(Boolean), refillDate: refill || undefined, endDate: end || undefined });
    setBusy(false);
  };
  return (
    <Modal open={Boolean(med)} onClose={onClose} title={med && `${med.name} schedule`} subtitle="When do you take it each day?" width={480}>
      {med && (
        <div className="stack gap-16">
          <div className="stack gap-8">
            {times.map((t, i) => (
              <div key={i} className="row gap-8">
                <FiClock className="subtle" />
                <input type="time" className="input" value={t} onChange={(e) => setTimes((l) => l.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Dose ${i + 1} time`} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setTimes((l) => l.filter((_, j) => j !== i))} aria-label="Remove time"><FiMinus /></button>
              </div>
            ))}
            {times.length < 6 && <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setTimes((l) => [...l, '21:00'])}><FiPlus /> Add a time</button>}
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <label className="field"><span className="field-label">Next refill</span><input type="date" className="input" value={refill} onChange={(e) => setRefill(e.target.value)} /></label>
            <label className="field"><span className="field-label">Course ends</span><input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <Button className="btn btn-primary btn-block" loading={busy} onClick={save}><FiSave /> Save schedule</Button>
        </div>
      )}
    </Modal>
  );
};

const Medicines = () => {
  const { cnic, profile, reloadProfile } = useShell();
  const { toast } = useFeedback();
  const [date, setDate] = useState(pkt());
  const [editing, setEditing] = useState(null);
  const { data, loading, reload, setData } = useFetch(async () => (await api.get(`/meds/${cnic}`, { params: { date } })).data, [cnic, date]);

  const mark = async (dose, status) => {
    const next = dose.status === status ? null : status;
    setData((d) => ({ ...d, doses: d.doses.map((x) => (x.med === dose.med && x.time === dose.time ? { ...x, status: next } : x)) }));
    try {
      await api.post(`/meds/${cnic}/dose`, { med: dose.med, date, time: dose.time, status: next });
    } catch (err) {
      toast(apiError(err), 'error');
      reload(true);
    }
  };

  const saveSchedule = async (med) => {
    try {
      const medications = (profile.medications || []).map((m) => (m.name === med.name ? med : m));
      await api.put(`/patient/${cnic}/health`, { medications });
      await reloadProfile();
      reload(true);
      setEditing(null);
      toast('Schedule saved');
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  const meds = data?.medications || profile?.medications || [];
  const takenCount = data?.doses.filter((d) => d.status === 'taken').length || 0;

  return (
    <>
      <PageHeader eyebrow="Medicines" title="Medicine tracker" subtitle="Tick off each dose, see how well you're keeping up, and get a reminder before you run out." />
      {data?.refills?.length > 0 && (
        <div className="stack gap-8" style={{ marginBottom: 20 }}>
          {data.refills.map((r) => (
            <div key={r.med} className="auth-notice" role="status"><FiPackage /> <span><strong>{r.med}</strong> {r.overdue ? 'ran out on' : 'runs out on'} {formatDate(r.refillDate)}. Arrange a refill with your doctor or pharmacy.</span></div>
          ))}
        </div>
      )}
      <div className="grid dash-grid" style={{ alignItems: 'start' }}>
        <div className="stack gap-20">
          <section className="glass card-pad-lg stack gap-16">
            <div className="row between wrap gap-12">
              <h2 className="section-title">{date === pkt() ? 'Today' : new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
              <div className="row gap-4">
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDate(shift(date, -1))} aria-label="Previous day"><FiChevronLeft /></button>
                {date !== pkt() && <button className="btn btn-ghost btn-sm" onClick={() => setDate(pkt())}>Today</button>}
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDate(shift(date, 1))} disabled={date >= pkt()} aria-label="Next day"><FiChevronRight /></button>
              </div>
            </div>
            {loading ? <Skeleton height={160} /> : !data.doses.length ? (
              <EmptyState icon={FiClock} title="No doses scheduled">{meds.length ? 'Set dose times for your medicines below to track them here.' : 'Add your medicines in your health profile, or they appear here when a doctor prescribes them.'}</EmptyState>
            ) : (
              <>
                <div className="progress"><span style={{ width: `${(takenCount / data.doses.length) * 100}%` }} /></div>
                <span className="subtle" style={{ fontSize: 13 }}>{takenCount} of {data.doses.length} doses taken</span>
                <div className="stack gap-8">
                  {data.doses.map((d) => (
                    <motion.div key={`${d.med}-${d.time}`} layout className={`dose-row ${d.status || ''}`}>
                      <span className="mono dose-time">{formatTime(d.time)}</span>
                      <div className="grow" style={{ minWidth: 0 }}><strong>{d.med}</strong>{d.dose && <span className="subtle"> · {d.dose}</span>}</div>
                      <button className={`btn btn-sm ${d.status === 'taken' ? 'btn-primary' : ''}`} onClick={() => mark(d, 'taken')} aria-pressed={d.status === 'taken'}><FiCheck /> Taken</button>
                      <button className={`btn btn-sm btn-ghost ${d.status === 'skipped' ? 'skipped-on' : ''}`} onClick={() => mark(d, 'skipped')} aria-pressed={d.status === 'skipped'} title="Skipped"><FiX /></button>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="glass card-pad-lg stack gap-16">
            <h2 className="section-title">Adherence</h2>
            <AdherenceView cnic={cnic} />
          </section>

          <section className="glass card-pad-lg stack gap-16">
            <h2 className="section-title">E-prescriptions</h2>
            <PrescriptionList cnic={cnic} patient={profile} />
          </section>
        </div>

        <aside className="glass card-pad stack gap-12" style={{ position: 'sticky', top: 24 }}>
          <h2 className="section-title">My medicines</h2>
          {!meds.length && <p className="subtle">None yet.</p>}
          {meds.map((m) => (
            <div key={m.name} className="item-row">
              <div className="grow" style={{ minWidth: 0 }}>
                <strong className="truncate">{m.name}</strong>
                <div className="subtle" style={{ fontSize: 12.5 }}>{[m.dose, m.frequency].filter(Boolean).join(' · ') || '—'}</div>
                <div className="row gap-4 wrap" style={{ marginTop: 4 }}>
                  {(m.times || []).map((t) => <span key={t} className="chip chip-sm" style={{ cursor: 'default' }}>{formatTime(t)}</span>)}
                  {!m.times?.length && <span className="subtle" style={{ fontSize: 12 }}>No dose times</span>}
                </div>
                {m.refillDate && <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}><FiAlertTriangle size={11} /> Refill {formatDate(m.refillDate)}</div>}
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(m)} aria-label={`Edit ${m.name} schedule`}><FiEdit2 /></button>
            </div>
          ))}
          <a href={`/patient/${cnic}/health`} className="btn btn-sm">Add or remove medicines</a>
        </aside>
      </div>
      <ScheduleModal med={editing} onClose={() => setEditing(null)} onSave={saveSchedule} />
    </>
  );
};

export default Medicines;
