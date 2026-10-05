import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCalendar, FiHome, FiMail, FiTrash2, FiUserPlus, FiUsers } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchCareTeam } from '../../lib/data';
import { apiError, doctorName } from '../../lib/format';
import { Avatar, EmptyState, PageHeader, Skeleton, rise, stagger } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const CareTeam = () => {
  const { cnic } = useShell();
  const { toast, confirm } = useFeedback();
  const { data: team, loading, setData } = useFetch(() => fetchCareTeam(cnic), [cnic]);

  const remove = async (doc) => {
    const ok = await confirm({
      title: `Remove ${doctorName(doc)}?`,
      message: 'They will immediately lose access to your records. You can add them again later.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/affiliation/remove/${cnic}/${doc.doctorCNIC}`);
      setData((t) => t.filter((d) => d.doctorCNIC !== doc.doctorCNIC));
      toast(`${doctorName(doc)} removed from your care team`);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title="My care team"
        subtitle="These doctors can view your records and receive your appointments and submissions."
        actions={<Link to="/doctor/doctors" className="btn btn-primary"><FiUserPlus /> Add doctors</Link>}
      />
      {loading ? (
        <div className="grid grid-auto">{[0, 1, 2].map((i) => <Skeleton key={i} height={220} />)}</div>
      ) : team.length === 0 ? (
        <div className="glass">
          <EmptyState icon={FiUsers} title="Your care team is empty" action={<Link to="/doctor/doctors" className="btn btn-primary">Find doctors</Link>}>
            Add the doctors who treat you so they can see your history and you can book with them.
          </EmptyState>
        </div>
      ) : (
        <motion.div className="grid grid-auto" variants={stagger} initial="hidden" animate="show">
          <AnimatePresence>
            {team.map((d) => (
              <motion.div key={d.doctorCNIC} variants={rise} exit={{ opacity: 0, scale: 0.9, rotateY: 30 }} layout>
                <TiltCard className="person-card card-pad">
                  <div className="row gap-16">
                    <Avatar photo={d} first={d.firstName} last={d.lastName} seed={d.doctorCNIC} size={54} />
                    <div className="grow depth-1">
                      <div style={{ fontWeight: 600, fontSize: 17 }} className="truncate">{doctorName(d)}</div>
                      <div className="row gap-8 wrap" style={{ marginTop: 6 }}>
                        <span className="badge cat-badge">{d.specialization || 'General Physician'}</span>
                        <span className="badge badge-green">Has access</span>
                      </div>
                    </div>
                  </div>
                  <div className="meta">
                    <span><FiHome /> <span className="truncate">{d.hospital}</span></span>
                    <span><FiMail /> <a href={`mailto:${d.email}`} className="truncate">{d.email}</a></span>
                  </div>
                  <div className="row gap-8" style={{ marginTop: 'auto' }}>
                    <Link to={`/appointments/book/${cnic}`} state={{ doctorCNIC: d.doctorCNIC }} className="btn btn-sm grow"><FiCalendar /> Book</Link>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(d)} aria-label={`Remove ${doctorName(d)}`}><FiTrash2 /></button>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
};

export default CareTeam;
