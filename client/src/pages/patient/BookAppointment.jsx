import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCalendar, FiCheck, FiCheckCircle, FiClock, FiHome, FiUser, FiUserPlus } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchCareTeam } from '../../lib/data';
import { apiError, doctorName, formatTime } from '../../lib/format';
import { Avatar, Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const SLOTS = [];
for (let h = 9; h < 17; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`);
}

const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const nextDays = (n) => {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push(day);
  }
  return out;
};

const Step = ({ n, title, done, children }) => (
  <section className="glass card-pad stack gap-16">
    <div className="row gap-12">
      <span className="check" style={done ? { background: 'var(--grad)', borderColor: 'transparent' } : undefined}>
        {done ? <FiCheck size={13} /> : <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{n}</span>}
      </span>
      <h2 className="section-title">{title}</h2>
    </div>
    {children}
  </section>
);

const BookAppointment = () => {
  const { cnic } = useShell();
  const location = useLocation();
  const { toast } = useFeedback();
  const days = useMemo(() => nextDays(14), []);

  const [doctor, setDoctor] = useState(location.state?.doctorCNIC ?? null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [saving, setSaving] = useState(false);
  const [booked, setBooked] = useState(null);

  const { data: team, loading } = useFetch(() => fetchCareTeam(cnic), [cnic]);
  const chosen = team?.find((d) => d.doctorCNIC === doctor);

  const now = new Date();
  const slotDisabled = (slot) => {
    if (!date || date !== toKey(now)) return false;
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
  };

  const book = async () => {
    setSaving(true);
    try {
      await api.post(`/appointments/book/${cnic}`, { doctorCNIC: doctor, date, time });
      setBooked({ doctor: chosen, date, time });
      toast('Appointment booked');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setBooked(null);
    setDate(null);
    setTime(null);
  };

  if (loading) return <><PageHeader eyebrow="Scheduling" title="Book an appointment" /><Skeleton height={300} /></>;

  if (!team.length) {
    return (
      <>
        <PageHeader eyebrow="Scheduling" title="Book an appointment" />
        <div className="glass">
          <EmptyState icon={FiUserPlus} title="Add a doctor first" action={<Link to="/doctor/doctors" className="btn btn-primary">Find doctors</Link>}>
            You can book with doctors in your care team. Add one to get started.
          </EmptyState>
        </div>
      </>
    );
  }

  const dateObj = date ? new Date(`${date}T00:00:00`) : null;

  return (
    <>
      <PageHeader eyebrow="Scheduling" title="Book an appointment" subtitle="Choose a doctor from your care team, pick a day and a time slot." />

      <AnimatePresence mode="wait">
        {booked ? (
          <motion.div key="done" className="glass card-pad-lg stack gap-20" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 520, margin: '0 auto' }} initial={{ opacity: 0, rotateY: -90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }}>
            <div className="empty-orb" style={{ width: 90, height: 90 }}><FiCheckCircle size={40} /></div>
            <h2 style={{ fontSize: 28 }}>You&apos;re booked!</h2>
            <p className="muted">
              {doctorName(booked.doctor)} on{' '}
              <strong style={{ color: 'var(--text)' }}>{new Date(`${booked.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>{' '}
              at <strong style={{ color: 'var(--text)' }}>{formatTime(booked.time)}</strong>.
            </p>
            <div className="row gap-12">
              <button className="btn" onClick={reset}>Book another</button>
              <Link to={`/patient/home/${cnic}`} className="btn btn-primary">Back to overview</Link>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" className="grid dash-grid" style={{ alignItems: 'start' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, rotateY: 30 }}>
            <div className="stack gap-20">
              <Step n={1} title="Doctor" done={Boolean(doctor)}>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  {team.map((d) => (
                    <button key={d.doctorCNIC} type="button" className={`feed-item ${doctor === d.doctorCNIC ? 'selected' : ''}`} style={doctor === d.doctorCNIC ? { borderColor: 'rgba(61,255,176,.55)', boxShadow: 'var(--glow)', font: 'inherit', cursor: 'pointer' } : { font: 'inherit', cursor: 'pointer' }} onClick={() => setDoctor(d.doctorCNIC)} aria-pressed={doctor === d.doctorCNIC}>
                      <Avatar first={d.firstName} last={d.lastName} seed={d.doctorCNIC} size={40} />
                      <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 600 }}>{doctorName(d)}</div>
                        <div className="subtle truncate" style={{ fontSize: 13 }}>{d.hospital}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </Step>

              <Step n={2} title="Day" done={Boolean(date)}>
                <div className="days">
                  {days.map((d) => {
                    const key = toKey(d);
                    return (
                      <button key={key} type="button" className="day" aria-pressed={date === key} onClick={() => { setDate(key); setTime(null); }}>
                        <span className="dow">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                        <span className="dom">{d.getDate()}</span>
                        <span className="dow">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
                      </button>
                    );
                  })}
                </div>
              </Step>

              <Step n={3} title="Time" done={Boolean(time)}>
                {date ? (
                  <div className="chips">
                    {SLOTS.map((s) => (
                      <button key={s} type="button" className="chip" aria-pressed={time === s} disabled={slotDisabled(s)} style={slotDisabled(s) ? { opacity: 0.3, cursor: 'not-allowed' } : undefined} onClick={() => setTime(s)}>
                        {formatTime(s)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="subtle">Pick a day to see available times.</p>
                )}
              </Step>
            </div>

            <aside className="glass card-pad stack gap-8" style={{ position: 'sticky', top: 24 }}>
              <h2 className="section-title" style={{ marginBottom: 8 }}>Summary</h2>
              <div className="summary-row"><span className="k">Doctor</span><span className="row gap-8 truncate"><FiUser className="subtle" /> {chosen ? doctorName(chosen) : '—'}</span></div>
              <div className="summary-row"><span className="k">Hospital</span><span className="row gap-8 truncate"><FiHome className="subtle" /> {chosen?.hospital || '—'}</span></div>
              <div className="summary-row"><span className="k">Date</span><span className="row gap-8"><FiCalendar className="subtle" /> {dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</span></div>
              <div className="summary-row"><span className="k">Time</span><span className="row gap-8"><FiClock className="subtle" /> {time ? formatTime(time) : '—'}</span></div>
              <Button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 12 }} disabled={!doctor || !date || !time} loading={saving} onClick={book}>
                Confirm booking
              </Button>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BookAppointment;
