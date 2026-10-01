import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiArrowRight, FiCalendar, FiCheck, FiFileText, FiRefreshCw, FiSun, FiUploadCloud, FiUserPlus, FiUsers,
} from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchCareTeam, indexBy, byNewest } from '../../lib/data';
import { apiError, apptDay, doctorName, formatDate, formatTime, greeting } from '../../lib/format';
import { AssistantGlyph } from '../../layout/Assistant';
import TiltCard from '../../ui/TiltCard';
import HealthCard from '../../ui/HealthCard';
import { Button, CountUp, Skeleton, rise, stagger } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const TIPS = [
  'Stay hydrated. Aim for 8 glasses of water a day, more in Karachi summers.',
  'Eat a balanced plate: half vegetables, a quarter protein, a quarter whole grains.',
  'A 30-minute brisk walk five days a week cuts heart-disease risk significantly.',
  'Adults need 7–9 hours of sleep. Keep screens out of bed for better rest.',
  'Wash hands for 20 seconds, especially before meals and after travel.',
  'Try box breathing for stress: in 4, hold 4, out 4, hold 4.',
  'Swap sugary drinks for water, lassi without sugar, or green tea.',
  'Book a yearly check-up even when you feel fine. Prevention beats cure.',
  'Keep a list of your allergies and medicines in your notes for emergencies.',
  'Make time for something you enjoy every day. Your mental health matters.',
];

