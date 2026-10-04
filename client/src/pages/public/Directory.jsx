import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiAward, FiCalendar, FiCheckCircle, FiClock, FiDollarSign, FiGlobe, FiHome, FiMapPin, FiPhone, FiSearch, FiUser, FiUsers, FiVideo } from 'react-icons/fi';
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

export const DirectoryTabs = ({ current }) => (
  <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
    <Link role="tab" aria-selected={current === 'doctors'} className="tab" to="/find-doctors"><FiUser /> Doctors{current === 'doctors' && <span className="tab-line" />}</Link>
    <Link role="tab" aria-selected={current === 'hospitals'} className="tab" to="/hospitals"><FiHome /> Hospitals &amp; clinics{current === 'hospitals' && <span className="tab-line" />}</Link>
  </div>
);

// Adds a doctor to the patient's care team, then opens booking (optionally at a hospital/branch)
const useAddAndBook = () => {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [adding, setAdding] = useState(null);
  const session = getSession();
  const go = async (doctor, place) => {
    if (session?.role !== 'patient') {
      navigate('/patient/signin');
      return;
    }
    setAdding(doctor.id);
    try {
      await api.post('/affiliation/affiliate', { doctorId: [doctor.id] });
      toast(`Dr. ${doctor.lastName} added to your care team`);
    } catch (err) {
      if (!/already affiliated/i.test(apiError(err))) {
        toast(apiError(err), 'error');
        setAdding(null);
        return;
      }
    }
    navigate(`/appointments/book/${session.cnic}`, { state: { doctorId: doctor.id, orgId: place?.orgId, facilityId: place?.facilityId } });
  };
  return { go, adding, isPatient: session?.role === 'patient' };
};

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
      <DirectoryTabs current="doctors" />
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
                    <span className="row gap-8"><FiMapPin size={14} /> <span className="truncate">{d.places?.length ? [...new Set(d.places.map((p) => p.orgName))].join(', ') : `${d.hospital}${d.city ? `, ${d.city}` : ''}`}</span></span>
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
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const { go, adding, isPatient } = useAddAndBook();

  useEffect(() => {
    api.get(`/public/doctors/${id}`).then((r) => setDoc(r.data)).catch((err) => setError(apiError(err, 'Doctor not found')));
  }, [id]);

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
          <button className="btn btn-primary btn-lg" onClick={() => go(doc, doc.places?.length === 1 ? doc.places[0] : null)} disabled={Boolean(adding)}>
            {adding ? <Spinner /> : <FiCalendar />} {isPatient ? 'Add to care team & book' : 'Sign in to book'}
          </button>
        </div>
        {doc.bio && <p className="muted" style={{ lineHeight: 1.7 }}>{doc.bio}</p>}
        {doc.places?.some((p) => p.kind === 'org') && (
          <div className="stack gap-12">
            <h2 className="section-title">Where to see Dr. {doc.lastName}</h2>
            <div className="grid grid-2" style={{ gap: 12 }}>
              {doc.places.filter((p) => p.kind === 'org').map((p) => (
                <div key={`${p.orgId}-${p.facilityId}`} className="feed-item">
                  <FiHome />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <Link to={`/hospitals/${p.orgId}`} style={{ fontWeight: 600 }}>{p.orgName}</Link>
                    <div className="subtle" style={{ fontSize: 13 }}>{[p.facilityName, p.city].filter(Boolean).join(', ')} · {fee(p.fee)}</div>
                  </div>
                  <button className="btn btn-sm" onClick={() => go(doc, p)} disabled={Boolean(adding)}>Book here</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {(!doc.places?.length || doc.places.some((p) => p.kind === 'private')) && <div className="grid grid-2">
          <div className="stack gap-12">
            <h2 className="section-title">{doc.places?.some((p) => p.kind === 'org') ? 'Private practice' : 'Clinic'}</h2>
            <span className="row gap-8"><FiMapPin className="subtle" /> {doc.hospital}{doc.city ? `, ${doc.city}` : ''}</span>
            {doc.clinicAddress && <span className="subtle" style={{ paddingLeft: 24 }}>{doc.clinicAddress}</span>}
            <span className="row gap-8"><FiDollarSign className="subtle" /> {fee(doc.fee)}</span>
            {doc.languages?.length > 0 && <span className="row gap-8"><FiGlobe className="subtle" /> {doc.languages.join(', ')}</span>}
          </div>
          <div className="stack gap-12">
            <h2 className="section-title">Timings</h2>
            {hoursText(doc.hours).map((h) => <span key={h} className="row gap-8"><FiClock className="subtle" /> {h}</span>)}
          </div>
        </div>}
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

const TYPE_LABEL = { hospital: 'Hospital', clinic: 'Clinic', lab: 'Laboratory', diagnostic: 'Diagnostic centre' };

// Public list of verified hospitals and clinics, by city
export const HospitalDirectory = () => {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
  const [cities, setCities] = useState([]);
  const city = params.get('city') || '';
  const type = params.get('type') || '';

  useEffect(() => {
    api.get('/public/doctors', { params: { page: 1 } }).then((r) => setCities(r.data.cities || [])).catch(() => {});
  }, []);
  useEffect(() => {
    setData(null);
    api.get('/public/hospitals', { params: { q: params.get('q') || undefined, city: city || undefined, type: type || undefined } })
      .then((r) => setData(r.data)).catch(() => setData([]));
  }, [params, city, type]);
  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  return (
    <PublicPage wide>
      <DirectoryTabs current="hospitals" />
      <section className="stack gap-12" style={{ marginBottom: 24 }}>
        <span className="eyebrow">Hospitals &amp; clinics</span>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 44px)' }}>Find a hospital near you</h1>
        <p className="muted" style={{ maxWidth: 640 }}>Every hospital and clinic listed is registered with its provincial healthcare commission and checked by our team. Pick one to see its branches and doctors.</p>
      </section>
      <form className="glass card-pad directory-filters" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }); }}>
        <div className="input-wrap grow">
          <FiSearch size={16} />
          <input className="input" placeholder="Hospital or clinic name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search hospitals" />
        </div>
        <select className="select" value={city} onChange={(e) => update({ city: e.target.value })} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select" value={type} onChange={(e) => update({ type: e.target.value })} aria-label="Type">
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      {!data ? (
        <div className="grid grid-auto" style={{ marginTop: 24 }}><Skeleton height={180} /><Skeleton height={180} /><Skeleton height={180} /></div>
      ) : !data.length ? (
        <div className="glass" style={{ marginTop: 24 }}><EmptyState icon={FiHome} title="No hospitals found" action={<Link to="/hospitals/register" className="btn">Register your hospital</Link>}>Try another city, or search doctors instead.</EmptyState></div>
      ) : (
        <motion.div className="grid grid-auto" style={{ marginTop: 24 }} variants={stagger} initial="hidden" animate="show" key={params.toString()}>
          {data.map((o) => (
            <motion.div key={o.id} variants={rise}>
              <Link to={`/hospitals/${o.id}`} className="glass card-pad stack gap-12 doctor-card">
                <div className="row gap-12">
                  <span className="empty-orb" style={{ width: 44, height: 44, flexShrink: 0 }}><FiHome size={20} /></span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }} className="truncate">{o.name}</div>
                    <div className="subtle truncate" style={{ fontSize: 13 }}>{TYPE_LABEL[o.type]}{o.city ? ` · ${o.city}` : ''}</div>
                  </div>
                </div>
                <div className="row gap-8 wrap"><span className="badge badge-green badge-plain"><FiCheckCircle size={12} /> Verified</span></div>
                <div className="stack gap-4 subtle" style={{ fontSize: 13.5 }}>
                  <span className="row gap-8"><FiMapPin size={14} /> <span className="truncate">{o.branches.length} branch{o.branches.length === 1 ? '' : 'es'}: {[...new Set(o.branches.map((b) => b.city).filter(Boolean))].join(', ') || o.city}</span></span>
                  <span className="row gap-8"><FiUsers size={14} /> {o.doctors} doctor{o.doctors === 1 ? '' : 's'}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
      <p className="subtle" style={{ marginTop: 24, fontSize: 13 }}>Run a hospital or clinic? <Link to="/hospitals/register">Register it on PakMedRecord</Link>.</p>
    </PublicPage>
  );
};

// One hospital: branches, departments and doctors; patients pick a branch and doctor to book
export const HospitalProfile = () => {
  const { id } = useParams();
  const [org, setOrg] = useState(null);
  const [error, setError] = useState(null);
  const [branch, setBranch] = useState('');
  const [dept, setDept] = useState('');
  const { go, adding, isPatient } = useAddAndBook();

  useEffect(() => {
    api.get(`/public/hospitals/${id}`).then((r) => setOrg(r.data)).catch((err) => setError(apiError(err, 'Hospital not found')));
  }, [id]);

  if (error) return <PublicPage><div className="glass"><EmptyState icon={FiHome} title="Hospital not found" action={<Link to="/hospitals" className="btn">All hospitals</Link>}>{error}</EmptyState></div></PublicPage>;
  if (!org) return <PublicPage><Skeleton height={320} /></PublicPage>;

  const doctors = org.doctors.filter((d) => (!branch || d.branchIds.includes(branch)) && (!dept || d.departmentId === dept));
  const placeFor = (d) => {
    const fid = branch || (d.branchIds.length === 1 ? d.branchIds[0] : null);
    return { orgId: org.id, facilityId: fid };
  };

  return (
    <PublicPage wide>
      <Link to="/hospitals" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>← All hospitals</Link>
      <section className="glass card-pad-lg stack gap-16" style={{ marginBottom: 20 }}>
        <div className="row gap-16 wrap">
          <span className="empty-orb" style={{ width: 64, height: 64 }}><FiHome size={28} /></span>
          <div className="stack gap-8 grow">
            <h1 style={{ fontSize: 30 }}>{org.name}</h1>
            <span className="muted">{TYPE_LABEL[org.type]}{org.city ? ` · ${org.city}` : ''}{org.province ? `, ${org.province}` : ''}</span>
            <div className="row gap-8 wrap"><span className="badge badge-green badge-plain"><FiCheckCircle size={12} /> Registration verified</span></div>
          </div>
        </div>
        {org.about && <p className="muted" style={{ lineHeight: 1.7 }}>{org.about}</p>}
        <div className="row gap-16 wrap subtle" style={{ fontSize: 14 }}>
          {org.phone && <a className="row gap-8" href={`tel:${org.phone}`}><FiPhone /> {org.phone}</a>}
          {org.website && <a className="row gap-8" href={/^https?:/.test(org.website) ? org.website : `https://${org.website}`} target="_blank" rel="noreferrer"><FiGlobe /> {org.website}</a>}
        </div>
      </section>

      <section className="stack gap-12" style={{ marginBottom: 20 }}>
        <h2 className="section-title">1. Choose a branch</h2>
        <div className="grid grid-auto" style={{ gap: 12 }}>
          <button type="button" className="feed-item" aria-pressed={!branch} style={{ font: 'inherit', cursor: 'pointer', ...(!branch ? { borderColor: 'rgba(61,255,176,.55)', boxShadow: 'var(--glow)' } : {}) }} onClick={() => setBranch('')}>
            <FiMapPin /> <div style={{ textAlign: 'start' }}><strong>All branches</strong><div className="subtle" style={{ fontSize: 12.5 }}>{org.branches.length === 1 ? '1 location' : `${org.branches.length} locations`}</div></div>
          </button>
          {org.branches.map((b) => (
            <button type="button" key={b.id} className="feed-item" aria-pressed={branch === b.id} style={{ font: 'inherit', cursor: 'pointer', ...(branch === b.id ? { borderColor: 'rgba(61,255,176,.55)', boxShadow: 'var(--glow)' } : {}) }} onClick={() => setBranch(b.id)}>
              <FiMapPin /> <div style={{ textAlign: 'start', minWidth: 0 }}><strong className="truncate" data-no-translate>{b.name}</strong><div className="subtle" style={{ fontSize: 12.5 }}>{[b.address, b.city].filter(Boolean).join(', ')}</div></div>
            </button>
          ))}
        </div>
      </section>

      <section className="stack gap-12">
        <div className="row between wrap gap-12">
          <h2 className="section-title">2. Choose a doctor</h2>
          {org.departments.length > 0 && (
            <select className="select" style={{ width: 220 }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
              <option value="">All departments</option>
              {org.departments.filter((d) => !branch || !d.branchId || d.branchId === branch).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>
        {!doctors.length ? <div className="glass"><EmptyState icon={FiUser} title="No doctors here yet">Try another branch or department.</EmptyState></div> : (
          <div className="grid grid-auto">
            {doctors.map((d) => (
              <div key={d.id} className="glass card-pad stack gap-12">
                <div className="row gap-12">
                  <Avatar first={d.firstName} last={d.lastName} seed={d.id} size={48} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <Link to={`/find-doctors/${d.id}`} style={{ fontWeight: 600 }} className="truncate">Dr. {d.firstName} {d.lastName}</Link>
                    <div className="subtle truncate" style={{ fontSize: 13 }}>{d.specialization}{org.departments.find((x) => x.id === d.departmentId) ? ` · ${org.departments.find((x) => x.id === d.departmentId).name}` : ''}</div>
                  </div>
                </div>
                <div className="row gap-8 wrap">
                  {d.verified && <VerifiedBadge />}
                  {d.videoConsults && <span className="badge badge-cyan badge-plain"><FiVideo size={12} /> Video</span>}
                  {d.availableSoon && <span className="badge badge-plain"><FiClock size={12} /> Available this week</span>}
                </div>
                <div className="stack gap-4 subtle" style={{ fontSize: 13.5 }}>
                  <span className="row gap-8"><FiMapPin size={14} /> <span className="truncate" data-no-translate>{d.branchIds.map((bid) => org.branches.find((b) => b.id === bid)?.name).filter(Boolean).join(', ')}</span></span>
                  <span className="row gap-8"><FiDollarSign size={14} /> {fee(d.fee)}</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => go(d, placeFor(d))} disabled={Boolean(adding)}>{adding === d.id ? <Spinner /> : <FiCalendar />} {isPatient ? 'Book' : 'Sign in to book'}</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicPage>
  );
};
