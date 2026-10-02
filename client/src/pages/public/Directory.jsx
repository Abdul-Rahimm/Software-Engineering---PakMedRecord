import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiAward, FiCalendar, FiCheckCircle, FiClock, FiDollarSign, FiGlobe, FiMapPin, FiSearch, FiVideo } from 'react-icons/fi';
import api from '../../api';
import { getSession } from '../../session';
import { PublicPage } from '../../ui/Layouts';
import { Avatar, EmptyState, Skeleton, Spinner, rise, stagger } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';
import { SPECIALIZATIONS } from '../../lib/constants';
import { apiError } from '../../lib/format';
import '../dashboard.css';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fee = (n) => (n ? `Rs ${Number(n).toLocaleString('en-PK')}` : 'Fee on request');

export const hoursText = (hours) => {
  const byDay = {};
  (hours || []).forEach((h) => { (byDay[h.day] ||= []).push(`${h.start}–${h.end}`); });
  return Object.keys(byDay).sort().map((d) => `${DAY[d]} ${byDay[d].join(', ')}`);
};

const VerifiedBadge = () => (
  <span className="badge badge-green badge-plain" title="PMDC registration verified by PakMedRecord"><FiCheckCircle size={12} /> PMDC verified</span>
);

// Public, searchable directory of verified doctors
export const DoctorDirectory = () => {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const city = params.get('city') || '';
  const specialization = params.get('specialization') || '';
  const video = params.get('video') === '1';
  const page = Number(params.get('page')) || 1;

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api.get('/public/doctors', { params: { q: params.get('q') || undefined, city: city || undefined, specialization: specialization || undefined, video: video ? 1 : undefined, page } })
        .then((r) => setData(r.data))
        .catch(() => setData({ doctors: [], cities: [], total: 0, pages: 0 }))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(t);
  }, [params, city, specialization, video, page]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <PublicPage wide>
      <section className="stack gap-12" style={{ marginBottom: 24 }}>
        <span className="eyebrow">Doctor directory</span>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 44px)' }}>Find a verified doctor</h1>
        <p className="muted" style={{ maxWidth: 640 }}>Every doctor listed has had their PMDC registration checked by our team. Add a doctor to your care team to book and share your records with them.</p>
      </section>
      <form className="glass card-pad directory-filters" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }); }}>
        <div className="input-wrap grow">
          <FiSearch size={16} />
          <input className="input" placeholder="Name, specialty or hospital" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search doctors" />
        </div>
        <select className="select" value={specialization} onChange={(e) => update({ specialization: e.target.value })} aria-label="Specialty">
          <option value="">All specialties</option>
          {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" value={city} onChange={(e) => update({ city: e.target.value })} aria-label="City">
          <option value="">All cities</option>
          {(data?.cities || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="row gap-8 check-label">
          <input type="checkbox" checked={video} onChange={(e) => update({ video: e.target.checked ? '1' : '' })} /> <FiVideo /> Video visits
        </label>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {loading && !data ? (
        <div className="grid grid-auto" style={{ marginTop: 24 }}><Skeleton height={220} /><Skeleton height={220} /><Skeleton height={220} /></div>
      ) : data.doctors.length === 0 ? (
        <div className="glass" style={{ marginTop: 24 }}><EmptyState icon={FiSearch} title="No doctors found">Try another city or specialty.</EmptyState></div>
      ) : (
        <>
          <p className="subtle" style={{ margin: '20px 0 12px', fontSize: 13 }}>{data.total} doctor{data.total === 1 ? '' : 's'}{loading && <> · <Spinner size={12} /></>}</p>
          <motion.div className="grid grid-auto" variants={stagger} initial="hidden" animate="show" key={params.toString()}>
            {data.doctors.map((d) => (
              <motion.div key={d.id} variants={rise}>
                <Link to={`/find-doctors/${d.id}`} className="glass card-pad stack gap-12 doctor-card">
                  <div className="row gap-12">
                    <Avatar first={d.firstName} last={d.lastName} seed={d.id} size={48} />
                    <div className="grow">
                      <div style={{ fontWeight: 600 }} className="truncate">Dr. {d.firstName} {d.lastName}</div>
                      <div className="subtle truncate" style={{ fontSize: 13 }}>{d.specialization}{d.yearsExperience ? ` · ${d.yearsExperience} yrs` : ''}</div>
                    </div>
                  </div>
                  <div className="row gap-8 wrap">
                    {d.verified && <VerifiedBadge />}
                    {d.videoConsults && <span className="badge badge-cyan badge-plain"><FiVideo size={12} /> Video</span>}
                  </div>
                  <div className="stack gap-4 subtle" style={{ fontSize: 13.5 }}>
                    <span className="row gap-8"><FiMapPin size={14} /> <span className="truncate">{d.hospital}{d.city ? `, ${d.city}` : ''}</span></span>
                    <span className="row gap-8"><FiDollarSign size={14} /> {fee(d.fee)}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
          {data.pages > 1 && (
            <div className="row gap-8" style={{ justifyContent: 'center', marginTop: 24 }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
              <span className="subtle" style={{ fontSize: 13 }}>Page {page} of {data.pages}</span>
              <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
            </div>
          )}
        </>
      )}
    </PublicPage>
  );
};

// Public profile with next free days; signed-in patients can add the doctor straight away
export const DoctorPublicProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const session = getSession();

  useEffect(() => {
    api.get(`/public/doctors/${id}`).then((r) => setDoc(r.data)).catch((err) => setError(apiError(err, 'Doctor not found')));
  }, [id]);

  const addAndBook = async () => {
    if (session?.role !== 'patient') {
      navigate('/patient/signin');
      return;
    }
    setAdding(true);
    try {
      await api.post('/affiliation/affiliate', { doctorId: [id] });
      toast(`Dr. ${doc.lastName} added to your care team`);
    } catch (err) {
      if (!/already affiliated/i.test(apiError(err))) {
        toast(apiError(err), 'error');
        setAdding(false);
        return;
      }
    }
    navigate(`/appointments/book/${session.cnic}`);
  };

  if (error) return <PublicPage><div className="glass"><EmptyState icon={FiSearch} title="Doctor not found" action={<Link to="/find-doctors" className="btn">Back to directory</Link>}>{error}</EmptyState></div></PublicPage>;
  if (!doc) return <PublicPage><Skeleton height={320} /></PublicPage>;

  return (
    <PublicPage>
      <Link to="/find-doctors" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>← All doctors</Link>
      <section className="glass card-pad-lg stack gap-20">
        <div className="row gap-16 wrap">
          <Avatar first={doc.firstName} last={doc.lastName} seed={doc.id} size={72} />
          <div className="stack gap-8 grow">
            <h1 style={{ fontSize: 30 }}>Dr. {doc.firstName} {doc.lastName}</h1>
            <span className="muted">{doc.specialization}{doc.qualifications ? ` · ${doc.qualifications}` : ''}</span>
            <div className="row gap-8 wrap">
              {doc.verified && <VerifiedBadge />}
              {doc.videoConsults && <span className="badge badge-cyan badge-plain"><FiVideo size={12} /> Video consultations</span>}
              {doc.yearsExperience ? <span className="badge badge-plain"><FiAward size={12} /> {doc.yearsExperience} years</span> : null}
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={addAndBook} disabled={adding}>
            {adding ? <Spinner /> : <FiCalendar />} {session?.role === 'patient' ? 'Add to care team & book' : 'Sign in to book'}
          </button>
        </div>
        {doc.bio && <p className="muted" style={{ lineHeight: 1.7 }}>{doc.bio}</p>}
        <div className="grid grid-2">
          <div className="stack gap-12">
            <h2 className="section-title">Clinic</h2>
            <span className="row gap-8"><FiMapPin className="subtle" /> {doc.hospital}{doc.city ? `, ${doc.city}` : ''}</span>
            {doc.clinicAddress && <span className="subtle" style={{ paddingLeft: 24 }}>{doc.clinicAddress}</span>}
            <span className="row gap-8"><FiDollarSign className="subtle" /> {fee(doc.fee)}</span>
            {doc.languages?.length > 0 && <span className="row gap-8"><FiGlobe className="subtle" /> {doc.languages.join(', ')}</span>}
          </div>
          <div className="stack gap-12">
            <h2 className="section-title">Timings</h2>
            {hoursText(doc.hours).map((h) => <span key={h} className="row gap-8"><FiClock className="subtle" /> {h}</span>)}
          </div>
        </div>
        <div className="stack gap-12">
          <h2 className="section-title">Next available</h2>
          {doc.nextAvailable.length ? (
            <div className="chips">
              {doc.nextAvailable.map((d) => (
                <span key={d.date} className="chip" style={{ cursor: 'default' }}>
                  {new Date(`${d.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {d.free} slot{d.free > 1 ? 's' : ''}
                </span>
              ))}
            </div>
          ) : <p className="subtle">No open slots in the next two weeks.</p>}
        </div>
      </section>
    </PublicPage>
  );
};