const PatientOverview = () => {
  const { cnic, profile } = useShell();
  const { toast } = useFeedback();
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, setData } = useFetch(async () => {
    const [team, records, notes, appts] = await Promise.all([
      fetchCareTeam(cnic),
      api.get(`/record/getrecords/${cnic}`).then((r) => r.data),
      api.get(`/patient/${cnic}/getnote`).then((r) => r.data.notes),
      api.get(`/appointments/mine/${cnic}`).then((r) => r.data.appointments),
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = appts.filter((a) => a.status === 'pending' && apptDay(a.date) >= today);
    return { team, records: [...records].sort(byNewest), notes, upcoming };
  }, [cnic]);

  const doctorsById = useMemo(() => indexBy(data?.team, 'doctorCNIC'), [data]);

  const saveNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.post(`/patient/${cnic}/addnote`, { note: note.trim() });
      setData((d) => ({ ...d, notes: [...d.notes, { _id: Date.now(), note: note.trim(), createdAt: new Date() }] }));
      setNote('');
      toast('Note saved');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    { label: 'Health records', value: data?.records.length, icon: FiFileText, to: `/record/getrecords/${cnic}` },
    { label: 'Care team', value: data?.team.length, icon: FiUsers, to: `/affiliation/getmydoctors/${cnic}` },
    { label: 'Upcoming visits', value: data?.upcoming.length, icon: FiCalendar, to: `/appointments/mine/${cnic}` },
  ];

  const next = data?.upcoming[0];
  const nextDoctor = next && data.team.find((d) => d.doctorCNIC === next.doctorCNIC);
  const healthDone = Boolean(profile?.bloodGroup || profile?.allergies?.length || profile?.medications?.length);

  const actions = [
    { label: 'Book appointment', text: 'Pick a slot with your doctor', icon: FiCalendar, to: `/appointments/book/${cnic}` },
    { label: 'Submit a record', text: 'Send a report for approval', icon: FiUploadCloud, to: `/tempRecords/submit/${cnic}` },
    { label: 'Find doctors', text: 'Grow your care team', icon: FiUserPlus, to: '/doctor/doctors' },
  ];

  const checklist = [
    { label: 'Create your account', done: true },
    { label: 'Complete your health profile', done: healthDone, to: `/patient/${cnic}/health` },
    { label: 'Link your first doctor', done: (data?.team.length ?? 0) > 0, to: '/doctor/doctors' },
    { label: 'Submit a medical record', done: (data?.records.length ?? 0) > 0, to: `/tempRecords/submit/${cnic}` },
    { label: 'Write a note for your next visit', done: (data?.notes.length ?? 0) > 0, to: `/patient/${cnic}/getnote` },
  ];
  const progress = checklist.filter((c) => c.done).length / checklist.length;

  return (
    <div className="stack gap-24">
      {/* Hero */}
      <section className="glass dash-hero">
        <div className="dash-hero-copy">
          <motion.span className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{greeting()}</motion.span>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            {profile ? <>Hi, <span className="grad-text">{profile.firstName}</span>.</> : 'Welcome back.'}
          </motion.h1>
          <p className="muted" style={{ maxWidth: 440 }}>
            Your complete medical history, care team and appointments, all in one record that travels with you.
          </p>
          <div className="row gap-12 wrap" style={{ marginTop: 8 }}>
            <Link to={`/appointments/book/${cnic}`} className="btn btn-primary">Book appointment <FiArrowRight /></Link>
            <Link to={`/record/getrecords/${cnic}`} className="btn">View records</Link>
          </div>
        </div>
        <div className="dash-hero-card">
          <HealthCard person={profile} cnic={cnic} />
        </div>
      </section>

      {/* Stats */}
      <motion.div className="grid grid-3" variants={stagger} initial="hidden" animate="show">
        {stats.map((s) => (
          <motion.div key={s.label} variants={rise}>
            <TiltCard as={Link} to={s.to} className="stat card-pad">
              <div className="row between">
                <span className="stat-icon depth-1"><s.icon size={20} /></span>
                <FiArrowRight className="stat-arrow" />
              </div>
              <div className="stat-value depth-2">{loading ? '–' : <CountUp value={s.value} />}</div>
              <div className="stat-label">{s.label}</div>
            </TiltCard>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid dash-grid">
        {/* Recent records */}
        <section className="glass card-pad stack gap-16">
          <div className="row between">
            <h2 className="section-title">Recent records</h2>
            <Link to={`/record/getrecords/${cnic}`} className="btn btn-ghost btn-sm">See all <FiArrowRight /></Link>
          </div>
          {loading ? (
            <div className="stack gap-12"><Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} /></div>
          ) : data.records.length === 0 ? (
            <div className="mini-empty">
              <FiFileText size={22} />
              <span>No records yet. Submit one or ask your doctor to add it.</span>
            </div>
          ) : (
            <div className="stack gap-8">
              {data.records.slice(0, 4).map((r) => (
                <Link key={r._id} to={`/record/getrecords/${cnic}`} className="list-row">
                  <span className="list-dot" />
                  <div className="grow">
                    <div className="truncate" style={{ fontWeight: 500 }}>{r.recordData}</div>
                    <div className="subtle" style={{ fontSize: 13 }}>{doctorName(doctorsById[r.doctorCNIC])} · {formatDate(r.createdAt)}</div>
                  </div>
                  <FiArrowRight className="subtle" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Getting started */}
        <section className="glass card-pad stack gap-16">
          <div className="row between">
            <h2 className="section-title">Getting started</h2>
            <span className="mono subtle">{Math.round(progress * 100)}%</span>
          </div>
          <div className="progress"><motion.span initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }} /></div>
          <ul className="checklist">
            {checklist.map((c) => (
              <li key={c.label} className={c.done ? 'done' : ''}>
                <span className="check">{c.done && <FiCheck size={13} />}</span>
                {c.to && !c.done ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-3" style={{ alignItems: 'stretch' }}>
        <section className="glass card-pad stack gap-12">
          <div className="row between">
            <h2 className="section-title">Next appointment</h2>
            <Link to={`/appointments/mine/${cnic}`} className="btn btn-ghost btn-sm">All <FiArrowRight /></Link>
          </div>
          {loading ? <Skeleton height={70} /> : next ? (
            <Link to={`/appointments/mine/${cnic}`} className="feed-item">
              <div className="date-tile">
                <span className="m">{apptDay(next.date).toLocaleDateString('en-GB', { month: 'short' })}</span>
                <span className="d">{apptDay(next.date).getDate()}</span>
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 600 }}>{doctorName(nextDoctor)}</div>
                <div className="subtle" style={{ fontSize: 13 }}>{apptDay(next.date).toLocaleDateString('en-GB', { weekday: 'long' })} · {formatTime(next.time)}</div>
              </div>
            </Link>
          ) : (
            <div className="mini-empty"><FiCalendar size={20} /><span>Nothing booked. <Link to={`/appointments/book/${cnic}`}>Book a visit</Link></span></div>
          )}
        </section>

        <section className="glass card-pad stack gap-12">
          <div className="row between">
            <h2 className="section-title">Health snapshot</h2>
            <Link to={`/patient/${cnic}/health`} className="btn btn-ghost btn-sm">Edit <FiArrowRight /></Link>
          </div>
          {profile && (
            <div className="stack gap-8" style={{ fontSize: 14 }}>
              <div className="row between"><span className="subtle">Blood group</span><strong>{profile.bloodGroup || '—'}</strong></div>
              <div className="row between gap-12"><span className="subtle">Allergies</span><span className="truncate" style={{ color: profile.allergies?.length ? '#ff8fb1' : undefined }}>{profile.allergies?.join(', ') || 'None recorded'}</span></div>
              <div className="row between gap-12"><span className="subtle">Medications</span><span className="truncate">{profile.medications?.length ? `${profile.medications.length} active` : 'None recorded'}</span></div>
            </div>
          )}
        </section>

        <section className="glass card-pad stack gap-12 ai-card">
          <span className="ai-badge" style={{ alignSelf: 'flex-start' }}><AssistantGlyph size={12} /> AI assistant</span>
          <h2 className="section-title">Questions about your health?</h2>
          <p className="muted" style={{ fontSize: 14 }}>Ask in English or Urdu. It reads your records, explains results and can book visits for you.</p>
          <p className="subtle" style={{ fontSize: 12.5, marginTop: 'auto' }}>Press <kbd>⌘J</kbd> or tap the glowing button.</p>
        </section>
      </div>

      <div className="grid grid-3">
        {actions.map((a, i) => (
          <motion.div key={a.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
            <TiltCard as={Link} to={a.to} className="action card-pad" max={12}>
              <span className="action-icon depth-2"><a.icon size={22} /></span>
              <div className="depth-1">
                <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>{a.label}</div>
                <div className="subtle" style={{ fontSize: 13.5 }}>{a.text}</div>
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-2">
        {/* Quick note */}
        <form className="glass card-pad stack gap-12" onSubmit={saveNote}>
          <div className="row between">
            <h2 className="section-title">Quick note</h2>
            <Link to={`/patient/${cnic}/getnote`} className="btn btn-ghost btn-sm">All notes <FiArrowRight /></Link>
          </div>
          <textarea className="textarea" style={{ minHeight: 100 }} placeholder="Symptoms, questions for your doctor, medicine reminders…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button className="btn btn-primary btn-sm" loading={saving} disabled={!note.trim()}>Save note</Button>
          </div>
        </form>

        {/* Health tip */}
        <section className="glass card-pad stack gap-12 tip-card">
          <div className="row between">
            <h2 className="section-title row gap-8"><FiSun style={{ color: 'var(--amber)' }} /> Daily health tip</h2>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setTip((t) => (t + 1) % TIPS.length)} aria-label="Next tip"><FiRefreshCw /></button>
          </div>
          <motion.p key={tip} className="tip-text" initial={{ opacity: 0, rotateX: -60, y: 10 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
            {TIPS[tip]}
          </motion.p>
        </section>
      </div>
    </div>
  );
};

export default PatientOverview;
