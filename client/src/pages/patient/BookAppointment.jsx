import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCalendar, FiCheck, FiCheckCircle, FiClock, FiCreditCard, FiHome, FiMapPin, FiUser, FiUserPlus, FiVideo } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchCareTeam } from '../../lib/data';
import { apiError, doctorName, formatTime } from '../../lib/format';
import { Avatar, Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

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

  // "Move" from My appointments: same doctor, new place/time, in one step
  const moveFrom = location.state?.moveFrom || null;
  const [doctor, setDoctor] = useState(location.state?.doctorCNIC ?? null);
  // where: { orgId, facilityId } of a hospital branch, or { orgId: null } for private practice
  const [places, setPlaces] = useState(null);
  const [place, setPlace] = useState(null);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [saving, setSaving] = useState(false);
  const [booked, setBooked] = useState(null);
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState('in-person');
  // the doctor's open slots for the chosen day: { slots, taken, workingDays, holidays, videoConsults, fee }
  const [avail, setAvail] = useState(null);
  const [week, setWeek] = useState(null); // working days / holidays, known once a doctor is picked
  const taken = useMemo(() => avail?.taken || [], [avail]);

  const { data: team, loading } = useFetch(() => fetchCareTeam(cnic), [cnic]);
  const chosen = team?.find((d) => d.doctorCNIC === doctor);

  // arriving from the directory with a doctor id (and maybe a hospital/branch)
  useEffect(() => {
    const want = location.state?.doctorId;
    if (want && team && !doctor) {
      const d = team.find((x) => x._id === want);
      if (d) setDoctor(d.doctorCNIC);
    }
  }, [team, location.state, doctor]);

  // the places this doctor can be booked
  useEffect(() => {
    setPlaces(null);
    setPlace(null);
    setDate(null);
    setTime(null);
    if (!doctor) return;
    api.get(`/appointments/locations/${doctor}`).then((r) => {
      const list = r.data;
      setPlaces(list);
      const st = location.state || {};
      const pre = list.find((l) => st.orgId && l.orgId === st.orgId && (!st.facilityId || l.facilityId === st.facilityId));
      if (pre && (st.facilityId || list.filter((l) => l.orgId === st.orgId).length === 1)) setPlace(pre);
      else if (list.length === 1) setPlace(list[0]);
    }).catch(() => setPlaces([]));
  }, [doctor]); // eslint-disable-line react-hooks/exhaustive-deps
  const where = place ? { orgId: place.orgId || undefined, facilityId: place.facilityId || undefined } : null;

  // the doctor's hours there (working days, video, fee) as soon as a place is chosen
  useEffect(() => {
    setWeek(null);
    setMode('in-person');
    if (!doctor || !where) return;
    api.get(`/appointments/availability/${doctor}`, { params: { date: toKey(new Date()), ...where } }).then((r) => setWeek(r.data)).catch(() => {});
  }, [doctor, place]); // eslint-disable-line react-hooks/exhaustive-deps

  // open and booked times for the chosen day
  useEffect(() => {
    setAvail(null);
    if (!doctor || !date || !where) return;
    api.get(`/appointments/availability/${doctor}`, { params: { date, ...where } }).then((r) => setAvail(r.data)).catch(() => {});
  }, [doctor, date, place]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayClosed = (d) => Boolean(week) && (!week.workingDays.includes(d.getDay()) || week.holidays.includes(toKey(d)));

  const now = new Date();
  const slotDisabled = (slot) => {
    if (taken.includes(slot)) return true;
    if (!date || date !== toKey(now)) return false;
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
  };
  useEffect(() => {
    if (time && taken.includes(time)) setTime(null);
  }, [taken, time]);

  const book = async () => {
    setSaving(true);
    try {
      if (moveFrom) {
        const { data } = await api.post(`/appointments/${moveFrom}/move`, { date, time, mode, ...where });
        toast(data.message);
      } else {
        await api.post(`/appointments/book/${cnic}`, { doctorCNIC: doctor, date, time, reason: reason.trim(), mode, ...where });
        toast('Appointment booked');
      }
      setBooked({ doctor: chosen, date, time, mode, place, moved: Boolean(moveFrom) });
      setReason('');
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
  const stepN = (n) => (places && places.length > 1 ? n + 1 : n);

  return (
    <>
      <PageHeader eyebrow="Scheduling" title={moveFrom ? 'Move appointment' : 'Book an appointment'} subtitle={moveFrom ? 'Same doctor: choose where and when instead. A paid fee moves with it if the same hospital receives it; otherwise it is refunded.' : 'Choose a doctor from your care team, where to see them, then a day and time.'} />

      <AnimatePresence mode="wait">
        {booked ? (
          <motion.div key="done" className="glass card-pad-lg stack gap-20" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 520, margin: '0 auto' }} initial={{ opacity: 0, rotateY: -90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }}>
            <div className="empty-orb" style={{ width: 90, height: 90 }}><FiCheckCircle size={40} /></div>
            <h2 style={{ fontSize: 28 }}>{booked.moved ? 'Appointment moved' : <>You&apos;re booked!</>}</h2>
            <p className="muted">
              {booked.mode === 'video' ? 'Video visit with ' : ''}{doctorName(booked.doctor)}{booked.place?.orgId ? ` at ${booked.place.orgName}, ${booked.place.facilityName}` : ''} on{' '}
              <strong style={{ color: 'var(--text)' }}>{new Date(`${booked.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>{' '}
              at <strong style={{ color: 'var(--text)' }}>{formatTime(booked.time)}</strong>.
            </p>
            <div className="row gap-12">
              <button className="btn" onClick={reset}>Book another</button>
              <Link to={`/appointments/mine/${cnic}`} className="btn btn-primary">My appointments</Link>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" className="grid dash-grid" style={{ alignItems: 'start' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, rotateY: 30 }}>
            <div className="stack gap-20">
              <Step n={1} title="Doctor" done={Boolean(doctor)}>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  {team.filter((d) => !moveFrom || d.doctorCNIC === doctor).map((d) => (
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

              {places && places.length > 1 && (
                <Step n={2} title="Where" done={Boolean(place)}>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    {places.map((l) => {
                      const on = place && place.orgId === l.orgId && place.facilityId === l.facilityId;
                      return (
                        <button key={`${l.orgId}-${l.facilityId}`} type="button" className="feed-item" style={{ font: 'inherit', cursor: 'pointer', ...(on ? { borderColor: 'rgba(61,255,176,.55)', boxShadow: 'var(--glow)' } : {}) }} aria-pressed={Boolean(on)} onClick={() => { setPlace(l); setDate(null); setTime(null); }}>
                          {l.orgId ? <FiHome size={18} /> : <FiMapPin size={18} />}
                          <div className="grow" style={{ textAlign: 'start', minWidth: 0 }}>
                            <div className="truncate" style={{ fontWeight: 600 }} data-no-translate>{l.orgName}</div>
                            <div className="subtle truncate" style={{ fontSize: 12.5 }}>{[l.facilityName, l.city].filter(Boolean).join(', ')}{l.fee ? ` · Rs ${l.fee.toLocaleString('en-PK')}` : ''}</div>
                            {!l.hasHours && <div className="subtle" style={{ fontSize: 12 }}>No open hours yet</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Step>
              )}
              {places && !places.length && <p className="auth-notice">This doctor has no bookable hours yet.</p>}

              <Step n={stepN(2)} title="Day" done={Boolean(date)}>
                <div className="days">
                  {days.map((d) => {
                    const key = toKey(d);
                    return (
                      <button key={key} type="button" className="day" aria-pressed={date === key} disabled={!place || dayClosed(d)} title={dayClosed(d) ? 'Doctor not available' : undefined} style={!place || dayClosed(d) ? { opacity: 0.3, cursor: 'not-allowed' } : undefined} onClick={() => { setDate(key); setTime(null); }}>
                        <span className="dow">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                        <span className="dom">{d.getDate()}</span>
                        <span className="dow">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
                      </button>
                    );
                  })}
                </div>
              </Step>

              <Step n={stepN(3)} title="Time" done={Boolean(time)}>
                {date && !avail ? <Skeleton height={40} /> : date && !avail.slots.length ? (
                  <p className="subtle">The doctor isn&apos;t available on this day. Pick another day.</p>
                ) : date ? (
                  <div className="chips">
                    {avail.slots.map((s) => (
                      <button key={s} type="button" className="chip" aria-pressed={time === s} disabled={slotDisabled(s)} title={taken.includes(s) ? 'Already booked' : undefined} style={slotDisabled(s) ? { opacity: 0.3, cursor: 'not-allowed', textDecoration: taken.includes(s) ? 'line-through' : undefined } : undefined} onClick={() => setTime(s)}>
                        {formatTime(s)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="subtle">{place ? 'Pick a day to see available times.' : 'Choose where to see the doctor first.'}</p>
                )}
              </Step>

              {week?.videoConsults && (
                <Step n={stepN(4)} title="Visit type" done>
                  <div className="row gap-12 wrap">
                    {[['in-person', FiMapPin, 'In person', place?.orgId ? `${place.orgName}, ${place.facilityName}` : chosen?.clinicAddress || chosen?.hospital], ['video', FiVideo, 'Video call', 'Join from the app at your time']].map(([v, Icon, label, sub]) => (
                      <button key={v} type="button" className={`feed-item ${mode === v ? 'selected' : ''}`} style={{ font: 'inherit', cursor: 'pointer', flex: '1 1 200px', ...(mode === v ? { borderColor: 'rgba(61,255,176,.55)', boxShadow: 'var(--glow)' } : {}) }} aria-pressed={mode === v} onClick={() => setMode(v)}>
                        <Icon size={18} />
                        <div style={{ textAlign: 'left' }}><div style={{ fontWeight: 600 }}>{label}</div><div className="subtle" style={{ fontSize: 12.5 }}>{sub}</div></div>
                      </button>
                    ))}
                  </div>
                </Step>
              )}

              {!moveFrom && <Step n={stepN(week?.videoConsults ? 5 : 4)} title="Reason for visit (optional)" done={Boolean(reason.trim())}>
                <textarea className="textarea" style={{ minHeight: 80 }} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Follow-up on blood test results, recurring headaches…" aria-label="Reason for visit" />
              </Step>}
            </div>

            <aside className="glass card-pad stack gap-8" style={{ position: 'sticky', top: 24 }}>
              <h2 className="section-title" style={{ marginBottom: 8 }}>Summary</h2>
              <div className="summary-row"><span className="k">Doctor</span><span className="row gap-8 truncate"><FiUser className="subtle" /> {chosen ? doctorName(chosen) : '—'}</span></div>
              <div className="summary-row"><span className="k">Where</span><span className="row gap-8 truncate"><FiHome className="subtle" /> {place ? (place.orgId ? `${place.orgName}, ${place.facilityName}` : place.facilityName) : '—'}</span></div>
              <div className="summary-row"><span className="k">Date</span><span className="row gap-8"><FiCalendar className="subtle" /> {dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</span></div>
              <div className="summary-row"><span className="k">Time</span><span className="row gap-8"><FiClock className="subtle" /> {time ? formatTime(time) : '—'}</span></div>
              <div className="summary-row"><span className="k">Visit</span><span className="row gap-8">{mode === 'video' ? <><FiVideo className="subtle" /> Video call</> : <><FiMapPin className="subtle" /> In person</>}</span></div>
              {week?.fee ? <div className="summary-row"><span className="k">Fee</span><span className="row gap-8"><FiCreditCard className="subtle" /> Rs {week.fee.toLocaleString('en-PK')}</span></div> : null}
              {week?.fee ? <p className="subtle" style={{ fontSize: 12.5 }}>Pay online from My appointments, or at the reception.</p> : null}
              <Button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 12 }} disabled={!doctor || !place || !date || !time} loading={saving} onClick={book}>
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
