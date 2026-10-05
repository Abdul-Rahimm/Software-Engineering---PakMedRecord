import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAward, FiCheck, FiHome, FiMail, FiSearch, FiUserPlus } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchAllDoctors, fetchCareTeam } from '../../lib/data';
import { apiError, doctorName } from '../../lib/format';
import { SPECIALIZATIONS } from '../../lib/constants';
import { Avatar, Button, EmptyState, PageHeader, Skeleton, rise, stagger } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const FindDoctors = () => {
  const { cnic } = useShell();
  const { toast } = useFeedback();
  const [query, setQuery] = useState('');
  const [spec, setSpec] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data, loading, setData } = useFetch(async () => {
    const [all, team] = await Promise.all([fetchAllDoctors(), fetchCareTeam(cnic)]);
    return { all, linked: new Set(team.map((d) => d.doctorCNIC)) };
  }, [cnic]);

  const doctors = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.all ?? []).filter((d) => !spec || d.specialization === spec);
    return q ? list.filter((d) => `${d.firstName} ${d.lastName} ${d.hospital} ${d.specialization}`.toLowerCase().includes(q)) : list;
  }, [data, query, spec]);

  const specsInUse = useMemo(() => SPECIALIZATIONS.filter((s) => (data?.all ?? []).some((d) => d.specialization === s)), [data]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const link = async () => {
    setSaving(true);
    try {
      await api.post('/affiliation/affiliate', { doctorCNIC: selected });
      setData((d) => ({ ...d, linked: new Set([...d.linked, ...selected]) }));
      toast(`${selected.length} doctor${selected.length > 1 ? 's' : ''} added to your care team`);
      setSelected([]);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Find doctors"
        subtitle="Add doctors to your care team. Only the doctors you add can see your records."
        actions={
          <div className="row gap-8 wrap">
            <select className="select" style={{ width: 200 }} value={spec} onChange={(e) => setSpec(e.target.value)} aria-label="Specialization">
              <option value="">All specialties</option>
              {specsInUse.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="search input-wrap">
              <FiSearch size={16} />
              <input className="input" placeholder="Name or hospital" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-auto">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={190} />)}</div>
      ) : doctors.length === 0 ? (
        <div className="glass"><EmptyState icon={FiSearch} title="No doctors found">{query ? 'Try another name or hospital.' : 'No doctors have registered yet.'}</EmptyState></div>
      ) : (
        <motion.div className="grid grid-auto" variants={stagger} initial="hidden" animate="show">
          {doctors.map((d) => {
            const linked = data.linked.has(d.doctorCNIC);
            const isSel = selected.includes(d.doctorCNIC);
            return (
              <motion.div key={d.doctorCNIC} variants={rise}>
                <TiltCard
                  as="button"
                  type="button"
                  className={`person-card card-pad ${isSel ? 'selected' : ''}`}
                  style={{ textAlign: 'left', width: '100%', cursor: linked ? 'default' : 'pointer', color: 'var(--text)', font: 'inherit' }}
                  onClick={() => !linked && toggle(d.doctorCNIC)}
                  aria-pressed={isSel}
                  disabled={linked}
                >
                  <div className="row between">
                    <Avatar photo={d} first={d.firstName} last={d.lastName} seed={d.doctorCNIC} size={50} />
                    {linked ? <span className="badge badge-green">In your team</span> : <span className="select-tick">{isSel && <FiCheck size={15} />}</span>}
                  </div>
                  <div className="depth-1 stack gap-4">
                    <div style={{ fontWeight: 600, fontSize: 17 }}>{doctorName(d)}</div>
                    <div className="row gap-8 wrap">
                      <span className="badge cat-badge">{d.specialization || 'General Physician'}</span>
                      {d.yearsExperience != null && <span className="subtle row gap-4" style={{ fontSize: 12.5 }}><FiAward /> {d.yearsExperience} yrs</span>}
                    </div>
                  </div>
                  {d.bio && <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{d.bio.length > 140 ? `${d.bio.slice(0, 140)}…` : d.bio}</p>}
                  <div className="meta">
                    <span><FiHome /> <span className="truncate">{d.hospital}</span></span>
                    <span><FiMail /> <span className="truncate">{d.email}</span></span>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div className="glass action-bar" initial={{ y: 80, opacity: 0, rotateX: 40 }} animate={{ y: 0, opacity: 1, rotateX: 0 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
            <span><strong>{selected.length}</strong> <span className="muted">selected</span></span>
            <div className="row gap-8">
              <button className="btn btn-ghost" onClick={() => setSelected([])}>Clear</button>
              <Button className="btn btn-primary" onClick={link} loading={saving}><FiUserPlus /> Add to care team</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FindDoctors;
