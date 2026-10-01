import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCalendar, FiCheckCircle, FiClipboard, FiFilePlus, FiFileText, FiUsers } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchPatients, indexBy } from '../../lib/data';
import { apptDay, formatCNIC, formatDate, formatTime, fullName, greeting } from '../../lib/format';
import TiltCard from '../../ui/TiltCard';
import HealthCard from '../../ui/HealthCard';
import { CountUp, EmptyState, Skeleton, rise, stagger } from '../../ui/Bits';
import AddRecordModal from './AddRecordModal';
import '../dashboard.css';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const DoctorOverview = () => {
  const { cnic, profile } = useShell();
  const [adding, setAdding] = useState(false);

  const { data, loading } = useFetch(async () => {
    const [patients, appts, pending] = await Promise.all([
      fetchPatients(cnic),
      api.get(`/appointments/fetch/${cnic}`).then((r) => r.data.appointments),
      api.get(`/tempRecords/pending/${cnic}`).then((r) => r.data.pendingRecords),
    ]);
    return { patients, appts, pending };
  }, [cnic]);

  const patientsById = useMemo(() => indexBy(data?.patients, 'patientCNIC'), [data]);
  const name = (c) => fullName(patientsById[c]) || formatCNIC(c);

  const upcoming = useMemo(() => {
    if (!data) return [];
    const today = startOfToday();
    return data.appts
      .filter((a) => a.status !== 'completed' && apptDay(a.date) >= today)
      .sort((a, b) => apptDay(a.date) - apptDay(b.date) || a.time.localeCompare(b.time));
  }, [data]);

  const completed = data?.appts.filter((a) => a.status === 'completed').length ?? 0;

  const stats = [
    { label: 'Patients', value: data?.patients.length, icon: FiUsers, to: `/affiliation/getmypatients/${cnic}` },
    { label: 'Awaiting review', value: data?.pending.length, icon: FiClipboard, to: `/tempRecords/pending/${cnic}`, hot: data?.pending.length > 0 },
    { label: 'Upcoming visits', value: upcoming.length, icon: FiCalendar, to: `/appointments/fetch/${cnic}` },
    { label: 'Completed visits', value: completed, icon: FiCheckCircle, to: `/appointments/fetchByTime/${cnic}` },
  ];

  return (
    <div className="stack gap-24">
      <section className="glass dash-hero">
        <div className="dash-hero-copy">
          <span className="eyebrow">{greeting()}</span>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {profile ? <>Dr. <span className="grad-text">{profile.lastName}</span></> : 'Welcome back'}
          </motion.h1>
          <p className="muted" style={{ maxWidth: 440 }}>
            {loading ? 'Loading your day…' : (
              <>
                You have <strong style={{ color: 'var(--text)' }}>{upcoming.length}</strong> upcoming appointment{upcoming.length === 1 ? '' : 's'} and{' '}
                <strong style={{ color: 'var(--text)' }}>{data.pending.length}</strong> record{data.pending.length === 1 ? '' : 's'} waiting for review.
              </>
            )}
          </p>
          <div className="row gap-12 wrap" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => setAdding(true)} disabled={!data?.patients.length}><FiFilePlus /> New record</button>
            <Link to={`/tempRecords/pending/${cnic}`} className="btn">Review queue <FiArrowRight /></Link>
          </div>
        </div>
        <div className="dash-hero-card">
          <HealthCard person={profile} cnic={cnic} role="doctor" />
        </div>
      </section>

      <motion.div className="grid grid-4" variants={stagger} initial="hidden" animate="show">
        {stats.map((s) => (
          <motion.div key={s.label} variants={rise}>
            <TiltCard as={Link} to={s.to} className="stat card-pad" style={s.hot ? { borderColor: 'rgba(255,200,87,.35)' } : undefined}>
              <div className="row between">
                <span className="stat-icon depth-1" style={s.hot ? { color: 'var(--amber)', background: 'rgba(255,200,87,.12)', borderColor: 'rgba(255,200,87,.3)' } : undefined}><s.icon size={20} /></span>
                <FiArrowRight className="stat-arrow" />
              </div>
              <div className="stat-value depth-2">{loading ? '–' : <CountUp value={s.value} />}</div>
              <div className="stat-label">{s.label}</div>
            </TiltCard>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="glass card-pad stack gap-16">
          <div className="row between">
            <h2 className="section-title">Upcoming appointments</h2>
            <Link to={`/appointments/fetch/${cnic}`} className="btn btn-ghost btn-sm">All <FiArrowRight /></Link>
          </div>
          {loading ? (
            <div className="stack gap-12"><Skeleton height={68} /><Skeleton height={68} /></div>
          ) : upcoming.length === 0 ? (
            <EmptyState icon={FiCalendar} title="Clear schedule">No upcoming appointments.</EmptyState>
          ) : (
            <div className="stack gap-12">
              {upcoming.slice(0, 5).map((a) => {
                const d = apptDay(a.date);
                return (
                  <Link key={a._id} to={`/appointments/fetch/${cnic}`} className="feed-item">
                    <div className="date-tile">
                      <span className="m">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
                      <span className="d">{d.getDate()}</span>
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 600 }}>{name(a.patientCNIC)}</div>
                      <div className="subtle" style={{ fontSize: 13 }}>{d.toLocaleDateString('en-GB', { weekday: 'long' })} · {formatTime(a.time)}</div>
                    </div>
                    <span className="badge badge-cyan">Booked</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass card-pad stack gap-16">
          <div className="row between">
            <h2 className="section-title">Needs your review</h2>
            <Link to={`/tempRecords/pending/${cnic}`} className="btn btn-ghost btn-sm">Open queue <FiArrowRight /></Link>
          </div>
          {loading ? (
            <div className="stack gap-12"><Skeleton height={68} /><Skeleton height={68} /></div>
          ) : data.pending.length === 0 ? (
            <EmptyState icon={FiCheckCircle} title="All caught up">No records waiting for approval.</EmptyState>
          ) : (
            <div className="stack gap-12">
              {data.pending.slice(0, 5).map((r) => (
                <Link key={r._id} to={`/tempRecords/pending/${cnic}`} className="feed-item">
                  <span className="feed-icon doc"><FiFileText size={18} /></span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontWeight: 600 }}>{name(r.patientCNIC)}</div>
                    <div className="subtle truncate" style={{ fontSize: 13 }}>{r.recordData}</div>
                  </div>
                  <span className="badge badge-amber">Pending</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {!loading && data.patients.length > 0 && (
        <section className="glass card-pad stack gap-16">
          <div className="row between">
            <h2 className="section-title">Recent patients</h2>
            <Link to={`/affiliation/getmypatients/${cnic}`} className="btn btn-ghost btn-sm">All patients <FiArrowRight /></Link>
          </div>
          <div className="grid grid-auto" style={{ gap: 12 }}>
            {data.patients.slice(0, 6).map((p) => (
              <Link key={p.patientCNIC} to={`/records/getrecords/${p.patientCNIC}`} className="feed-item">
                <span className="avatar v2" style={{ '--size': '38px' }}>{p.firstName[0]}{p.lastName[0]}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 600 }}>{fullName(p)}</div>
                  <div className="subtle mono" style={{ fontSize: 12 }}>Since {formatDate(p.createdAt, { month: 'short', year: 'numeric' })}</div>
                </div>
                <FiArrowRight className="subtle" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <AddRecordModal open={adding} onClose={() => setAdding(false)} patients={data?.patients ?? []} />
    </div>
  );
};

export default DoctorOverview;
