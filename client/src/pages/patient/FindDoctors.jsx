import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheck, FiHome, FiMail, FiSearch, FiUserPlus } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchAllDoctors, fetchCareTeam } from '../../lib/data';
import { apiError, doctorName } from '../../lib/format';
import { Avatar, Button, EmptyState, PageHeader, Skeleton, rise, stagger } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const FindDoctors = () => {
  const { cnic } = useShell();
  const { toast } = useFeedback();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data, loading, setData } = useFetch(async () => {
    const [all, team] = await Promise.all([fetchAllDoctors(), fetchCareTeam(cnic)]);
    return { all, linked: new Set(team.map((d) => d.doctorCNIC)) };
  }, [cnic]);

  const doctors = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.all ?? [];
    return q ? list.filter((d) => `${d.firstName} ${d.lastName} ${d.hospital}`.toLowerCase().includes(q)) : list;
  }, [data, query]);

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
          <div className="search input-wrap">
            <FiSearch size={16} />
            <input className="input" placeholder="Name or hospital" value={query} onChange={(e) => setQuery(e.target.value)} />
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
                    <Avatar first={d.firstName} last={d.lastName} seed={d.doctorCNIC} size={50} />
                    {linked ? <span className="badge badge-green">In your team</span> : <span className="select-tick">{isSel && <FiCheck size={15} />}</span>}
                  </div>
                  <div className="depth-1">
                    <div style={{ fontWeight: 600, fontSize: 17 }}>{doctorName(d)}</div>
                  </div>
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
