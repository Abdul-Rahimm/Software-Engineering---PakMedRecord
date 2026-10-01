import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiAlertTriangle, FiArrowRight, FiFilePlus, FiHome, FiMail, FiSearch, FiUsers } from 'react-icons/fi';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchPatients } from '../../lib/data';
import { formatCNIC, fullName } from '../../lib/format';
import { Avatar, EmptyState, PageHeader, Skeleton, rise, stagger } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import AddRecordModal from './AddRecordModal';
import '../dashboard.css';

const Patients = () => {
  const { cnic } = useShell();
  const [query, setQuery] = useState('');
  const [addFor, setAddFor] = useState(null);
  const { data: patients, loading } = useFetch(() => fetchPatients(cnic), [cnic]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/-/g, '');
    if (!patients) return [];
    return q ? patients.filter((p) => `${p.firstName} ${p.lastName} ${p.patientCNIC} ${p.hospital}`.toLowerCase().includes(q)) : patients;
  }, [patients, query]);

  return (
    <>
      <PageHeader
        eyebrow="Your patients"
        title="Patients"
        subtitle="Patients who added you to their care team. Open a patient to see their complete history."
        actions={
          <div className="search input-wrap">
            <FiSearch size={16} />
            <input className="input" placeholder="Search name, CNIC, hospital" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        }
      />
      {loading ? (
        <div className="grid grid-auto">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={220} />)}</div>
      ) : patients.length === 0 ? (
        <div className="glass">
          <EmptyState icon={FiUsers} title="No patients yet">
            Patients appear here once they add you to their care team from the doctor directory.
          </EmptyState>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass"><EmptyState icon={FiSearch} title="No matches">Try another name or CNIC.</EmptyState></div>
      ) : (
        <motion.div className="grid grid-auto" variants={stagger} initial="hidden" animate="show">
          {filtered.map((p) => (
            <motion.div key={p.patientCNIC} variants={rise}>
              <TiltCard className="person-card card-pad">
                <div className="row gap-16">
                  <Avatar first={p.firstName} last={p.lastName} seed={p.patientCNIC} size={54} />
                  <div className="grow depth-1" style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontWeight: 600, fontSize: 17 }}>{fullName(p)}</div>
                    <div className="mono subtle" style={{ fontSize: 12.5 }}>{formatCNIC(p.patientCNIC)}</div>
                  </div>
                  <span className="badge badge-cyan badge-plain">{p.gender}{p.dateOfBirth ? ` · ${Math.floor((Date.now() - new Date(p.dateOfBirth)) / 3.15576e10)}` : ''}</span>
                </div>
                {(p.bloodGroup || p.allergies?.length > 0 || p.chronicConditions?.length > 0) && (
                  <div className="row gap-8 wrap">
                    {p.bloodGroup && <span className="badge badge-plain cat-badge">Blood {p.bloodGroup}</span>}
                    {p.allergies?.length > 0 && <span className="badge badge-rose badge-plain"><FiAlertTriangle size={11} /> {p.allergies.length} allerg{p.allergies.length === 1 ? 'y' : 'ies'}</span>}
                    {p.chronicConditions?.slice(0, 2).map((c) => <span key={c} className="badge badge-amber badge-plain">{c}</span>)}
                  </div>
                )}
                <div className="meta">
                  <span><FiHome /> <span className="truncate">{p.hospital}</span></span>
                  <span><FiMail /> <a className="truncate" href={`mailto:${p.email}`}>{p.email}</a></span>
                </div>
                <div className="row gap-8" style={{ marginTop: 'auto' }}>
                  <Link to={`/records/getrecords/${p.patientCNIC}`} className="btn btn-sm grow">History <FiArrowRight /></Link>
                  <button className="btn btn-sm btn-icon" onClick={() => setAddFor(p.patientCNIC)} aria-label={`Add record for ${fullName(p)}`} title="Add record"><FiFilePlus /></button>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      )}
      <AddRecordModal open={Boolean(addFor)} onClose={() => setAddFor(null)} patients={patients ?? []} defaultPatient={addFor} />
    </>
  );
};

export default Patients;
